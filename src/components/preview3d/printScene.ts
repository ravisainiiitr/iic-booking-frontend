import * as THREE from "three";
import type { PrintAppearance } from "@/lib/preview3d/appearance";
import type { StlMeshData } from "@/lib/preview3d/stlMesh";
import { formatMm } from "@/lib/preview3d/env";
import { createDimensionGroup } from "./dimensions";
import type { SupportColumns } from "@/lib/preview3d/supportGeometry";
import { buildPlateTexture, labelTexture } from "./textures";
import type { PreviewStage } from "./stage";

export interface BedSize {
  x: number;
  y: number;
  z: number;
}

/** Faint horizontal banding every layer height, fading out where it would alias (zoomed out). */
export function addLayerLines(material: THREE.Material, layerHeightMm: number) {
  const layer = Math.max(0.02, layerHeightMm);
  material.onBeforeCompile = (shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) => {
    shader.uniforms.uLayerH = { value: layer };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vLayerY;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvLayerY = (modelMatrix * vec4(transformed, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vLayerY;\nuniform float uLayerH;")
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "float lyr = vLayerY / uLayerH;",
          "float lyrW = fwidth(lyr);",
          "float lyrBand = 0.5 + 0.5 * cos(lyr * 6.2831853);",
          "float lyrFade = 1.0 - smoothstep(0.2, 0.75, lyrW);",
          "diffuseColor.rgb *= 1.0 - 0.08 * lyrFade * lyrBand;",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => `layer-lines-${layer}`;
}

export function createPrintMaterial(appearance: PrintAppearance, sizeMm: number, layerHeightMm: number | null | undefined) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(appearance.color),
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    clearcoat: appearance.clearcoat,
    clearcoatRoughness: appearance.clearcoatRoughness,
    transmission: appearance.transmission,
    thickness: appearance.transmission > 0 ? Math.min(6, Math.max(1, sizeMm * 0.05)) : 0,
    attenuationColor: new THREE.Color(appearance.color),
    attenuationDistance: Math.max(5, sizeMm * 0.5),
    ior: 1.5,
    specularIntensity: 0.6,
  });
  if (appearance.layerLines) addLayerLines(material, layerHeightMm || 0.2);
  return material;
}

export interface PrintSceneResult {
  /** Materials that follow the wireframe toggle. */
  materials: THREE.Material[];
  size: THREE.Vector3;
  exceedsBed: boolean;
  /** Support columns (null when there are none). */
  supports: THREE.Object3D | null;
  /** Red tint over faces that need support (null when there are none). */
  overhangs: THREE.Object3D | null;
  /** Show the print up to a height above the plate (layer preview), or all of it. */
  setCut: (heightMm: number | null) => void;
}

export interface PrintSceneOptions {
  /** The model is larger than the printer's maximum print size: the build volume and model turn red. */
  overLimit?: boolean;
  /** Support columns and overhang faces for this mesh (same coordinates as the mesh). */
  supports?: SupportColumns | null;
  supportColor?: string;
  /** Rebuilding the same model (turned, new supports): keep the camera where the user left it. */
  keepView?: boolean;
}

const OVER_LIMIT_RED = 0xdc2626;
const OVERHANG_RED = 0xef4444;

function buildSupportMesh(s: SupportColumns, color: string, clip: THREE.Plane[]): THREE.InstancedMesh | null {
  if (!s.count) return null;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    clippingPlanes: clip,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, s.count);
  const m = new THREE.Matrix4();
  // Gaps between the columns, like the grid supports a slicer prints.
  const width = s.cellMm * 0.6;
  for (let i = 0; i < s.count; i += 1) {
    const x = s.columns[i * 4];
    const z = s.columns[i * 4 + 1];
    const y0 = s.columns[i * 4 + 2];
    const h = Math.max(0.05, s.columns[i * 4 + 3] - y0);
    m.makeScale(width, h, width);
    m.setPosition(x, y0, z);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "supports";
  return mesh;
}

