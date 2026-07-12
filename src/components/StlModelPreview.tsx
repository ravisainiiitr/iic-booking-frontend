import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

interface StlModelPreviewProps {
  buffer: ArrayBuffer | null;
  bedSize?: { x: number; y: number; z: number };
  className?: string;
}

function placeGeometryOnBed(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;

  const center = new THREE.Vector3();
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  geometry.computeBoundingBox();
  const centered = geometry.boundingBox;
  if (centered) {
    geometry.translate(0, -centered.min.y, 0);
  }
}

function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  box: THREE.Box3,
  offset = 1.4,
) {
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);

  const fovRad = (camera.fov * Math.PI) / 180;
  const fitHeight = maxDim / 2 / Math.tan(fovRad / 2);
  const fitWidth = fitHeight / Math.max(camera.aspect, 0.1);
  const distance = Math.max(fitHeight, fitWidth) * offset;

  const direction = new THREE.Vector3(1.1, 0.85, 1.1).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(0.1, distance / 200);
  camera.far = distance * 200;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.maxDistance = distance * 4;
  controls.update();
}

function addBuildPlate(group: THREE.Group, bed: { x: number; y: number; z: number }) {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(bed.x, bed.y),
    new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.01;

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(bed.x, 1, bed.y)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }),
  );
  frame.position.y = 0.5;

  group.add(plate, frame);
  return [plate, frame];
}

export function StlModelPreview({ buffer, bedSize, className }: StlModelPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !buffer) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1_000_000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    geometry.computeVertexNormals();
    placeGeometryOnBed(geometry);

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        metalness: 0.12,
        roughness: 0.5,
      }),
    );
    root.add(mesh);

    geometry.computeBoundingBox();
    const modelBox = geometry.boundingBox?.clone() ?? new THREE.Box3();
    const modelSize = modelBox.getSize(new THREE.Vector3());

    const gridSpan = Math.max(bedSize?.x ?? 0, bedSize?.y ?? 0, modelSize.x, modelSize.y, 50);
    const grid = new THREE.GridHelper(gridSpan, 20, 0x475569, 0x334155);
    root.add(grid);

    const disposables: THREE.BufferGeometry[] = [geometry, grid.geometry];
    const materials: THREE.Material[] = [(mesh.material as THREE.Material)];

    if (bedSize) {
      const [plate, frame] = addBuildPlate(root, bedSize);
      disposables.push(
        plate.geometry as THREE.BufferGeometry,
        (frame.geometry as THREE.BufferGeometry),
      );
      materials.push(plate.material as THREE.Material, frame.material as THREE.Material);
    }

    const fitScene = () => {
      const box = new THREE.Box3().setFromObject(root);
      fitCameraToBox(camera, controls, box);
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      fitScene();
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(mount);
    requestAnimationFrame(() => {
      resize();
      fitScene();
    });

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      disposables.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
    };
  }, [buffer, bedSize?.x, bedSize?.y, bedSize?.z]);

  if (!buffer) {
    return (
      <div
        className={
          className ??
          "flex h-[360px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground"
        }
      >
        Upload an STL to preview the model
      </div>
    );
  }

  return (
    <div
      className={
        className ?? "relative h-[360px] w-full overflow-hidden rounded-lg border bg-[#0f172a]"
      }
    >
      <div ref={mountRef} className="absolute inset-0" />
      <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] text-slate-400">
        Drag to rotate · scroll to zoom
      </p>
    </div>
  );
}
