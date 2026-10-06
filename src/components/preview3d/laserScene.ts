import * as THREE from "three";
import type { LaserAppearance } from "@/lib/preview3d/appearance";
import type { DxfPath, Point2 } from "@/lib/dxfGeometry";
import { formatMm } from "@/lib/preview3d/env";
import { createDimensionGroup } from "./dimensions";
import { brushedTexture, honeycombTexture, labelTexture, mdfTexture, woodGrainTexture } from "./textures";
import type { PreviewStage } from "./stage";

const WOOD_TILE_MM = 160;
const MDF_TILE_MM = 120;
const BRUSHED_TILE_MM = 140;
const SHEET_MARGIN_MM = 10;

function faceMap(appearance: LaserAppearance) {
  if (appearance.texture === "wood-grain") return woodGrainTexture(appearance.color, WOOD_TILE_MM);
  if (appearance.texture === "mdf") return mdfTexture(appearance.color, MDF_TILE_MM);
  return null;
}

/** Top/bottom and cut-side materials for a sheet part (ExtrudeGeometry groups: 0 = faces, 1 = sides). */
export function createLaserMaterials(appearance: LaserAppearance, thicknessMm: number) {
  const metal = appearance.metalness > 0.5;
  const glass = appearance.transmission > 0;
  const common = {
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    clearcoat: appearance.clearcoat,
    clearcoatRoughness: 0.08,
  };
  const face = new THREE.MeshPhysicalMaterial({ ...common, color: new THREE.Color(appearance.color) });
  const side = new THREE.MeshPhysicalMaterial({ ...common, color: new THREE.Color(appearance.edgeColor) });
  if (glass) {
    for (const m of [face, side]) {
      m.transmission = appearance.transmission;
      m.thickness = Math.max(0.5, thicknessMm);
      m.ior = 1.49;
      m.attenuationColor = new THREE.Color(appearance.color);
      m.attenuationDistance = Math.max(2, thicknessMm * 6);
      m.specularIntensity = 1;
    }
    side.roughness = 0.12;
  }
  const map = faceMap(appearance);
  if (map) {
    face.map = map;
    face.color = new THREE.Color(0xffffff);
  }
  if (metal) {
    const brushed = brushedTexture(BRUSHED_TILE_MM);
    if (brushed) {
      face.roughnessMap = brushed;
      face.roughness = Math.min(1, appearance.roughness / 0.59);
    }
    face.anisotropy = 0.55;
    side.roughness = Math.min(1, appearance.roughness + 0.25);
  } else if (!glass) {
    side.roughness = Math.min(1, appearance.roughness + 0.1);
  }
  return { face, side };
}

function pathSegments(paths: DxfPath[], toXZ: (p: Point2) => [number, number], y: number): Float32Array {
  let count = 0;
  for (const p of paths) count += p.closed ? p.points.length : Math.max(0, p.points.length - 1);
  const out = new Float32Array(count * 6);
  let o = 0;
  for (const p of paths) {
    const pts = p.points;
    const n = p.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i += 1) {
      const [ax, az] = toXZ(pts[i]);
      const [bx, bz] = toXZ(pts[(i + 1) % pts.length]);
      out[o++] = ax;
      out[o++] = y;
      out[o++] = az;
      out[o++] = bx;
      out[o++] = y;
      out[o++] = bz;
    }
  }
  return out;
}

export interface LaserSceneInput {
  /** Closed outlines (drawing units) with holes, already excluding engraved paths. */
  regions: Array<{ outer: Point2[]; holes: Point2[][] }>;
  cutPaths: DxfPath[];
  engravePaths: DxfPath[];
  /** Drawing-unit bounds centre and mm per drawing unit. */
  center: Point2;
  scale: number;
  thicknessMm: number;
  appearance: LaserAppearance;
  sheet?: { widthMm: number; heightMm: number } | null;
  /** Authoritative size for the labels (backend measurement), mm. */
  labelSize?: { widthMm: number; heightMm: number } | null;
}

export interface LaserSceneResult {
  materials: THREE.Material[];
  exceedsSheet: boolean;
  hasSheet: boolean;
}

/**
 * The part extruded to the sheet thickness, resting on the stock sheet (drawn faintly, to scale) on a
 * honeycomb laser bed. Cut paths and engraving are drawn on the part's top face in different colours.
 */