function buildOverhangMesh(positions: Float32Array, tris: Uint32Array, clip: THREE.Plane[]): THREE.Mesh | null {
  if (!tris.length) return null;
  const out = new Float32Array(tris.length * 9);
  for (let k = 0; k < tris.length; k += 1) out.set(positions.subarray(tris[k] * 9, tris[k] * 9 + 9), k * 9);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
  const material = new THREE.MeshBasicMaterial({
    color: OVERHANG_RED,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    clippingPlanes: clip,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "overhangs";
  mesh.renderOrder = 2;
  return mesh;
}

/** Printer axes at the front-left corner of the plate: X right, Y back, Z up. */
function addAxisIndicator(content: THREE.Object3D, overlay: THREE.Object3D, plateW: number, plateD: number) {
  const len = Math.max(12, Math.min(30, Math.min(plateW, plateD) * 0.12));
  const origin = new THREE.Vector3(-plateW / 2 + len * 0.35, 0.3, plateD / 2 - len * 0.35);
  const axes: Array<[string, THREE.Vector3, number]> = [
    ["X", new THREE.Vector3(1, 0, 0), 0xe11d48],
    ["Y", new THREE.Vector3(0, 0, -1), 0x16a34a],
    ["Z", new THREE.Vector3(0, 1, 0), 0x2563eb],
  ];
  const group = new THREE.Group();
  group.name = "axis-indicator";
  for (const [name, dir, color] of axes) {
    group.add(new THREE.ArrowHelper(dir, origin, len, color, len * 0.28, len * 0.16));
    const label = labelTexture(name);
    if (label) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: label.texture, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0.9 }),
      );
      sprite.position.copy(origin).addScaledVector(dir, len * 1.25);
      sprite.userData.labelAspect = label.aspect;
      sprite.renderOrder = 21;
      overlay.add(sprite);
    }
  }
  content.add(group);
}

