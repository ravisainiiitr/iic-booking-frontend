import * as THREE from "three";
import { labelTexture } from "./textures";

export interface DimensionLabels {
  /** Width along X. */
  x?: string;
  /** Height along Y (up). */
  y?: string;
  /** Depth along Z. */
  z?: string;
}

/**
 * Bounding-box dimension lines (with end ticks) and screen-sized labels for the box's width, depth
 * and height. Labels are sprites whose scale the stage keeps at a constant pixel size.
 */
export function createDimensionGroup(box: THREE.Box3, labels: DimensionLabels, color = 0x38bdf8) {
  const group = new THREE.Group();
  group.name = "dimensions";
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1);
  const gap = span * 0.06;
  const tick = span * 0.025;
  const pts: number[] = [];
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const sprites: THREE.Sprite[] = [];
  const addLabel = (text: string | undefined, at: THREE.Vector3) => {
    if (!text) return;
    const made = labelTexture(text);
    if (!made) return;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: made.texture, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false }),
    );
    sprite.position.copy(at);
    sprite.renderOrder = 20;
    sprite.userData.labelAspect = made.aspect;
    sprites.push(sprite);
    group.add(sprite);
  };

  const { min, max } = box;
  if (labels.x) {
    const z = max.z + gap;
    const y = min.y;
    seg(new THREE.Vector3(min.x, y, z), new THREE.Vector3(max.x, y, z));
    seg(new THREE.Vector3(min.x, y, z - tick), new THREE.Vector3(min.x, y, z + tick));
    seg(new THREE.Vector3(max.x, y, z - tick), new THREE.Vector3(max.x, y, z + tick));
    seg(new THREE.Vector3(min.x, y, max.z), new THREE.Vector3(min.x, y, z));
    seg(new THREE.Vector3(max.x, y, max.z), new THREE.Vector3(max.x, y, z));
    addLabel(labels.x, new THREE.Vector3((min.x + max.x) / 2, y, z + gap * 0.6));
  }
  if (labels.z) {
    const x = max.x + gap;
    const y = min.y;
    seg(new THREE.Vector3(x, y, min.z), new THREE.Vector3(x, y, max.z));
    seg(new THREE.Vector3(x - tick, y, min.z), new THREE.Vector3(x + tick, y, min.z));
    seg(new THREE.Vector3(x - tick, y, max.z), new THREE.Vector3(x + tick, y, max.z));
    seg(new THREE.Vector3(max.x, y, min.z), new THREE.Vector3(x, y, min.z));
    seg(new THREE.Vector3(max.x, y, max.z), new THREE.Vector3(x, y, max.z));
    addLabel(labels.z, new THREE.Vector3(x + gap * 0.6, y, (min.z + max.z) / 2));
  }
  if (labels.y) {
    const x = max.x + gap;
    const z = max.z + gap;
    seg(new THREE.Vector3(x, min.y, z), new THREE.Vector3(x, max.y, z));
    seg(new THREE.Vector3(x - tick, min.y, z), new THREE.Vector3(x + tick, min.y, z));
    seg(new THREE.Vector3(x - tick, max.y, z), new THREE.Vector3(x + tick, max.y, z));
    seg(new THREE.Vector3(max.x, max.y, max.z), new THREE.Vector3(x, max.y, z));
    addLabel(labels.y, new THREE.Vector3(x + gap * 0.5, (min.y + max.y) / 2, z + gap * 0.5));
  }

  if (pts.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }),
    );
    lines.renderOrder = 19;
    group.add(lines);
  }
  return group;
}
