import * as THREE from "three";
import { gsap } from "gsap";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export type SeatState = "open" | "sel" | "res";

interface HallOptions {
  rows: number;
  columns: number;
  getSeat: (index: number) => SeatState;
  clickSeat: (index: number) => void;
}

interface SeatAnim {
  lit: number;
  sel: number;
  hov: number;
}

interface HallScene {
  drawScreen: () => void;
  fullHouse: (on: boolean, delay: number) => void;
  intro: () => void;
  resize: () => void;
}

interface SceneContext {
  rows: number;
  columns: number;
  anim: SeatAnim[];
  states: SeatState[];
  seatId: (index: number) => string;
  openSeats: () => number;
  overlayOn: () => boolean;
  setHover: (index: number) => void;
  clickSeat: (index: number) => void;
  canvas: HTMLCanvasElement;
  hallEl: HTMLElement;
  sideEl: HTMLElement;
  tipEl: HTMLElement;
}

const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const wideQuery = window.matchMedia("(min-width: 960px)");
let motionPaused = false;
// Motion is still when the OS asks for reduced motion or the viewer pressed "Pause animations".
const reduced = (): boolean => reducedQuery.matches || motionPaused;
const TWEEN_CONTROL_KEYS = ["duration", "ease", "delay", "onUpdate", "onComplete", "overwrite", "stagger"];

// Animates values on a target with GSAP, or jumps straight to the end values when reduced motion is on.
function tween(target: object, vars: gsap.TweenVars): void {
  if (reduced()) {
    Object.entries(vars).forEach(([key, value]) => {
      if (!TWEEN_CONTROL_KEYS.includes(key)) (target as Record<string, unknown>)[key] = value;
    });
    vars.onUpdate?.();
    vars.onComplete?.();
    return;
  }
  gsap.to(target, vars);
}

// Sets up the 3D hall, hover syncing and layout toggle, and returns a sync function to call after every render.
export function initHall(options: HallOptions): { sync: () => void } {
  const { rows, columns, getSeat, clickSeat } = options;
  const total = rows * columns;
  const seatId = (index: number): string => `${String.fromCharCode(65 + Math.floor(index / columns))}${(index % columns) + 1}`;
  const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
  const layoutEl = byId<HTMLElement>("layout");
  const hallEl = byId<HTMLElement>("hall");
  const sideEl = byId<HTMLElement>("side");
  const panelEl = byId<HTMLElement>("app");
  const hintEl = byId<HTMLElement>("hint");
  const tipEl = byId<HTMLElement>("tip");
  const toggleButton = byId<HTMLButtonElement>("layoutToggle");
  const motionButton = byId<HTMLButtonElement>("motionToggle");
  const canvas = byId<HTMLCanvasElement>("scene");
  const overlayOn = (): boolean => layoutEl.dataset.layout === "overlay" && wideQuery.matches;

  const states: SeatState[] = Array.from({ length: total }, (_, index) => getSeat(index));
  const anim: SeatAnim[] = states.map((state) => ({ lit: state === "res" ? 1 : 0, sel: state === "sel" ? 1 : 0, hov: 0 }));
  const openSeats = (): number => states.filter((state) => state !== "res").length;
  let hallScene: HallScene | null = null;
  let hoverIndex = -1;
  let wasFull = openSeats() === 0;
  let lastOpen = openSeats();

  // Finds the seat map button for a seat index, since the panel is re-rendered after every change.
  const tileAt = (index: number): HTMLElement | null =>
    panelEl.querySelector<HTMLElement>(
      `.seat-button[data-row="${Math.floor(index / columns) + 1}"][data-column="${(index % columns) + 1}"]`,
    );

  // Converts a seat map button back into its seat index.
  const indexOfTile = (tile: HTMLElement): number =>
    (Number(tile.dataset.row) - 1) * columns + (Number(tile.dataset.column) - 1);

  // Highlights a seat in both the 3D hall and the seat map while the pointer or keyboard focus is on it.
  function setHover(index: number): void {
    if (index === hoverIndex) return;
    if (hoverIndex >= 0) {
      tween(anim[hoverIndex], { hov: 0, duration: 0.3, ease: "power2.out" });
      tileAt(hoverIndex)?.classList.remove("is-hot");
    }
    hoverIndex = index;
    if (index >= 0) {
      tween(anim[index], { hov: 1, duration: 0.2, ease: "power2.out" });
      tileAt(index)?.classList.add("is-hot");
    }
  }

  // Reads the latest seat states after a render and animates the 3D hall to match.
  function sync(): void {
    const newlyReserved: number[] = [];
    for (let index = 0; index < total; index += 1) {
      const next = getSeat(index);
      if (next === states[index]) continue;
      if (next === "res") {
        newlyReserved.push(index);
      } else {
        tween(anim[index], { sel: next === "sel" ? 1 : 0, lit: 0, duration: 0.35, ease: "power3.out", overwrite: "auto" });
      }
      states[index] = next;
    }

    const step = Math.min(0.05, 1.6 / Math.max(1, newlyReserved.length));
    newlyReserved.forEach((index, order) => {
      tween(anim[index], { sel: 0, duration: 0.4, ease: "power2.out" });
      tween(anim[index], { lit: 1, duration: 1.1, ease: "expo.out", delay: order * step });
    });

    const open = openSeats();
    const full = open === 0;
    if (full !== wasFull) {
      wasFull = full;
      document.body.classList.toggle("is-full", full);
      hallScene?.fullHouse(full, full ? newlyReserved.length * step + 0.35 : 0);
    }
    if (open !== lastOpen) {
      lastOpen = open;
      hallScene?.drawScreen();
    }
    hintEl.textContent = full ? "Full House! Every seat in the main hall is reserved" : "Tap a seat in the hall to select it";
    if (hoverIndex >= 0) tileAt(hoverIndex)?.classList.add("is-hot");
  }

  panelEl.addEventListener("pointerover", (event) => {
    const tile = (event.target as Element).closest<HTMLElement>(".seat-button");
    setHover(tile ? indexOfTile(tile) : -1);
  });
  panelEl.addEventListener("pointerleave", () => setHover(-1));
  panelEl.addEventListener("focusin", (event) => {
    const tile = (event.target as Element).closest<HTMLElement>(".seat-button");
    if (tile) setHover(indexOfTile(tile));
  });
  panelEl.addEventListener("focusout", () => setHover(-1));
  // Escape dismisses the hall's hover tooltip (WCAG 1.4.13).
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") tipEl.hidden = true;
  });

  // Pauses or resumes every looping animation on the page and remembers the choice (WCAG 2.2.2).
  function setMotionPaused(paused: boolean): void {
    motionPaused = paused;
    motionButton.setAttribute("aria-pressed", String(paused));
    document.body.classList.toggle("motion-paused", paused);
  }
  try {
    setMotionPaused(localStorage.getItem("skylar-motion") === "paused");
  } catch {
    setMotionPaused(false);
  }
  motionButton.addEventListener("click", () => {
    const paused = !motionPaused;
    try {
      localStorage.setItem("skylar-motion", paused ? "paused" : "playing");
    } catch {
      // Motion still pauses for this visit when storage is blocked.
    }
    setMotionPaused(paused);
  });

  try {
    hallScene = buildScene({
      rows, columns, anim, states, seatId, openSeats, overlayOn, setHover, clickSeat, canvas, hallEl, sideEl, tipEl,
    });
    hallScene.resize();
    if (wasFull) hallScene.fullHouse(true, 0);
    if (!reduced()) hallScene.intro();
  } catch {
    hallEl.classList.add("no-webgl");
  }

  // Switches the seat manager between floating over the hall and docked beside it, remembering the choice.
  function setLayout(layout: "overlay" | "docked", animate: boolean): void {
    layoutEl.dataset.layout = layout;
    toggleButton.textContent = layout === "overlay" ? "Dock panel beside the hall" : "Float panel over the hall";
    hallScene?.resize();
    if (animate && !reduced()) {
      gsap.from("#side > *", { autoAlpha: 0, y: 14, duration: 0.6, ease: "power3.out", stagger: 0.06, clearProps: "opacity,visibility,transform" });
    }
  }
  let savedLayout: string | null = null;
  try {
    savedLayout = localStorage.getItem("skylar-layout");
  } catch {
    savedLayout = null;
  }
  setLayout(savedLayout === "docked" ? "docked" : "overlay", false);
  toggleButton.addEventListener("click", () => {
    const next = layoutEl.dataset.layout === "overlay" ? "docked" : "overlay";
    try {
      localStorage.setItem("skylar-layout", next);
    } catch {
      // Layout still switches for this visit when storage is blocked.
    }
    setLayout(next, true);
  });
  wideQuery.addEventListener("change", () => hallScene?.resize());

  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    gsap.from(".marquee .mask > span", { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.09, delay: 0.25 });
  });

  return { sync };
}

