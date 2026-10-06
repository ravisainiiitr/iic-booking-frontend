import * as THREE from "three";
import type { PrintAppearance } from "@/lib/preview3d/appearance";
import type { StlMeshData } from "@/lib/preview3d/stlMesh";
import { formatMm } from "@/lib/preview3d/env";
import { createDimensionGroup } from "./dimensions";
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
  materials: THREE.Material[];
  size: THREE.Vector3;
  exceedsBed: boolean;
}

/** Model on a textured build plate (to scale) inside a faint build-volume frame. */
export function buildPrintScene(
  stage: PreviewStage,
  mesh: StlMeshData,
  appearance: PrintAppearance,
  bed: BedSize | null | undefined,
  layerHeightMm?: number | null,
): PrintSceneResult {
  const size = new THREE.Vector3(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geometry.computeBoundingSphere();
  const material = createPrintMaterial(appearance, Math.max(size.x, size.y, size.z), layerHeightMm);
  const model = new THREE.Mesh(geometry, material);
  model.position.set(-(mesh.min[0] + mesh.max[0]) / 2, -mesh.min[1], -(mesh.min[2] + mesh.max[2]) / 2);
  model.castShadow = true;
  model.receiveShadow = true;
  stage.content.add(model);

  const modelBox = new THREE.Box3(new THREE.Vector3(-size.x / 2, 0, -size.z / 2), new THREE.Vector3(size.x / 2, size.y, size.z / 2));
  const plateW = bed?.x && bed.x > 0 ? bed.x : Math.max(100, Math.ceil((size.x * 1.6) / 10) * 10);
  const plateD = bed?.y && bed.y > 0 ? bed.y : Math.max(100, Math.ceil((size.z * 1.6) / 10) * 10);
  const exceedsBed = !!bed && (size.x > bed.x + 0.01 || size.z > bed.y + 0.01 || (bed.z > 0 && size.y > bed.z + 0.01));

  const plateThickness = Math.max(3, Math.min(8, Math.max(plateW, plateD) * 0.025));
  const side = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.38, metalness: 0.85 });
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
      new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.28 }),
    );
    frame.position.y = bed.z / 2;
    stage.content.add(frame);
  }
  stage.addContactShadow(modelBox, 0.04, 0.55);

  const overlay = createDimensionGroup(modelBox, {
    x: `${formatMm(size.x)} mm`,
    z: `${formatMm(size.z)} mm`,
    y: `${formatMm(size.y)} mm`,
  });
  const plateLabel = labelTexture(`Plate ${formatMm(plateW)} × ${formatMm(plateD)} mm`);
  if (plateLabel) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: plateLabel.texture, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0.85 }),
    );
    sprite.position.set(0, 0, plateD / 2 + plateThickness * 2);
    sprite.userData.labelAspect = plateLabel.aspect;
    sprite.renderOrder = 20;
    overlay.add(sprite);
  }
  stage.setOverlay(overlay);

  const plateBox = new THREE.Box3(new THREE.Vector3(-plateW / 2, 0, -plateD / 2), new THREE.Vector3(plateW / 2, Math.max(size.y, 1), plateD / 2));
  const shadowBox = modelBox.clone().expandByScalar(Math.max(size.x, size.y, size.z) * 0.6);
  stage.setFocus(modelBox, { sheet: plateBox, shadowBox });
  return { materials: [material], size, exceedsBed };
}