/** Model on a textured build plate (to scale) inside a faint build-volume frame. */
export function buildPrintScene(
  stage: PreviewStage,
  mesh: StlMeshData,
  appearance: PrintAppearance,
  bed: BedSize | null | undefined,
  layerHeightMm?: number | null,
  options: PrintSceneOptions = {},
): PrintSceneResult {
  const overLimit = !!options.overLimit;
  const size = new THREE.Vector3(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geometry.computeBoundingSphere();
  const material = createPrintMaterial(appearance, Math.max(size.x, size.y, size.z), layerHeightMm);
  if (overLimit) {
    material.emissive = new THREE.Color(OVER_LIMIT_RED);
    material.emissiveIntensity = 0.35;
  }
  // Layer preview: everything above the cut is clipped away (the cut starts above the model).
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const clip = [cutPlane];
  stage.renderer.localClippingEnabled = true;
  material.clippingPlanes = clip;
  const model = new THREE.Mesh(geometry, material);
  model.castShadow = true;
  model.receiveShadow = true;
  // Dropped onto the plate and centred on it; supports and overhang tint share the model's coordinates.
  const placed = new THREE.Group();
  placed.position.set(-(mesh.min[0] + mesh.max[0]) / 2, -mesh.min[1], -(mesh.min[2] + mesh.max[2]) / 2);
  placed.add(model);
  const supportMesh = options.supports ? buildSupportMesh(options.supports, options.supportColor || "#e7e5e4", clip) : null;
  if (supportMesh) placed.add(supportMesh);
  const overhangMesh = options.supports ? buildOverhangMesh(mesh.positions, options.supports.overhangTriangles, clip) : null;
  if (overhangMesh) {
    overhangMesh.visible = false;
    placed.add(overhangMesh);
  }
  stage.content.add(placed);

  const modelBox = new THREE.Box3(new THREE.Vector3(-size.x / 2, 0, -size.z / 2), new THREE.Vector3(size.x / 2, size.y, size.z / 2));
  const plateW = bed?.x && bed.x > 0 ? bed.x : Math.max(100, Math.ceil((size.x * 1.6) / 10) * 10);
  const plateD = bed?.y && bed.y > 0 ? bed.y : Math.max(100, Math.ceil((size.z * 1.6) / 10) * 10);
  const exceedsBed =
    !!bed &&
    ((bed.x > 0 && size.x > bed.x + 0.01) || (bed.y > 0 && size.z > bed.y + 0.01) || (bed.z > 0 && size.y > bed.z + 0.01));

  const plateThickness = Math.max(3, Math.min(8, Math.max(plateW, plateD) * 0.025));
  const side = new THREE.MeshStandardMaterial({ color: overLimit ? OVER_LIMIT_RED : 0x9aa3ad, roughness: 0.38, metalness: overLimit ? 0.2 : 0.85 });
  const top = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 });
  const plateTex = buildPlateTexture(plateW, plateD);
  if (plateTex) top.map = plateTex;
  else top.color = new THREE.Color(0x2b2d31);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateThickness, plateD), [side, side, top, side, side, side]);
  plate.position.y = -plateThickness / 2;
  plate.receiveShadow = true;
  stage.content.add(plate);

  if (bed && bed.z > 0) {
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(plateW, bed.z, plateD)),
      overLimit
        ? new THREE.LineBasicMaterial({ color: OVER_LIMIT_RED, transparent: true, opacity: 0.95 })
        : new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.28 }),
    );
    frame.position.y = bed.z / 2;
    stage.content.add(frame);
  }
  if (overLimit) {
    const outline = new THREE.Box3Helper(modelBox, new THREE.Color(OVER_LIMIT_RED));
    outline.name = "over-limit-outline";
    stage.content.add(outline);
  }
  stage.addContactShadow(modelBox, 0.04, 0.55);

  const overlay = createDimensionGroup(modelBox, {
    x: `${formatMm(size.x)} mm`,
    z: `${formatMm(size.z)} mm`,
    y: `${formatMm(size.y)} mm`,
  });
  const plateLabel = labelTexture(`Build plate ${formatMm(plateW)} × ${formatMm(plateD)} mm`);
  if (plateLabel) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: plateLabel.texture, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0.85 }),
    );
    sprite.position.set(0, 0, plateD / 2 + plateThickness * 2);
    sprite.userData.labelAspect = plateLabel.aspect;
    sprite.renderOrder = 20;
    overlay.add(sprite);
  }
  addAxisIndicator(stage.content, overlay, plateW, plateD);
  stage.setOverlay(overlay);

  const cutIndicator = new THREE.Mesh(
    new THREE.PlaneGeometry(plateW, plateD),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  cutIndicator.rotation.x = -Math.PI / 2;
  cutIndicator.visible = false;
  cutIndicator.name = "layer-cut";
  stage.content.add(cutIndicator);

  const plateBox = new THREE.Box3(new THREE.Vector3(-plateW / 2, 0, -plateD / 2), new THREE.Vector3(plateW / 2, Math.max(size.y, 1), plateD / 2));
  const shadowBox = modelBox.clone().expandByScalar(Math.max(size.x, size.y, size.z) * 0.6);
  // The opening view shows the whole plate with the model (centred on it), including any part hanging over;
  // a part much smaller than the plate is framed with some plate around it so its supports can be seen.
  const maxDim = Math.max(size.x, size.y, size.z);
  const homeBox =
    maxDim * 2.5 < Math.max(plateW, plateD)
      ? modelBox.clone().expandByScalar(maxDim * 0.3).union(new THREE.Box3(modelBox.min.clone().setY(0), modelBox.max.clone()))
      : modelBox.clone().union(plateBox);
  stage.setFocus(homeBox, { sheet: plateBox, shadowBox, keepView: options.keepView });
  const setCut = (heightMm: number | null) => {
    const cut = heightMm !== null && heightMm < size.y - 1e-6;
    cutPlane.constant = cut ? (heightMm as number) : 1e6;
    material.side = cut ? THREE.DoubleSide : THREE.FrontSide;
    material.needsUpdate = true;
    cutIndicator.visible = cut;
    if (cut) cutIndicator.position.y = heightMm as number;
    stage.invalidate();
  };
  return { materials: [material], size, exceedsBed, supports: supportMesh, overhangs: overhangMesh, setCut };
}