export function buildLaserScene(stage: PreviewStage, input: LaserSceneInput): LaserSceneResult {
  const { regions, center, scale, appearance } = input;
  const t = Math.max(0.3, input.thicknessMm);
  const toV2 = ([x, y]: Point2) => new THREE.Vector2((x - center[0]) * scale, (y - center[1]) * scale);
  const toXZ = ([x, y]: Point2): [number, number] => [(x - center[0]) * scale, -(y - center[1]) * scale];

  const shapes = regions.map((region) => {
    const shape = new THREE.Shape(region.outer.map(toV2));
    shape.holes = region.holes.map((hole) => new THREE.Path(hole.map(toV2)));
    return shape;
  });
  const solid = new THREE.ExtrudeGeometry(shapes, { depth: t, bevelEnabled: false, curveSegments: 1 });
  const { face, side } = createLaserMaterials(appearance, t);
  const part = new THREE.Mesh(solid, [face, side]);
  part.castShadow = true;
  part.receiveShadow = true;
  const partGroup = new THREE.Group();
  partGroup.add(part);
  partGroup.rotation.x = -Math.PI / 2;

  const box = new THREE.Box3().setFromObject(partGroup);
  const partW = box.max.x - box.min.x;
  const partD = box.max.z - box.min.z;

  // Stock sheet: turned to fit the part if needed; the part sits near the sheet's front-left corner.
  let sheetW = input.sheet?.widthMm ?? 0;
  let sheetD = input.sheet?.heightMm ?? 0;
  const hasSheet = sheetW > 0 && sheetD > 0;
  let exceedsSheet = false;
  let sheetBox: THREE.Box3 | null = null;
  const lift = hasSheet ? t : 0;
  if (hasSheet) {
    const fits = (w: number, d: number) => partW <= w + 0.01 && partD <= d + 0.01;
    if (!fits(sheetW, sheetD) && fits(sheetD, sheetW)) [sheetW, sheetD] = [sheetD, sheetW];
    exceedsSheet = !fits(sheetW, sheetD);
    const margin = Math.min(SHEET_MARGIN_MM, Math.max(0, (sheetW - partW) / 2), Math.max(0, (sheetD - partD) / 2));
    const minX = exceedsSheet ? (box.min.x + box.max.x) / 2 - sheetW / 2 : box.min.x - margin;
    const maxZ = exceedsSheet ? (box.min.z + box.max.z) / 2 + sheetD / 2 : box.max.z + margin;
    sheetBox = new THREE.Box3(new THREE.Vector3(minX, 0, maxZ - sheetD), new THREE.Vector3(minX + sheetW, t, maxZ));

    const sheetMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.color),
      roughness: Math.max(0.3, appearance.roughness),
      metalness: appearance.metalness * 0.7,
      transparent: true,
      opacity: appearance.transmission > 0 ? 0.25 : 0.36,
      depthWrite: false,
    });
    const map = faceMap(appearance);
    if (map) {
      map.repeat.set(sheetW * map.repeat.x, sheetD * map.repeat.y);
      sheetMat.map = map;
      sheetMat.color = new THREE.Color(0xffffff);
    }
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(sheetW, t, sheetD), sheetMat);
    sheet.position.set(minX + sheetW / 2, t / 2, maxZ - sheetD / 2);
    sheet.receiveShadow = true;
    sheet.renderOrder = 2;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(sheetW, t, sheetD)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 }),
    );
    edges.position.copy(sheet.position);
    stage.content.add(sheet, edges);
  }
  partGroup.position.y = lift;
  stage.content.add(partGroup);

  const lineY = lift + t + Math.max(0.02, t * 0.004);
  if (input.cutPaths.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pathSegments(input.cutPaths, toXZ, lineY), 3));
    const lines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: new THREE.Color(appearance.cutLineColor), transparent: true, opacity: 0.9 }),
    );
    lines.renderOrder = 5;
    stage.content.add(lines);
  }
  if (input.engravePaths.length) {
    // Dashed, matching the legend and the 2D outline, so engraving reads differently from cuts.
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pathSegments(input.engravePaths, toXZ, lineY), 3));
    const span = Math.max(partW, partD, 1);
    const lines = new THREE.LineSegments(
      g,
      new THREE.LineDashedMaterial({ color: new THREE.Color(appearance.engraveColor), dashSize: span / 90, gapSize: span / 160 }),
    );
    lines.computeLineDistances();
    lines.renderOrder = 6;
    stage.content.add(lines);
  }

  // Honeycomb bed under everything.
  const area = sheetBox ?? box.clone().expandByVector(new THREE.Vector3(partW * 0.4, 0, partD * 0.4));
  const bedW = area.max.x - area.min.x + Math.max(40, (area.max.x - area.min.x) * 0.08);
  const bedD = area.max.z - area.min.z + Math.max(40, (area.max.z - area.min.z) * 0.08);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.7 });
  const comb = honeycombTexture();
  if (comb) {
    comb.repeat.set(bedW * comb.repeat.x, bedD * comb.repeat.y);
    bedMat.map = comb;
  } else {
    bedMat.color = new THREE.Color(0x2a2d31);
  }
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(bedW, bedD), bedMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set((area.min.x + area.max.x) / 2, -0.05, (area.min.z + area.max.z) / 2);
  bed.receiveShadow = true;
  stage.content.add(bed);

  const partBox = new THREE.Box3(new THREE.Vector3(box.min.x, lift, box.min.z), new THREE.Vector3(box.max.x, lift + t, box.max.z));
  stage.addContactShadow(partBox, lift + 0.02, hasSheet ? 0.45 : 0.6);

  const labelW = input.labelSize?.widthMm ?? partW;
  const labelD = input.labelSize?.heightMm ?? partD;
  // Thickness is in the size caption; a height line on a flat part would sit on top of the others.
  const overlay = createDimensionGroup(partBox, {
    x: `${formatMm(labelW)} mm`,
    z: `${formatMm(labelD)} mm`,
  });
  if (sheetBox) {
    const made = labelTexture(`Sheet ${formatMm(sheetW)} × ${formatMm(sheetD)} mm`);
    if (made) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: made.texture, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0.9 }),
      );
      sprite.position.set((sheetBox.min.x + sheetBox.max.x) / 2, t, sheetBox.max.z + Math.max(8, sheetD * 0.03));
      sprite.userData.labelAspect = made.aspect;
      sprite.renderOrder = 20;
      overlay.add(sprite);
    }
  }
  stage.setOverlay(overlay);

  const shadowBox = partBox.clone().expandByScalar(Math.max(partW, partD) * 0.35);
  stage.setFocus(partBox, { sheet: sheetBox, shadowBox });
  return { materials: [face, side], exceedsSheet, hasSheet };
}