// Builds the three.js auditorium: room, stadium rows, seats that light up when reserved, projector and screen.
function buildScene(context: SceneContext): HallScene {
  const { rows, columns, anim, states, seatId, openSeats, overlayOn, setHover, clickSeat, canvas, hallEl, sideEl, tipEl } = context;
  const total = rows * columns;
  // Quality tier: phones and low-core machines skip shadows, MSAA, dust and two downlights.
  const LOW = window.matchMedia("(max-width: 959px)").matches || (navigator.hardwareConcurrency || 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !LOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050203);
  scene.fog = new THREE.Fog(0x050203, 24, 48);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);

  /* ---------- Procedural textures ---------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  // Paints a repeating texture on a canvas.
  function canvasTex(
    size: number,
    draw: (g: CanvasRenderingContext2D, s: number) => void,
    opts: { srgb?: boolean; repeat?: [number, number] } = {},
  ): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d")!, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const [rx, ry] = opts.repeat ?? [1, 1];
    t.repeat.set(rx, ry);
    t.anisotropy = Math.min(8, maxAniso);
    if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // Adds random noise to a canvas so surfaces don't look flat.
  function grain(g: CanvasRenderingContext2D, s: number, amp: number): void {
    const img = g.getImageData(0, 0, s, s);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }
  const fabricBump = canvasTex(256, (g, s) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { g.fillStyle = "rgba(255,255,255,.10)"; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 2) { g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(x, 0, 1, s); }
    grain(g, s, 46);
  }, { repeat: [3, 3] });
  const carpetMap = canvasTex(512, (g, s) => {
    g.fillStyle = "#3d0b13"; g.fillRect(0, 0, s, s);
    const step = 64;
    for (let y = 0; y <= s; y += step) {
      for (let x = -step; x <= s + step; x += step) {
        const ox = (y / step) % 2 ? step / 2 : 0;
        g.save(); g.translate(x + ox, y); g.rotate(Math.PI / 4);
        g.strokeStyle = "rgba(14,2,5,.6)"; g.lineWidth = 3; g.strokeRect(-13, -13, 26, 26);
        g.restore();
        g.fillStyle = "rgba(150,44,52,.35)"; g.beginPath(); g.arc(x + ox, y, 3.5, 0, Math.PI * 2); g.fill();
      }
    }
    grain(g, s, 28);
  }, { srgb: true, repeat: [6, 12] });
  const carpetBump = canvasTex(256, (g, s) => { g.fillStyle = "#808080"; g.fillRect(0, 0, s, s); grain(g, s, 90); }, { repeat: [12, 24] });
  const wallMap = canvasTex(256, (g, s) => { g.fillStyle = "#150a0c"; g.fillRect(0, 0, s, s); grain(g, s, 12); }, { srgb: true, repeat: [8, 3] });
  const ceilMap = canvasTex(256, (g, s) => {
    g.fillStyle = "#0d0708"; g.fillRect(0, 0, s, s);
    g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s);
    g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(0, 3, s, 1); g.fillRect(3, 0, 1, s);
    grain(g, s, 10);
  }, { srgb: true, repeat: [8, 16] });
  const RADIAL = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  /* ---------- Materials ---------- */
  const velvet = (hex: number, extra: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color: hex, roughness: 0.86, sheen: 1, sheenRoughness: 0.38, sheenColor: new THREE.Color(0xff4f5a),
      bumpMap: fabricBump, bumpScale: 1.2, envMapIntensity: 0.05, ...extra,
    });
  const seatMat = velvet(0xffffff);
  const panelMat = velvet(0x3e0a11, { sheenColor: new THREE.Color(0xa0303a) });
  const curtainMat = velvet(0x5e0812, { side: THREE.DoubleSide, sheenColor: new THREE.Color(0xff3a48), sheenRoughness: 0.32 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0f0809, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.18 });
  const carpet = new THREE.MeshStandardMaterial({ map: carpetMap, roughness: 1, bumpMap: carpetBump, bumpScale: 1.4, envMapIntensity: 0.02 });
  const nosing = new THREE.MeshStandardMaterial({ color: 0x0b0607, roughness: 0.6, envMapIntensity: 0.1 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, envMapIntensity: 0.03 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilMap, roughness: 1, envMapIntensity: 0.02 });
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x140909, roughness: 0.3, envMapIntensity: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa89a94, roughness: 0.3, metalness: 1, envMapIntensity: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x020101, roughness: 0.9 });
  const glowMat = (color: THREE.ColorRepresentation, map: THREE.Texture | null = null): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ color, map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  // Adds a mesh to the scene at a position and rotation.
  const add = (
    geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
    rx = 0, ry = 0, opts: { cast?: boolean; receive?: boolean } = {},
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (opts.cast) m.castShadow = true;
    if (opts.receive) m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const dummy = new THREE.Object3D();
  const R = { receive: true };

  /* ---------- Lights ---------- */
  const hemi = new THREE.HemisphereLight(0x5c3537, 0x0a0304, 0.55);
  scene.add(hemi);
  const PRE = new THREE.Color(0xd8d2e6);
  const FULLC = new THREE.Color(0xff4630);
  const screenLight = new THREE.RectAreaLight(PRE.clone(), 1.5, 11, 4.8);
  screenLight.position.set(0, 3.9, -14.85);
  screenLight.lookAt(0, 3.9, 0);
  scene.add(screenLight);
  const sconceLights: THREE.PointLight[] = [];
  [-1, 1].forEach((side) => [-10.5, -2.5].forEach((z) => {
    const p = new THREE.PointLight(0xffa25a, 7, 0, 2);
    p.position.set(side * 6.75, 3.5, z);
    scene.add(p);
    sconceLights.push(p);
  }));
  const spots: THREE.SpotLight[] = [];
  const spotDefs: [number, number][] = LOW ? [[0.6, -1.2]] : [[-2.4, -4.2], [0.8, -1.0], [-1.2, 2.4]];
  spotDefs.forEach(([x, z], k) => {
    const s = new THREE.SpotLight(0xffe0c0, 42, 0, 0.4, 0.9, 2);
    s.position.set(x, 7.5, z);
    s.target.position.set(x, 0, z + 0.3);
    scene.add(s, s.target);
    if (!LOW && k === 1) {
      s.castShadow = true;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.bias = -0.0005; s.shadow.normalBias = 0.02; s.shadow.radius = 4;
      s.shadow.camera.near = 1; s.shadow.camera.far = 12;
    }
    spots.push(s);
  });

  /* ---------- Room shell ---------- */
  const W = 14.4, D = 28, CZ = -1.5, CEIL = 7.6, BACK = CZ + D / 2;
  add(new THREE.PlaneGeometry(W, D), carpet, 0, 0, CZ, -Math.PI / 2, 0, R);
  add(new THREE.PlaneGeometry(W, D), ceilMat, 0, CEIL, CZ, Math.PI / 2);
  add(new THREE.PlaneGeometry(D, CEIL), wallMat, -W / 2, CEIL / 2, CZ, 0, Math.PI / 2, R);
  add(new THREE.PlaneGeometry(D, CEIL), wallMat, W / 2, CEIL / 2, CZ, 0, -Math.PI / 2, R);
  add(new THREE.PlaneGeometry(W, CEIL), wallMat, 0, CEIL / 2, -15.2);
  add(new THREE.PlaneGeometry(W, CEIL), wallMat, 0, CEIL / 2, BACK, 0, Math.PI);

  // Padded wall panels, sconces and their wash
  const panelGeo = new RoundedBoxGeometry(0.12, 5.0, 1.3, 3, 0.05);
  const WASH_RED = new THREE.Color(0.55, 0.06, 0.06);
  const WASH_GOLD = new THREE.Color(0.75, 0.38, 0.12);
  const washMat = glowMat(WASH_RED.clone(), RADIAL);
  const plateGeo = new RoundedBoxGeometry(0.04, 0.7, 0.26, 2, 0.015);
  const shadeGeo = new RoundedBoxGeometry(0.16, 0.56, 0.2, 3, 0.05);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffc68a, emissiveIntensity: 3.2 });
  const washGeo = new THREE.PlaneGeometry(1.5, 3.8);
  [-1, 1].forEach((side) => {
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    [-12.5, -8.5, -4.5, -0.5, 3.5, 7.5].forEach((z) => add(panelGeo, panelMat, side * 7.14, 3.3, z, 0, 0, R));
    [-10.5, -6.5, -2.5, 1.5, 5.5].forEach((z) => {
      add(plateGeo, metal, side * 7.17, 3.5, z);
      add(shadeGeo, shadeMat, side * 7.07, 3.5, z);
      add(washGeo, washMat, side * 7.12, 3.5, z, 0, ry);
    });
  });

  // Exit door and lit sign on the front-left wall
  add(new THREE.BoxGeometry(0.06, 2.2, 1.15), new THREE.MeshStandardMaterial({ color: 0x0c0809, roughness: 0.55, envMapIntensity: 0.2 }), -7.16, 1.1, -11.6);
  add(new THREE.BoxGeometry(0.03, 0.05, 0.9), metal, -7.11, 1.05, -11.6);
  const exitTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 96;
    const g = c.getContext("2d")!;
    g.fillStyle = "#071a0e"; g.fillRect(0, 0, 256, 96);
    g.fillStyle = "#6dffa0"; g.font = "700 64px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("EXIT", 128, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  add(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: exitTex, color: new THREE.Color(1.6, 1.6, 1.6) }), -7.12, 2.55, -11.6, 0, Math.PI / 2);

  // Ceiling downlight cans
  const canGeo = new THREE.CircleGeometry(0.12, 20);
  const canMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.7, 2.3), fog: false });
  [-4.2, 0, 4.2].forEach((x) => [-11, -6.5, -2, 2.5, 7].forEach((z) => add(canGeo, canMat, x, CEIL - 0.01, z, Math.PI / 2)));

  // Screen wall: stage, masking, screen, curtains, valance
  add(new THREE.BoxGeometry(13.4, 0.7, 1.8), stageMat, 0, 0.35, -14.25, 0, 0, R);
  add(new THREE.BoxGeometry(13.4, 0.04, 0.05), glowMat(new THREE.Color(0.7, 0.06, 0.09)), 0, 0.69, -13.33);
  add(new THREE.BoxGeometry(11.9, 5.6, 0.1), black, 0, 3.9, -15.08);
  const screenGlowMat = glowMat(new THREE.Color(0.16, 0.14, 0.16), RADIAL);
  add(new THREE.PlaneGeometry(17, 9), screenGlowMat, 0, 3.9, -15.14);

  const SW = 1600, SH = 700;
  const sCanvas = document.createElement("canvas");
  sCanvas.width = SW; sCanvas.height = SH;
  const sctx = sCanvas.getContext("2d")!;
  const screenTex = new THREE.CanvasTexture(sCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = Math.min(8, maxAniso);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, fog: false });
  add(new THREE.PlaneGeometry(11, 4.8), screenMat, 0, 3.9, -15.0);

  const curtainGeo = new THREE.PlaneGeometry(1.9, 7.3, 64, 1);
  const cp = curtainGeo.attributes.position;
  for (let k = 0; k < cp.count; k++) {
    const x = cp.getX(k);
    cp.setZ(k, Math.sin(x * 7.5) * 0.11 + Math.sin(x * 19 + 1.3) * 0.035);
  }
  curtainGeo.computeVertexNormals();
  add(curtainGeo, curtainMat, -6.4, 3.65, -14.75, 0, 0, R);
  add(curtainGeo, curtainMat, 6.4, 3.65, -14.75, 0, 0, R);
  add(new THREE.BoxGeometry(W, 0.8, 0.4), velvet(0x2a060b), 0, CEIL - 0.4, -14.7);
  add(new THREE.BoxGeometry(12.2, 0.025, 0.02), glowMat(new THREE.Color(1.4, 0.14, 0.2)), 0, CEIL - 0.82, -14.49);

  /* ---------- Stadium rows with a stepped aisle (A nearest the screen) ---------- */
  const ROW_Z0 = -6.4, ROW_DZ = 1.3, RISE = 0.3;
  const rowY = (r: number): number => 0.06 + r * RISE;
  const rowZ = (r: number): number => ROW_Z0 + r * ROW_DZ;
  const AISLE_L = 4.75, AISLE_R = 5.95, AISLE_X = (AISLE_L + AISLE_R) / 2, AISLE_W = AISLE_R - AISLE_L;
  const stripMat = glowMat(new THREE.Color(0.75, 0.05, 0.08));
  const stripGeo = new THREE.BoxGeometry(AISLE_W - 0.2, 0.012, 0.025);
  const nosingGeo = new THREE.BoxGeometry(W, 0.03, 0.05);
  for (let r = 0; r < rows; r++) {
    const h = rowY(r), z0 = rowZ(r) - 0.55, z1 = rowZ(r) + 0.75, zc = (z0 + z1) / 2;
    const leftW = AISLE_L + W / 2, rightW = W / 2 - AISLE_R;
    add(new THREE.BoxGeometry(leftW, h, ROW_DZ), carpet, -W / 2 + leftW / 2, h / 2, zc, 0, 0, R);
    add(new THREE.BoxGeometry(rightW, h, ROW_DZ), carpet, AISLE_R + rightW / 2, h / 2, zc, 0, 0, R);
    // Aisle: half-step at the front, full step at the back
    const half = Math.max(0.03, h - RISE / 2);
    add(new THREE.BoxGeometry(AISLE_W, half, ROW_DZ / 2), carpet, AISLE_X, half / 2, z0 + ROW_DZ / 4, 0, 0, R);
    add(new THREE.BoxGeometry(AISLE_W, h, ROW_DZ / 2), carpet, AISLE_X, h / 2, z1 - ROW_DZ / 4, 0, 0, R);
    add(stripGeo, stripMat, AISLE_X, half + 0.01, z0 + 0.04);
    add(stripGeo, stripMat, AISLE_X, h + 0.01, z0 + ROW_DZ / 2 + 0.04);
    add(nosingGeo, nosing, 0, h + 0.012, z0 + 0.02);
  }
  const landH = rowY(rows - 1), landZ0 = rowZ(rows - 1) + 0.75;
  add(new THREE.BoxGeometry(W, landH, BACK - landZ0), carpet, 0, landH / 2, (landZ0 + BACK) / 2, 0, 0, R);

  // Handrail beside the aisle
  const railA = new THREE.Vector3(AISLE_R + 0.08, rowY(0) + 0.95, rowZ(0) - 0.5);
  const railB = new THREE.Vector3(AISLE_R + 0.08, rowY(rows - 1) + 0.95, rowZ(rows - 1) + 0.6);
  const rail = add(new THREE.CylinderGeometry(0.025, 0.025, railA.distanceTo(railB), 12), metal, (railA.x + railB.x) / 2, (railA.y + railB.y) / 2, (railA.z + railB.z) / 2);
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), railB.clone().sub(railA).normalize());
  [0, 3, rows - 1].forEach((r) => add(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 10), metal, AISLE_R + 0.08, rowY(r) + 0.475, rowZ(r)));

  /* ---------- Seats (instanced) ---------- */
  const TILT = 0.14;
  const cushions = new THREE.InstancedMesh(new RoundedBoxGeometry(0.62, 0.17, 0.56, 3, 0.07), seatMat, total);
  const backs = new THREE.InstancedMesh(new RoundedBoxGeometry(0.64, 0.84, 0.17, 3, 0.075), seatMat, total);
  const strips = new THREE.InstancedMesh(new RoundedBoxGeometry(0.54, 0.026, 0.045, 2, 0.011), glowMat(0xffffff), total);
  const backGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 1.4), glowMat(0xffffff, RADIAL), total);
  const floorGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.05, 0.95), glowMat(0xffffff, RADIAL), total);
  const contact = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.0, 1.1), new THREE.MeshBasicMaterial({ color: 0x000000, map: RADIAL, transparent: true, opacity: 0.7, depthWrite: false }), total);
  const ARMS = rows * (columns + 1);
  const arms = new THREE.InstancedMesh(new RoundedBoxGeometry(0.08, 0.5, 0.6, 2, 0.03), plastic, ARMS);
  const armPads = new THREE.InstancedMesh(new RoundedBoxGeometry(0.11, 0.05, 0.64, 2, 0.02), plastic, ARMS);
  const cups = new THREE.InstancedMesh(new THREE.CircleGeometry(0.042, 18), new THREE.MeshBasicMaterial({ color: 0x010000 }), ARMS);

  const seatX = (c: number): number => (c - (columns - 1) / 2) * 0.86;
  const zero = new THREE.Color(0, 0, 0);
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / columns), x = seatX(i % columns), y = rowY(r), z = rowZ(r);
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(x, y + 0.44, z); dummy.updateMatrix(); cushions.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(TILT, 0, 0);
    dummy.position.set(x, y + 0.86, z + 0.3); dummy.updateMatrix(); backs.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 0.86 + 0.42 * Math.cos(TILT) + 0.01, z + 0.3 + 0.42 * Math.sin(TILT)); dummy.updateMatrix(); strips.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 0.9, z + 0.41); dummy.updateMatrix(); backGlow.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.position.set(x, y + 0.014, z + 0.6); dummy.updateMatrix(); floorGlow.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 0.008, z + 0.12); dummy.updateMatrix(); contact.setMatrixAt(i, dummy.matrix);
    [cushions, backs, strips, backGlow, floorGlow].forEach((m) => m.setColorAt(i, zero));
  }
  let armIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= columns; c++) {
      const x = (c - columns / 2) * 0.86, y = rowY(r), z = rowZ(r);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y + 0.27, z); dummy.updateMatrix(); arms.setMatrixAt(armIndex, dummy.matrix);
      dummy.position.set(x, y + 0.545, z + 0.01); dummy.updateMatrix(); armPads.setMatrixAt(armIndex, dummy.matrix);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.position.set(x, y + 0.5715, z - 0.2); dummy.updateMatrix(); cups.setMatrixAt(armIndex, dummy.matrix);
      armIndex++;
    }
  }
  [cushions, backs, arms, armPads].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  // Per-seat glow from inside the velvet: an instanced 'lit' value feeds the material's emissive term
  const litC = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
  const litB = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
  cushions.geometry.setAttribute("instanceLit", litC);
  backs.geometry.setAttribute("instanceLit", litB);
  seatMat.onBeforeCompile = (sh) => {
    sh.vertexShader = "attribute float instanceLit;\nvarying float vLit;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vLit = instanceLit;");
    sh.fragmentShader = "varying float vLit;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(0.085, 0.006, 0.004) * vLit;");
  };
  [contact, cushions, backs, arms, armPads, cups, backGlow, floorGlow, strips].forEach((m) => scene.add(m));

  // Linear-space colours
  const VELVET = new THREE.Color(0.42, 0.024, 0.036), WARM = new THREE.Color(0.5, 0.035, 0.03);
  const GOLD = [1.0, 0.55, 0.18], RED = [1.0, 0.07, 0.09];
  const tmp = new THREE.Color();
  // Colours every seat from its lit (reserved), selected and hover values; selected seats gently pulse.
  function paintSeats(t: number): void {
    const still = reduced();
    for (let i = 0; i < total; i++) {
      const s = anim[i];
      const pulse = still ? 1 : 0.7 + 0.3 * Math.sin(t * 3.4 + i * 0.37);
      const sp = s.sel * pulse;
      tmp.copy(VELVET).lerp(WARM, s.lit);
      tmp.r += s.hov * 0.06 + sp * 0.12; tmp.g += s.hov * 0.03; tmp.b += s.hov * 0.03;
      cushions.setColorAt(i, tmp); backs.setColorAt(i, tmp);
      litC.array[i] = litB.array[i] = s.lit + sp * 0.6 + s.hov * 0.25;
      const k1 = s.lit * 1.2, k2 = sp * 1.6, k3 = s.hov * 0.9;
      strips.setColorAt(i, tmp.setRGB(GOLD[0] * k1 + RED[0] * k2 + k3, GOLD[1] * k1 + RED[1] * k2 + k3, GOLD[2] * k1 + RED[2] * k2 + k3));
      const g1 = s.lit * 0.035, g2 = sp * 0.02, g3 = s.hov * 0.015;
      backGlow.setColorAt(i, tmp.setRGB(GOLD[0] * g1 + RED[0] * g2 + g3, GOLD[1] * g1 + RED[1] * g2 + g3, GOLD[2] * g1 + RED[2] * g2 + g3));
      const f1 = s.lit * 0.035, f2 = s.sel * 0.025;
      floorGlow.setColorAt(i, tmp.setRGB(GOLD[0] * f1 + RED[0] * f2, GOLD[1] * f1 + RED[1] * f2, GOLD[2] * f1 + RED[2] * f2));
    }
    [cushions, backs, strips, backGlow, floorGlow].forEach((m) => { m.instanceColor!.needsUpdate = true; });
    litC.needsUpdate = litB.needsUpdate = true;
  }

  /* ---------- Projector beam and dust ---------- */
  const PROJ = new THREE.Vector3(0, 6.5, BACK - 0.2), SCREEN_C = new THREE.Vector3(0, 3.9, -14.9);
  const beamLen = PROJ.distanceTo(SCREEN_C);
  const BEAM_PRE = new THREE.Color(0.8, 0.82, 1.0), BEAM_FULL = new THREE.Color(1.0, 0.5, 0.26);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: BEAM_PRE.clone() }, uIntensity: { value: 0.16 } },
    vertexShader: "varying vec3 vN; varying vec3 vV; varying float vT;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vT = uv.y; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; varying float vT;\nvoid main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.2) * uIntensity * (0.3 + 0.7 * vT) * smoothstep(0.0, 0.04, 1.0 - vT) * smoothstep(0.0, 0.1, vT); gl_FragColor = vec4(uColor * a, 1.0); }",
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true), beamMat);
  beam.position.copy(PROJ).add(SCREEN_C).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), PROJ.clone().sub(SCREEN_C).normalize());
  beam.scale.set(5.2, beamLen, 2.2);
  beam.renderOrder = 2;
  scene.add(beam);

  let dust: THREE.Points | null = null;
  let dustBase = new Float32Array(0);
  let dustPhase = new Float32Array(0);
  if (!LOW) {
    const DN = 260;
    dustBase = new Float32Array(DN * 3);
    dustPhase = new Float32Array(DN);
    const axis = SCREEN_C.clone().sub(PROJ);
    for (let k = 0; k < DN; k++) {
      const t = 0.15 + Math.random() * 0.75, ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.85;
      const p = PROJ.clone().addScaledVector(axis, t);
      dustBase[k * 3] = p.x + Math.cos(ang) * rr * 5.2 * t;
      dustBase[k * 3 + 1] = p.y + Math.sin(ang) * rr * 2.2 * t;
      dustBase[k * 3 + 2] = p.z;
      dustPhase[k] = Math.random() * 100;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dustBase.slice(), 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.03, map: RADIAL, color: new THREE.Color(1.3, 1.2, 1.1), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(dust);
  }

  /* ---------- Screen content ---------- */
  let mode: "pre" | "full" = "pre";
  let bulbPhase = 0;
  let lastBulb = 0;
  const bulbs: [number, number][] = [];
  const inset = 50, gap = 52;
  for (let x = inset; x <= SW - inset; x += gap) { bulbs.push([x, inset]); bulbs.push([x, SH - inset]); }
  for (let y = inset + gap; y < SH - inset; y += gap) { bulbs.push([inset, y]); bulbs.push([SW - inset, y]); }
  bulbs.sort((p, q) => Math.atan2(p[1] - SH / 2, p[0] - SW / 2) - Math.atan2(q[1] - SH / 2, q[0] - SW / 2));
  const spaced = (g: CanvasRenderingContext2D, px: string): void => { if ("letterSpacing" in g) g.letterSpacing = px; };
  // Draws the cinema screen: open seat count while seating, or a marquee "Full House!" when every seat is reserved.
  function drawScreen(): void {
    const g = sctx;
    g.save();
    g.clearRect(0, 0, SW, SH);
    g.textAlign = "center"; g.textBaseline = "middle";
    const open = openSeats();
    if (mode === "full") {
      const bg = g.createRadialGradient(SW / 2, SH / 2, 40, SW / 2, SH / 2, SW * 0.62);
      bg.addColorStop(0, "#9a1424"); bg.addColorStop(0.55, "#40070d"); bg.addColorStop(1, "#1c0306");
      g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
      bulbs.forEach(([x, y], k) => {
        const on = (k + bulbPhase) % 3 === 0;
        g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2);
        g.shadowColor = "#ffc977"; g.shadowBlur = on ? 26 : 0;
        g.fillStyle = on ? "#fff0c8" : "#5a2a14"; g.fill();
      });
      g.shadowBlur = 40; g.shadowColor = "rgba(255,170,80,.65)";
      const tg = g.createLinearGradient(0, 230, 0, 470);
      tg.addColorStop(0, "#fff4d8"); tg.addColorStop(0.55, "#ffcf80"); tg.addColorStop(1, "#f0a048");
      g.fillStyle = tg;
      g.font = 'italic 700 236px "Bodoni Moda", Didot, Georgia, serif';
      spaced(g, "0px");
      g.fillText("Full House!", SW / 2, 345);
      g.shadowBlur = 0;
      g.fillStyle = "#ffdfae";
      g.font = '500 36px "DM Mono", ui-monospace, monospace';
      spaced(g, "8px");
      g.fillText(`ALL ${total} SEATS RESERVED · MAIN HALL`, SW / 2, 535);
    } else {
      const bg = g.createLinearGradient(0, 0, 0, SH);
      bg.addColorStop(0, "#24151a"); bg.addColorStop(1, "#150c0f");
      g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
      const hot = g.createRadialGradient(SW / 2, SH * 0.45, 20, SW / 2, SH * 0.45, SW * 0.5);
      hot.addColorStop(0, "rgba(255,228,210,.1)"); hot.addColorStop(1, "rgba(255,228,210,0)");
      g.fillStyle = hot; g.fillRect(0, 0, SW, SH);
      g.strokeStyle = "rgba(255,201,119,.3)"; g.lineWidth = 3;
      g.strokeRect(46, 46, SW - 92, SH - 92);
      g.fillStyle = "#ffcd80";
      g.font = '500 34px "DM Mono", ui-monospace, monospace';
      spaced(g, "10px");
      g.fillText("NOW SEATING · MAIN HALL", SW / 2, 210);
      g.fillStyle = "#f8ece2";
      g.font = 'italic 600 188px "Bodoni Moda", Didot, Georgia, serif';
      spaced(g, "0px");
      g.fillText(open === 1 ? "1 seat open" : `${open} seats open`, SW / 2, 370);
      g.fillStyle = "#bba29a";
      g.font = '400 40px "Hanken Grotesk", system-ui, sans-serif';
      g.fillText("Reserved seats light up in the hall", SW / 2, 520);
    }
    g.restore();
    screenTex.needsUpdate = true;
  }
  drawScreen();
  Promise.all([
    document.fonts.load('italic 600 100px "Bodoni Moda"'),
    document.fonts.load('italic 700 100px "Bodoni Moda"'),
    document.fonts.load('500 30px "DM Mono"'),
    document.fonts.load('400 30px "Hanken Grotesk"'),
  ]).then(drawScreen, drawScreen);

  const screenBright = { b: 1 };
  const applyScreen = (): void => { screenMat.color.setScalar(screenBright.b); };
  const fh = { v: 0 };
  const SG_PRE = new THREE.Color(0.16, 0.14, 0.16), SG_FULL = new THREE.Color(0.7, 0.16, 0.08);
  const lerp = (x: number, y: number, t: number): number => x + (y - x) * t;
  // Blends the hall lighting between normal seating and the warm full-house look.
  function applyFH(): void {
    const v = fh.v;
    hemi.intensity = lerp(0.55, 0.34, v);
    spots.forEach((s) => { s.intensity = lerp(42, 16, v); });
    sconceLights.forEach((p) => { p.intensity = lerp(7, 5, v); });
    screenLight.color.copy(PRE).lerp(FULLC, v);
    screenLight.intensity = lerp(1.5, 3.0, v) * screenBright.b;
    washMat.color.copy(WASH_RED).lerp(WASH_GOLD, v);
    screenGlowMat.color.copy(SG_PRE).lerp(SG_FULL, v);
    beamMat.uniforms.uColor.value.copy(BEAM_PRE).lerp(BEAM_FULL, v);
    beamMat.uniforms.uIntensity.value = lerp(0.16, 0.22, v) * screenBright.b;
  }
  applyFH();

  /* ---------- Camera: back-right corner, above the aisle ---------- */
  const BASE = { x: 4.3, y: 4.6, z: 5.4, tx: -1.5, ty: 1.0, tz: -12 };
  const START = { x: 6.2, y: 6.4, z: 11.5, tx: -1, ty: 1.4, tz: -8 };
  const cam = { ...BASE };
  const pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  const look = new THREE.Vector3();

  // Dims the screen, swaps it to the full-house marquee (or back) and moves the camera in.
  function fullHouse(on: boolean, delay: number): void {
    if (reduced()) {
      mode = on ? "full" : "pre"; drawScreen();
      fh.v = on ? 1 : 0; screenBright.b = 1; applyScreen(); applyFH();
      cam.z = on ? BASE.z - 0.9 : BASE.z; cam.y = on ? BASE.y - 0.15 : BASE.y;
      return;
    }
    gsap.killTweensOf([screenBright, fh]);
    const upd = (): void => { applyScreen(); applyFH(); };
    gsap.timeline({ delay })
      .to(screenBright, { b: 0.06, duration: 0.35, ease: "power2.in", onUpdate: upd })
      .add(() => { mode = on ? "full" : "pre"; drawScreen(); })
      .to(screenBright, { b: 1, duration: 0.9, ease: "expo.out", onUpdate: upd })
      .to(fh, { v: on ? 1 : 0, duration: 1.8, ease: "power3.out", onUpdate: upd }, "<")
      .to(cam, { z: on ? BASE.z - 0.9 : BASE.z, y: on ? BASE.y - 0.15 : BASE.y, duration: 2.2, ease: "power3.inOut" }, "<");
  }

  /* ---------- Post: HDR render -> bloom -> ACES + sRGB ---------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), LOW ? 0.3 : 0.36, 0.4, 1.0));
  composer.addPass(new OutputPass());

  /* ---------- Picking ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // Returns the seat index under the pointer, or -1 if the pointer is not over a seat.
  function pick(event: PointerEvent | MouseEvent): number {
    const r = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([backs, cushions], false)[0];
    return hit && hit.instanceId != null ? hit.instanceId : -1;
  }
  canvas.addEventListener("pointermove", (event) => {
    const r = hallEl.getBoundingClientRect();
    pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((event.clientY - r.top) / r.height) * 2 - 1;
    const i = pick(event);
    setHover(i);
    canvas.style.cursor = i >= 0 ? (states[i] === "res" ? "not-allowed" : "pointer") : "default";
    if (i >= 0 && event.pointerType === "mouse") {
      const label = states[i] === "res" ? "Reserved" : states[i] === "sel" ? "Selected" : "Available";
      tipEl.innerHTML = `<b>${seatId(i)}</b> · ${label}`;
      tipEl.hidden = false;
      const x = Math.min(event.clientX - r.left + 14, r.width - tipEl.offsetWidth - 8);
      const y = Math.min(event.clientY - r.top + 16, r.height - tipEl.offsetHeight - 8);
      tipEl.style.left = `${x}px`;
      tipEl.style.top = `${y}px`;
    } else {
      tipEl.hidden = true;
    }
  });
  canvas.addEventListener("pointerleave", () => { tipEl.hidden = true; setHover(-1); pointer.x = pointer.y = 0; });
  canvas.addEventListener("click", (event) => { const i = pick(event); if (i >= 0) clickSeat(i); });

  /* ---------- Size, visibility, loop ---------- */
  // Fits the renderer to the hall and shifts the view left of the floating panel in overlay mode.
  function resize(): void {
    const w = hallEl.clientWidth, h = hallEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const s = overlayOn() ? Math.round((sideEl.offsetWidth + 22) / 2) : 0;
    const visAspect = Math.max(0.5, (w - 2 * s) / h);
    camera.fov = visAspect >= 1.3 ? 42 : Math.min(64, 42 + (1.3 - visAspect) * 28);
    camera.aspect = (w + 2 * s) / h;
    if (s > 0) camera.setViewOffset(w + 2 * s, h, 2 * s, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => resize()).observe(hallEl);
  resize();
  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(hallEl);

  // Renders one frame: camera drift, seat colours, floating dust and the full-house bulbs.
  function tick(): void {
    if (!visible || document.hidden) return;
    const t = performance.now() / 1000;
    const still = reduced();
    smooth.x += ((still ? 0 : pointer.x) - smooth.x) * 0.05;
    smooth.y += ((still ? 0 : pointer.y) - smooth.y) * 0.05;
    camera.position.set(cam.x + smooth.x * 0.45, cam.y - smooth.y * 0.2, cam.z);
    look.set(cam.tx + smooth.x * 0.9, cam.ty - smooth.y * 0.3, cam.tz);
    camera.lookAt(look);
    paintSeats(t);
    if (dust && !still) {
      const pos = dust.geometry.attributes.position.array as Float32Array;
      for (let k = 0; k < dustPhase.length; k++) {
        const ph = dustPhase[k];
        pos[k * 3] = dustBase[k * 3] + Math.sin(t * 0.11 + ph) * 0.18;
        pos[k * 3 + 1] = dustBase[k * 3 + 1] + Math.sin(t * 0.08 + ph * 1.7) * 0.14;
        pos[k * 3 + 2] = dustBase[k * 3 + 2] + Math.cos(t * 0.06 + ph) * 0.2;
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    if (mode === "full" && !still && t - lastBulb > 0.16) { bulbPhase++; lastBulb = t; drawScreen(); }
    composer.render();
  }
  gsap.ticker.add(tick);

  // Sweeps the camera in from the back of the hall and fades the screen up when the page opens.
  function intro(): void {
    Object.assign(cam, START);
    gsap.to(cam, { ...BASE, duration: 2.8, ease: "expo.out", delay: 0.1 });
    screenBright.b = 0; applyScreen(); applyFH();
    gsap.to(screenBright, { b: 1, duration: 1.6, ease: "power2.out", delay: 0.7, onUpdate: () => { applyScreen(); applyFH(); } });
  }

  return { drawScreen, fullHouse, intro, resize };
}
