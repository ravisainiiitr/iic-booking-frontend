import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { contactShadowTexture } from "./textures";

export type ViewPreset = "home" | "iso" | "front" | "top" | "sheet";

export interface StageOptions {
  reducedMotion: boolean;
  coarse: boolean;
  /** Slow turntable until the first interaction (never with reduced motion). */
  autoRotate?: boolean;
  onContextLost?: () => void;
}

const VIEW_DIRECTIONS: Record<Exclude<ViewPreset, "home" | "sheet">, [number, number, number]> = {
  iso: [1, 0.85, 1.25],
  front: [0, 0.12, 1],
  top: [0, 1, 0.0008],
};

const LABEL_PX = 24;
const TRANSITION_MS = 550;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Shared three.js scene for the STL and DXF previews: studio lighting (room environment, sky light,
 * soft shadowed key light), orbit controls with damping, camera presets with eased transitions, and a
 * render loop that only draws when something changed and pauses when the preview is off-screen.
 */
export class PreviewStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100_000);
  readonly controls: OrbitControls;
  /** Objects owned by the caller (model, plate, sheet). */
  readonly content = new THREE.Group();
  private readonly overlay = new THREE.Group();
  private readonly key: THREE.DirectionalLight;
  private readonly mount: HTMLElement;
  private readonly opts: StageOptions;
  private focus = new THREE.Box3(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 50, 50));
  private sheet: THREE.Box3 | null = null;
  private dirty = true;
  private visible = true;
  private frame = 0;
  private fitted = false;
  private tween: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number } | null = null;
  private autoRotateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cleanup: Array<() => void> = [];

  constructor(mount: HTMLElement, opts: StageOptions) {
    this.mount = mount;
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.coarse ? 1.75 : 2));
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    const canvas = r.domElement;
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    mount.appendChild(canvas);

    const pmrem = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.55;
    room.dispose?.();
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xf3f6fb, 0x3a3f47, 0.5));
    this.key = new THREE.DirectionalLight(0xffffff, 1.9);
    this.key.castShadow = true;
    const mapSize = opts.coarse ? 1024 : 2048;
    this.key.shadow.mapSize.set(mapSize, mapSize);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.radius = 6;
    (this.key.shadow as unknown as { blurSamples: number }).blurSamples = 16;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xdfe9ff, 0.35);
    fill.position.set(-1, 0.6, -0.8);
    this.scene.add(fill);
    this.scene.add(this.content, this.overlay);

    this.controls = new OrbitControls(this.camera, canvas);
    const c = this.controls;
    c.enableDamping = !opts.reducedMotion;
    c.dampingFactor = 0.09;
    c.screenSpacePanning = true;
    c.rotateSpeed = opts.coarse ? 0.9 : 0.8;
    c.zoomSpeed = 0.9;
    c.maxPolarAngle = Math.PI * 0.495;
    const onStart = () => this.stopAutoRotate();
    const onChange = () => this.invalidate();
    c.addEventListener("start", onStart);
    c.addEventListener("change", onChange);
    this.cleanup.push(() => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("change", onChange);
    });
    if (opts.autoRotate && !opts.reducedMotion) {
      c.autoRotate = true;
      c.autoRotateSpeed = 0.9;
      this.autoRotateTimer = setTimeout(() => this.stopAutoRotate(), 14_000);
    }

    const onLost = (e: Event) => {
      e.preventDefault();
      this.opts.onContextLost?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    this.cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(mount);
      this.cleanup.push(() => ro.disconnect());
    }
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible) this.invalidate();
      });
      io.observe(mount);
      this.cleanup.push(() => io.disconnect());
    }
    const onVisibility = () => {
      if (!document.hidden) this.invalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));

    this.resize();
    this.loop();
  }

  /** Box the camera frames on "home"; optional sheet / plate box for the "sheet" preset and shadows. */
  setFocus(box: THREE.Box3, options: { sheet?: THREE.Box3 | null; shadowBox?: THREE.Box3 } = {}) {
    this.focus = box.clone();
    this.sheet = options.sheet ? options.sheet.clone() : null;
    const shadowBox = (options.shadowBox ?? box).clone();
    const center = shadowBox.getCenter(new THREE.Vector3());
    const radius = Math.max(shadowBox.getSize(new THREE.Vector3()).length() / 2, 1);
    // Upper-left-front key, so shadows fall back and to the right where the default camera sees them.
    const dir = new THREE.Vector3(-0.55, 0.9, 0.45).normalize();
    this.key.position.copy(center).addScaledVector(dir, radius * 3);
    this.key.target.position.copy(center);
    const cam = this.key.shadow.camera as THREE.OrthographicCamera;
    cam.left = -radius * 1.1;
    cam.right = radius * 1.1;
    cam.top = radius * 1.1;
    cam.bottom = -radius * 1.1;
    cam.near = radius * 0.5;
    cam.far = radius * 6;
    cam.updateProjectionMatrix();
    this.key.shadow.normalBias = radius * 0.0015;
    this.key.shadow.needsUpdate = true;
    this.fitted = false;
    this.setView("home", false);
  }

  /** A soft blob under an object's footprint, sitting just above `y`. */
  addContactShadow(footprint: THREE.Box3, y: number, strength = 0.6) {
    const tex = contactShadowTexture();
    if (!tex) return;
    const size = footprint.getSize(new THREE.Vector3());
    const center = footprint.getCenter(new THREE.Vector3());
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: strength,
        color: 0x000000,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(size.x * 1.35 + 2, size.z * 1.35 + 2, 1);
    mesh.position.set(center.x, y, center.z);
    mesh.renderOrder = 1;
    this.content.add(mesh);
    this.invalidate();
  }

  setOverlay(object: THREE.Object3D | null) {
    for (const child of [...this.overlay.children]) {
      this.overlay.remove(child);
      disposeObject(child);
    }
    if (object) this.overlay.add(object);
    this.updateLabelScale();
    this.invalidate();
  }

  setOverlayVisible(visible: boolean) {
    this.overlay.visible = visible;
    this.invalidate();
  }

  setView(preset: ViewPreset, animate = true) {
    const box = preset === "sheet" && this.sheet ? this.sheet : this.focus;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1);
    const dirArr = preset === "home" || preset === "sheet" ? VIEW_DIRECTIONS.iso : VIEW_DIRECTIONS[preset];
    const dir = new THREE.Vector3(...dirArr).normalize();
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(this.camera.aspect, 0.2));
    // Margin leaves room for the dimension labels around the box.
    const distance = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * (preset === "top" ? 1.0 : 1.08);
    const toPos = center.clone().addScaledVector(dir, distance);
    const reach = Math.max(distance, this.sheet ? this.sheet.getSize(new THREE.Vector3()).length() : 0);
    this.camera.near = Math.max(0.01, distance * 0.002);
    this.camera.far = reach * 20 + distance * 10;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.2;
    this.controls.maxDistance = Math.max(distance * 6, reach * 2);
    if (preset !== "home") this.stopAutoRotate();
    if (!animate || this.opts.reducedMotion || !this.fitted) {
      this.tween = null;
      this.camera.position.copy(toPos);
      this.controls.target.copy(center);
      this.controls.update();
      this.fitted = this.mount.clientWidth > 0;
    } else {
      this.tween = {
        from: this.camera.position.clone(),
        to: toPos,
        fromT: this.controls.target.clone(),
        toT: center,
        start: performance.now(),
      };
    }
    this.updateLabelScale();
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
  }

  private stopAutoRotate() {
    if (this.autoRotateTimer) clearTimeout(this.autoRotateTimer);
    this.autoRotateTimer = null;
    this.controls.autoRotate = false;
  }

  private resize() {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (!this.fitted) this.setView("home", false);
    this.updateLabelScale();
    this.invalidate();
  }

  private updateLabelScale() {
    const h = this.mount.clientHeight || 300;
    const p5 = this.camera.projectionMatrix.elements[5] || 1;
    const s = (2 * LABEL_PX) / (p5 * h);
    this.overlay.traverse((o: THREE.Object3D) => {
      const aspect = o.userData?.labelAspect;
      if (aspect) o.scale.set(s * aspect, s, 1);
    });
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    if (!this.visible || (typeof document !== "undefined" && document.hidden)) return;
    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.start) / TRANSITION_MS);
      const k = easeInOutCubic(t);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, k);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, k);
      if (t >= 1) this.tween = null;
      this.dirty = true;
    }
    if (this.controls.update()) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.stopAutoRotate();
    this.cleanup.forEach((fn) => fn());
    this.controls.dispose();
    disposeObject(this.scene);
    this.scene.environment?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

const TEXTURE_KEYS = ["map", "roughnessMap", "metalnessMap", "normalMap", "bumpMap", "alphaMap", "emissiveMap", "aoMap"];

export function disposeObject(root: THREE.Object3D) {
  root.traverse((o: THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] }) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const key of TEXTURE_KEYS) (m as unknown as Record<string, THREE.Texture | undefined>)[key]?.dispose?.();
      m.dispose?.();
    }
  });
}
