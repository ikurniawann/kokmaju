/**
 * Scene 3D KoMa Twin — coffee shop isometrik low-poly (three.js). Imperatif &
 * mandiri dari React: halaman memberi snapshot + peristiwa, scene mengurus
 * render, animasi orang/kendaraan, pin label (DOM) dan pemilihan area.
 *
 * Tata letak (meter, depan = +z): jalan di depan, pintu & pickup ojol kanan
 * depan, area duduk kiri, kasir tengah-kanan, bar & dapur di belakang, gudang
 * kanan belakang + dock penerimaan di sisi kanan, ruang HRD/Marketing/Finance
 * kiri belakang.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TwinEvent } from "@/lib/bcd-twin/events";
import type { TwinSnapshot } from "@/lib/bcd-twin/types";
import { summarizeZone, ZONES, type ZoneId, type ZoneStatus } from "@/lib/bcd-twin/zones";

type Palette = {
  sky: number; ground: number; street: number; sidewalk: number; floor: number; wall: number; trim: number;
  wood: number; woodDark: number; top: number; steel: number; accent: number; leaf: number; glass: number;
};

const LIGHT: Palette = {
  sky: 0xf3ece3, ground: 0xe9dfd2, street: 0xc9beb1, sidewalk: 0xe0d4c4, floor: 0xd8b88f, wall: 0xf7f0e6,
  trim: 0x5b3a29, wood: 0xa8774f, woodDark: 0x6b4430, top: 0xf1e6d6, steel: 0xb8c0c4, accent: 0xfd4835,
  leaf: 0x6f9a62, glass: 0xbcd7e4,
};
const DARK: Palette = {
  sky: 0x17120f, ground: 0x221a15, street: 0x2e2620, sidewalk: 0x2a211b, floor: 0x4a3426, wall: 0x2f251e,
  trim: 0xc89b6a, wood: 0x7a5236, woodDark: 0x4b2f20, top: 0x3a2e25, steel: 0x6d777c, accent: 0x7f86ff,
  leaf: 0x4f7a47, glass: 0x35505d,
};

const STATUS_COLOR: Record<ZoneStatus, number> = { ok: 0x22a35a, warn: 0xe19a1c, bad: 0xd64545, idle: 0x9aa3a8 };

/** Jangkar label & titik fokus kamera tiap area. */
const ZONE_ANCHOR: Record<ZoneId, [number, number, number]> = {
  seating: [-13, 3, 3],
  kasir: [9, 3.4, 0.5],
  bar: [2, 4.2, -10],
  gofood: [19, 2.6, 9],
  gudang: [20, 4.6, -9],
  procurement: [31, 3.6, -9],
  // Kantor berderet rapat → tinggi label bertingkat supaya tidak menumpuk.
  hrd: [-23, 7.4, -12],
  marketing: [-17, 5.6, -11],
  finance: [-11, 3.8, -10],
};

type Mover = {
  group: THREE.Group;
  path: THREE.Vector3[];
  speed: number;
  wait: number;
  after?: () => void;
  onArrive?: () => void;
  dead?: boolean;
};

type Floater = { el: HTMLElement; pos: THREE.Vector3; life: number };

export type CafeSceneOptions = { onSelect: (zone: ZoneId | null) => void; reducedMotion?: boolean };

export class CafeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
  private controls: OrbitControls;
  private hemi = new THREE.HemisphereLight(0xffffff, 0xb9a48f, 1.4);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private palette: Palette = LIGHT;
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  private themed: { key: keyof Palette; mat: THREE.MeshLambertMaterial }[] = [];
  private pickables: THREE.Object3D[] = [];
  private zoneLights = new Map<ZoneId, THREE.MeshLambertMaterial>();
  private zoneSlabs = new Map<ZoneId, THREE.Mesh>();
  private tableTops: THREE.MeshLambertMaterial[] = [];
  private pins = new Map<ZoneId, HTMLButtonElement>();
  private movers: Mover[] = [];
  private floaters: Floater[] = [];
  private steam: THREE.Mesh[] = [];
  private selectFill: THREE.Mesh;
  private selectEdge: THREE.LineSegments;
  private selected: ZoneId | null = null;
  private tween: { t0: THREE.Vector3; p0: THREE.Vector3; t1: THREE.Vector3; p1: THREE.Vector3; k: number; dur: number } | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private seatSpots: THREE.Vector3[] = [];
  private seatIndex = 0;
  private truck: THREE.Group | null = null;
  private truckBusy = false;
  // Target digeser ke kanan → bangunan tampil di area kiri, tidak tertutup panel detail.
  private readonly home = { t: new THREE.Vector3(11, 0, -3), p: new THREE.Vector3(44, 66, 84) };

  constructor(
    private container: HTMLElement,
    private labels: HTMLElement,
    private options: CafeSceneOptions
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.28;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 190;
    this.controls.screenSpacePanning = false;
    this.camera.position.copy(this.home.p);
    this.controls.target.copy(this.home.t);

    this.scene.add(this.hemi);
    this.sun.position.set(-40, 80, 50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 10, far: 220 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.3;
    this.scene.add(this.sun);

    // Sorotan area terpilih: lantai berwarna aksen tipis + garis tepi.
    this.selectFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xfd4835, transparent: true, opacity: 0.16, depthWrite: false })
    );
    this.selectFill.rotation.x = -Math.PI / 2;
    this.selectFill.visible = false;
    this.scene.add(this.selectFill);
    this.selectEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color: 0xfd4835 })
    );
    this.selectEdge.rotation.x = -Math.PI / 2;
    this.selectEdge.visible = false;
    this.scene.add(this.selectEdge);

    this.build();
    this.applyTheme();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointerup", this.onPointerUp);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ build
  private mat(key: keyof Palette): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color: this.palette[key] });
    this.themed.push({ key, mat: m });
    return m;
  }

  private color(hex: number): THREE.MeshLambertMaterial {
    const k = String(hex);
    if (!this.mats.has(k)) this.mats.set(k, new THREE.MeshLambertMaterial({ color: hex }));
    return this.mats.get(k)!;
  }

  private box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private cyl(r1: number, r2: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene, seg = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private tagZone(obj: THREE.Object3D, zone: ZoneId) {
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.userData.zone = zone;
        this.pickables.push(o);
      }
    });
  }

  private signTexture(text: string, bg: string, fg: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = fg;
    ctx.font = "800 64px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private person(shirt: number, parent: THREE.Object3D = this.scene) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), this.color(shirt));
    body.position.y = 0.75;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), this.color(0xe0b896));
    head.position.y = 1.55;
    head.castShadow = true;
    g.add(body, head);
    parent.add(g);
    return g;
  }

  private build() {
    const p = this.palette;
    void p;
    // Tanah, jalan, trotoar
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.mat("ground"));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.box(140, 0.05, 7, this.mat("street"), 0, 0, 16.5, this.scene, false);
    this.box(9, 0.05, 60, this.mat("street"), 40, 0, -8, this.scene, false);
    for (let x = -60; x < 60; x += 5) this.box(2.2, 0.02, 0.22, this.color(0xffffff), x, 0.05, 16.5, this.scene, false);
    this.box(64, 0.12, 3, this.mat("sidewalk"), 3, 0, 11.5, this.scene, false);

    // Lantai bangunan
    const floor = this.box(54, 0.2, 26, this.mat("floor"), 0, 0, -2.5);
    floor.castShadow = false;

    // Dinding (potongan "rumah boneka": belakang tinggi, samping rendah, depan kaca)
    const wall = this.mat("wall");
    this.box(54, 5, 0.5, wall, 0, 0.2, -15.25);
    this.box(0.5, 5, 26, wall, -26.75, 0.2, -2.5);
    this.box(0.5, 2.2, 26, wall, 26.75, 0.2, -2.5);
    this.box(54, 0.35, 0.6, this.mat("trim"), 0, 5.2, -15.2);
    // Kaca depan + pintu (celah x 6..12)
    const glass = new THREE.MeshLambertMaterial({ color: this.palette.glass, transparent: true, opacity: 0.35 });
    this.themed.push({ key: "glass", mat: glass });
    this.box(32, 2.4, 0.15, glass, -11, 0.2, 10.25, this.scene, false);
    this.box(14, 2.4, 0.15, glass, 20, 0.2, 10.25, this.scene, false);
    this.box(0.4, 2.6, 0.4, this.mat("trim"), 6, 0.2, 10.25);
    this.box(0.4, 2.6, 0.4, this.mat("trim"), 12, 0.2, 10.25);
    // Kanopi + papan nama
    this.box(20, 0.35, 2.2, this.mat("trim"), 9, 3.2, 11);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: this.signTexture("GEROBAK KOMA", "#fd4835", "#ffffff") })
    );
    sign.position.set(9, 4.6, 11.2);
    this.scene.add(sign);

    // Sekat ruang belakang kiri (HRD | Marketing | Finance) & gudang
    this.box(0.3, 2.6, 9, wall, -20, 0.2, -10.5);
    this.box(0.3, 2.6, 9, wall, -14, 0.2, -10.5);
    this.box(0.3, 2.6, 9, wall, -8, 0.2, -10.5);
    this.box(18, 2.6, 0.3, wall, -17, 0.2, -6);
    this.box(0.3, 2.6, 10, wall, 13.5, 0.2, -10);
    this.box(13, 2.6, 0.3, wall, 20, 0.2, -5);

    this.buildZoneSlabs();
    this.buildSeating();
    this.buildKasir();
    this.buildBar();
    this.buildGudang();
    this.buildDock();
    this.buildOffices();
    this.buildGofood();
    this.buildStaff();
    this.buildTrees();
    this.buildPins();
  }

  private buildZoneSlabs() {
    const slabs: Record<ZoneId, [number, number, number, number]> = {
      seating: [-25.5, 2, -4, 9.6],
      kasir: [3, 15, -3.5, 4.5],
      bar: [-7.5, 13, -14.8, -6.5],
      gofood: [13, 21, 4.5, 9.6],
      gudang: [13.8, 26.4, -14.8, -5.3],
      procurement: [27.2, 35, -14, -4],
      hrd: [-26.4, -20.2, -14.8, -6.3],
      marketing: [-19.8, -14.2, -14.8, -6.3],
      finance: [-13.8, -8.2, -14.8, -6.3],
    };
    for (const zone of ZONES) {
      const [x0, x1, z0, z1] = slabs[zone.id];
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      slab.position.set((x0 + x1) / 2, 0.24, (z0 + z1) / 2);
      slab.receiveShadow = false;
      this.scene.add(slab);
      this.tagZone(slab, zone.id);
      this.zoneSlabs.set(zone.id, slab);
      // Lampu status kecil di sudut area.
      const light = new THREE.MeshLambertMaterial({ color: STATUS_COLOR.idle, emissive: STATUS_COLOR.idle, emissiveIntensity: 0.6 });
      this.zoneLights.set(zone.id, light);
      const post = this.cyl(0.08, 0.08, 1.6, this.color(0x4a4f52), x0 + 0.6, 0.2, z0 + 0.6);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), light);
      bulb.position.set(x0 + 0.6, 2, z0 + 0.6);
      this.scene.add(bulb);
      this.tagZone(post, zone.id);
      this.tagZone(bulb, zone.id);
    }
  }

  private buildSeating() {
    const g = new THREE.Group();
    this.scene.add(g);
    const chair = this.mat("woodDark");
    let i = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = -22 + col * 6;
        const z = -1 + row * 3.6;
        const topMat = new THREE.MeshLambertMaterial({ color: this.palette.wood });
        this.tableTops.push(topMat);
        if (i % 3 === 2) {
          this.cyl(0.9, 0.9, 0.12, topMat, x, 1.1, z, g, 24);
          this.cyl(0.1, 0.2, 1.1, chair, x, 0.2, z, g);
        } else {
          this.box(2, 0.12, 1.3, topMat, x, 1.1, z, g);
          this.box(0.16, 0.9, 0.16, chair, x, 0.2, z, g);
        }
        for (const dx of [-1.4, 1.4]) {
          this.box(0.6, 0.12, 0.6, chair, x + dx, 0.75, z, g);
          this.box(0.12, 0.7, 0.6, chair, x + dx * 1.18, 0.85, z, g);
          this.seatSpots.push(new THREE.Vector3(x + dx, 0, z));
        }
        i++;
      }
    }
    // Sofa panjang di dinding kiri
    this.box(1.2, 0.8, 9, this.mat("trim"), -25.6, 0.2, 2);
    this.tagZone(g, "seating");
  }

  private buildKasir() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.box(9, 1.2, 1.4, this.mat("woodDark"), 9, 0.2, -1.5, g);
    this.box(9.2, 0.14, 1.6, this.mat("top"), 9, 1.4, -1.5, g);
    // Terminal POS + layar pelanggan
    this.box(0.9, 0.6, 0.15, this.color(0x1f2428), 7.5, 1.6, -1.6, g).rotation.x = -0.3;
    this.box(0.7, 0.45, 0.12, this.color(0xfd4835), 9.5, 1.6, -1.1, g);
    // Etalase pastry
    const display = new THREE.MeshLambertMaterial({ color: this.palette.glass, transparent: true, opacity: 0.45 });
    this.box(2.4, 0.7, 1.2, display, 12, 1.55, -1.5, g, false);
    for (let k = 0; k < 4; k++) this.cyl(0.18, 0.18, 0.12, this.color(0xd9a35f), 11.2 + k * 0.55, 1.6, -1.5, g, 12);
    // Papan menu di dinding bar
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.6),
      new THREE.MeshBasicMaterial({ map: this.signTexture("MENU · KOPI", "#3b2a20", "#f3e7d4") })
    );
    board.position.set(9, 3.9, -6.3);
    this.scene.add(board);
    // Penanda antre
    for (let k = 0; k < 4; k++) this.cyl(0.12, 0.12, 0.9, this.color(0x9aa3a8), 6 + k * 1.2, 0.2, 2.6, g, 10);
    this.tagZone(g, "kasir");
  }

  private buildBar() {
    const g = new THREE.Group();
    this.scene.add(g);
    // Back bar menempel dinding + bar depan
    this.box(18, 1.1, 1.2, this.mat("woodDark"), 1.5, 0.2, -14.2, g);
    this.box(18, 0.12, 1.3, this.mat("top"), 1.5, 1.3, -14.2, g);
    this.box(15, 1.2, 1.2, this.mat("wood"), 0, 0.2, -7.2, g);
    this.box(15.2, 0.14, 1.4, this.mat("top"), 0, 1.4, -7.2, g);
    // Mesin espresso (badan baja + aksen biru BCD)
    this.box(2.6, 1.0, 1.0, this.mat("steel"), -3, 1.45, -14.2, g);
    this.box(2.6, 0.2, 1.05, this.mat("accent"), -3, 2.45, -14.2, g);
    for (const dx of [-0.7, 0.7]) this.cyl(0.12, 0.12, 0.3, this.color(0x2c3236), -3 + dx, 1.25, -13.6, g, 10);
    // Grinder
    this.cyl(0.35, 0.3, 0.9, this.color(0x2c3236), 0.2, 1.45, -14.2, g, 14);
    this.cyl(0.32, 0.18, 0.5, this.color(0x7a4b2e), 0.2, 2.35, -14.2, g, 14);
    // Kulkas susu + rak cup
    this.box(1.6, 2.6, 1.1, this.color(0xeef2f3), 9.5, 0.2, -14.1, g);
    this.box(1.5, 2.4, 0.05, new THREE.MeshLambertMaterial({ color: 0xbcd7e4, transparent: true, opacity: 0.55 }), 9.5, 0.3, -13.5, g, false);
    for (let k = 0; k < 6; k++) this.cyl(0.18, 0.14, 0.42, this.color(0xf4f1ec), -7 + k * 0.5, 1.42, -7.2, g, 12);
    // Dapur kecil (kompor & pass) di sisi kanan bar
    this.box(3, 1.1, 1.4, this.mat("steel"), 6.5, 0.2, -11, g);
    this.box(3, 0.08, 1.4, this.color(0x2c3236), 6.5, 1.3, -11, g);
    // Uap kopi
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 })
      );
      puff.position.set(-3 + (k - 1) * 0.4, 2.8 + k * 0.4, -14);
      puff.userData.phase = k / 3;
      this.scene.add(puff);
      this.steam.push(puff);
    }
    this.tagZone(g, "bar");
  }

  private buildGudang() {
    const g = new THREE.Group();
    this.scene.add(g);
    for (let r = 0; r < 3; r++) {
      const x = 16 + r * 3.2;
      this.box(0.15, 3.2, 3.8, this.color(0x7f8c92), x - 0.9, 0.2, -11.5, g);
      this.box(0.15, 3.2, 3.8, this.color(0x7f8c92), x + 0.9, 0.2, -11.5, g);
      for (let lvl = 0; lvl < 3; lvl++) {
        this.box(1.95, 0.1, 3.8, this.color(0x9aa5aa), x, 0.4 + lvl * 1.1, -11.5, g);
        for (let b = 0; b < 3; b++) this.box(0.75, 0.6, 0.9, this.color(lvl % 2 ? 0xc9a27a : 0xb9895c), x - 0.45 + (b % 2) * 0.9, 0.5 + lvl * 1.1, -12.8 + b * 1.2, g);
      }
    }
    // Chiller (pintu biru)
    this.box(3.6, 2.8, 2.6, this.color(0xf1f4f5), 23.5, 0.2, -7, g);
    this.box(1.4, 2.2, 0.08, this.mat("accent"), 23.5, 0.4, -5.66, g);
    this.tagZone(g, "gudang");
  }

  private buildDock() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.box(7, 1, 9, this.mat("sidewalk"), 31, 0, -9, g);
    for (let k = 0; k < 2; k++) this.box(0.2, 0.05, 7, this.color(0xf2c14e), 29 + k * 4, 1, -9, g, false);
    // Palet
    for (let k = 0; k < 3; k++) this.box(1.2, 0.18, 1.2, this.color(0xb08a5a), 28.6 + k * 1.5, 1, -12.5, g);
    // Pintu gulung ke gudang
    this.box(0.2, 2.4, 3.2, this.color(0x9aa5aa), 26.8, 0.2, -9.5, g);
    this.tagZone(g, "procurement");

    const truck = new THREE.Group();
    this.box(3, 2.4, 6, this.color(0xf4f1ec), 0, 0.5, 0, truck);
    this.box(3, 1.7, 2.2, this.mat("accent"), 0, 0.5, -4.1, truck);
    this.box(2.8, 0.7, 0.05, this.color(0x9fc3d3), 0, 1.5, -5.21, truck, false);
    for (const [x, z] of [[-1.5, -3.8], [1.5, -3.8], [-1.5, 1.8], [1.5, 1.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 14), this.color(0x23292c));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.45, z);
      truck.add(w);
    }
    truck.position.set(40, 0, -40);
    truck.visible = false;
    this.scene.add(truck);
    this.tagZone(truck, "procurement");
    this.truck = truck;
  }

  private buildOffices() {
    const rooms: [ZoneId, number, number][] = [
      ["hrd", -23.2, 0x4f7cc2],
      ["marketing", -17, 0xe07a5f],
      ["finance", -11, 0x3f9b6e],
    ];
    for (const [zone, x, tint] of rooms) {
      const g = new THREE.Group();
      this.scene.add(g);
      this.box(3.4, 0.1, 1.6, this.mat("top"), x, 1.1, -12, g);
      this.box(0.12, 0.9, 1.4, this.mat("woodDark"), x - 1.5, 0.2, -12, g);
      this.box(0.12, 0.9, 1.4, this.mat("woodDark"), x + 1.5, 0.2, -12, g);
      this.box(0.9, 0.6, 0.08, this.color(0x1f2428), x - 0.6, 1.25, -12.4, g);
      this.box(0.9, 0.6, 0.08, this.color(0x1f2428), x + 0.7, 1.25, -12.4, g);
      this.box(2.6, 1.4, 0.08, this.color(tint), x, 1.6, -15, g);
      this.box(1.2, 0.12, 1.2, this.mat("woodDark"), x - 0.6, 0.65, -10.6, g);
      this.box(1.2, 0.12, 1.2, this.mat("woodDark"), x + 0.8, 0.65, -10.6, g);
      const a = this.person(tint, g);
      a.position.set(x - 0.6, 0.2, -10.6);
      const b = this.person(0x8a8f93, g);
      b.position.set(x + 0.8, 0.2, -10.6);
      this.tagZone(g, zone);
    }
  }

  private buildGofood() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.box(4, 2, 0.8, this.mat("wood"), 17, 0.2, 7, g);
    for (let k = 0; k < 3; k++) this.box(0.6, 0.5, 0.5, this.color(0x2fa84f), 15.8 + k * 1.2, 1.4, 7, g);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.9),
      new THREE.MeshBasicMaterial({ map: this.signTexture("PICKUP OJOL", "#2fa84f", "#ffffff") })
    );
    sign.position.set(17, 3.3, 7.45);
    g.add(sign);
    this.tagZone(g, "gofood");
  }

  private buildStaff() {
    // Barista & kasir (diam, sedikit bergerak di loop)
    const shirts = [0xfd4835, 0xfd4835, 0x3b2a20];
    [[-3, -13.2], [2, -13.2], [5.5, -10]].forEach(([x, z], i) => {
      const b = this.person(shirts[i]);
      b.position.set(x, 0.2, z);
      b.userData.bob = i;
      this.tagZone(b, "bar");
    });
    const cashier = this.person(0xfd4835);
    cashier.position.set(8, 0.2, -2.8);
    cashier.userData.bob = 4;
    this.tagZone(cashier, "kasir");
  }

  private buildTrees() {
    const trunk = this.color(0x8a6a4f);
    const leaf = this.mat("leaf");
    [-28, -20, -8, 24, 30].forEach((x, i) => {
      this.cyl(0.2, 0.25, 1.6, trunk, x, 0, 13.2);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + (i % 2) * 0.3, 0), leaf);
      crown.position.set(x, 2.6, 13.2);
      crown.castShadow = true;
      this.scene.add(crown);
    });
    // Pot tanaman di dalam
    [[-25.5, -4.5], [1.5, 8.5], [13, 3]].forEach(([x, z]) => {
      this.cyl(0.45, 0.35, 0.7, this.color(0xc8a27c), x, 0.2, z);
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), leaf);
      plant.position.set(x, 1.5, z);
      this.scene.add(plant);
    });
  }

  private buildPins() {
    for (const zone of ZONES) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "twin-pin";
      el.innerHTML = `<span class="twin-pin-dot"></span><span class="twin-pin-name"></span><span class="twin-pin-val"></span>`;
      (el.querySelector(".twin-pin-name") as HTMLElement).textContent = zone.name;
      el.setAttribute("aria-label", `Pilih ${zone.name}`);
      el.addEventListener("click", () => this.select(zone.id, true));
      this.labels.appendChild(el);
      this.pins.set(zone.id, el);
    }
  }

  // ------------------------------------------------------------ data → scene
  setSnapshot(snapshot: TwinSnapshot) {
    for (const zone of ZONES) {
      const summary = summarizeZone(zone.id, snapshot);
      const light = this.zoneLights.get(zone.id);
      if (light) {
        light.color.setHex(STATUS_COLOR[summary.status]);
        light.emissive.setHex(STATUS_COLOR[summary.status]);
      }
      const pin = this.pins.get(zone.id);
      if (pin) {
        pin.dataset.status = summary.status;
        (pin.querySelector(".twin-pin-val") as HTMLElement).textContent = summary.headline;
      }
    }
    // Meja terisi = warna aksen; minta bill = kuning.
    const occupied = Math.min(this.tableTops.length, snapshot.tables.occupied);
    const billing = Math.min(occupied, snapshot.tables.billing);
    this.tableTops.forEach((mat, i) => {
      mat.color.setHex(i < billing ? 0xe19a1c : i < occupied ? 0xc96f3b : this.palette.wood);
    });
  }

  handleEvents(events: TwinEvent[]) {
    let delay = 0;
    for (const event of events) {
      const run = () => this.animateEvent(event);
      if (delay) window.setTimeout(run, delay);
      else run();
      delay += 450;
    }
  }

  private animateEvent(event: TwinEvent) {
    if (this.disposed) return;
    switch (event.type) {
      case "order_new":
        if (event.order.channel === "gofood") this.spawnOjol(event.order.queue);
        else this.spawnCustomer(event.order.channel === "self_order", event.order.orderType === "takeaway");
        this.floatAt("kasir", `Order ${event.order.queue ?? ""}`.trim(), "info");
        break;
      case "order_ready":
        this.floatAt("bar", `Siap · ${event.order.queue ?? event.order.number}`, "ok");
        break;
      case "order_served":
        if (event.order.channel !== "gofood") this.spawnRunner();
        break;
      case "order_paid":
        this.floatAt("kasir", `+Rp ${Math.round(event.order.total).toLocaleString("id-ID")}`, "ok");
        break;
      case "po_created":
        this.floatAt("procurement", "PO dibuat", "warn");
        break;
      case "goods_received":
        this.driveTruck();
        break;
      case "member_new":
        this.floatAt("marketing", `+${event.count} member`, "ok");
        break;
      case "staff_checkin":
        this.floatAt("hrd", `+${event.count} absen masuk`, "info");
        break;
    }
  }

  private spawnCustomer(selfOrder: boolean, takeaway: boolean) {
    const palette = [0xc96f3b, 0x6f9a62, 0x4f7cc2, 0xd9a35f, 0x8e5c9e, 0x3f9b6e];
    const person = this.person(palette[Math.floor(Math.random() * palette.length)]);
    const side = Math.random() < 0.5 ? -1 : 1;
    person.position.set(side * 40, 0.12, 14.5);
    const mover: Mover = { group: person, path: [], speed: 5.5, wait: 0 };
    const seat = this.seatSpots[this.seatIndex++ % this.seatSpots.length].clone();
    const door = [new THREE.Vector3(9, 0, 13.5), new THREE.Vector3(9, 0, 8)];
    const leave = () => this.walk(mover, [new THREE.Vector3(9, 0, 8), new THREE.Vector3(9, 0, 13.5), new THREE.Vector3(-side * 40, 0, 14.5)], () => (mover.dead = true));
    if (selfOrder) {
      // Pesan lewat QR di meja: langsung duduk.
      this.walk(mover, [...door, seat], () => {
        this.floatAtPos(seat, "Scan QR", "info");
        this.hold(mover, 26, leave);
      });
    } else {
      this.walk(mover, [...door, new THREE.Vector3(8.5, 0, 1.5)], () =>
        this.hold(mover, 4, () => (takeaway ? leave() : this.walk(mover, [seat], () => this.hold(mover, 24, leave))))
      );
    }
    this.movers.push(mover);
  }

  private spawnRunner() {
    const runner = this.person(0xfd4835);
    runner.position.set(2, 0.2, -6);
    const mover: Mover = { group: runner, path: [], speed: 6, wait: 0 };
    const seat = this.seatSpots[Math.floor(Math.random() * this.seatSpots.length)].clone().add(new THREE.Vector3(0, 0, 0.9));
    this.walk(mover, [new THREE.Vector3(2, 0, -4.5), seat], () =>
      this.hold(mover, 1.2, () => this.walk(mover, [new THREE.Vector3(2, 0, -4.5), new THREE.Vector3(2, 0, -6)], () => (mover.dead = true)))
    );
    this.movers.push(mover);
  }

  private spawnOjol(queue: string | null) {
    const bike = new THREE.Group();
    this.box(0.5, 0.5, 1.8, this.color(0x2fa84f), 0, 0.45, 0, bike);
    for (const z of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 12), this.color(0x23292c));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.35, z);
      bike.add(wheel);
    }
    const rider = this.person(0x2fa84f, bike);
    rider.position.set(0, 0.55, 0);
    bike.position.set(-45, 0.1, 15.5);
    this.scene.add(bike);
    const mover: Mover = { group: bike, path: [], speed: 13, wait: 0 };
    this.walk(mover, [new THREE.Vector3(17, 0, 15.5)], () => {
      this.floatAtPos(new THREE.Vector3(17, 0, 15.5), `Ojol · ${queue ?? "GoFood"}`, "ok");
      this.hold(mover, 18, () => this.walk(mover, [new THREE.Vector3(45, 0, 15.5)], () => (mover.dead = true)));
    });
    this.movers.push(mover);
  }

  private driveTruck() {
    const truck = this.truck;
    if (!truck || this.truckBusy) {
      this.floatAt("procurement", "Barang diterima (GRN)", "ok");
      return;
    }
    this.truckBusy = true;
    truck.visible = true;
    truck.position.set(40, 0, -48);
    truck.rotation.y = 0;
    const mover: Mover = { group: truck, path: [], speed: 9, wait: 0 };
    this.walk(mover, [new THREE.Vector3(40, 0, -9)], () => {
      this.floatAt("procurement", "Bongkar · GRN diterima", "ok");
      this.hold(mover, 6, () =>
        this.walk(mover, [new THREE.Vector3(40, 0, 30)], () => {
          truck.visible = false;
          this.truckBusy = false;
          mover.dead = true;
        })
      );
    });
    this.movers.push(mover);
  }

  private walk(m: Mover, pts: THREE.Vector3[], onArrive?: () => void) {
    m.path = pts.map((p) => p.clone());
    m.onArrive = onArrive;
  }

  private hold(m: Mover, seconds: number, after: () => void) {
    m.wait = seconds;
    m.after = after;
  }

  private floatAt(zone: ZoneId, text: string, tone: "ok" | "info" | "warn") {
    const [x, y, z] = ZONE_ANCHOR[zone];
    this.floatAtPos(new THREE.Vector3(x, y - 1.2, z), text, tone);
  }

  private floatAtPos(pos: THREE.Vector3, text: string, tone: "ok" | "info" | "warn") {
    if (this.floaters.length > 24) return;
    const el = document.createElement("div");
    el.className = `twin-floater ${tone}`;
    const span = document.createElement("span");
    span.textContent = text;
    el.appendChild(span);
    this.labels.appendChild(el);
    this.floaters.push({ el, pos: pos.clone().setY(Math.max(pos.y, 2.4)), life: 2.2 });
  }

  // ------------------------------------------------------------- interaction
  select(zone: ZoneId | null, fly = false) {
    this.selected = zone;
    for (const [id, pin] of this.pins) pin.classList.toggle("sel", id === zone);
    if (!zone) {
      this.selectFill.visible = false;
      this.selectEdge.visible = false;
    } else {
      const slab = this.zoneSlabs.get(zone)!;
      const { width, depth } = (slab.geometry as THREE.BoxGeometry).parameters;
      for (const mark of [this.selectFill, this.selectEdge]) {
        mark.scale.set(width, depth, 1);
        mark.position.set(slab.position.x, 0.32, slab.position.z);
        mark.visible = true;
      }
      if (fly) this.focus(zone);
    }
    this.options.onSelect(zone);
  }

  focus(zone: ZoneId) {
    const [x, , z] = ZONE_ANCHOR[zone];
    const target = new THREE.Vector3(x, 0, z);
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(58);
    this.tweenTo(target, target.clone().add(offset));
  }

  goHome() {
    this.tweenTo(this.home.t.clone(), this.home.p.clone());
  }

  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() * factor)));
    this.tweenTo(this.controls.target.clone(), this.controls.target.clone().add(offset), 0.4);
  }

  private tweenTo(t: THREE.Vector3, p: THREE.Vector3, dur = 0.9) {
    if (this.options.reducedMotion) {
      this.controls.target.copy(t);
      this.camera.position.copy(p);
      return;
    }
    this.tween = { t0: this.controls.target.clone(), p0: this.camera.position.clone(), t1: t, p1: p, k: 0, dur };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.pickables, false)[0];
    const zone = (hit?.object.userData.zone as ZoneId | undefined) ?? null;
    this.select(zone, Boolean(zone));
  };

  // ------------------------------------------------------------- theme/loop
  applyTheme() {
    const root = document.documentElement;
    const mode = root.getAttribute("data-theme");
    const dark = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    this.palette = dark ? DARK : LIGHT;
    for (const { key, mat } of this.themed) mat.color.setHex(this.palette[key]);
    const sky = new THREE.Color(this.palette.sky);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 140, 300);
    this.hemi.intensity = dark ? 0.7 : 1.4;
    this.sun.intensity = dark ? 1.1 : 2;
    (this.selectFill.material as THREE.MeshBasicMaterial).color.setHex(this.palette.accent);
    (this.selectEdge.material as THREE.LineBasicMaterial).color.setHex(this.palette.accent);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private step(m: Mover, dt: number) {
    if (m.wait > 0) {
      m.wait -= dt;
      if (m.wait <= 0 && m.after) {
        const after = m.after;
        m.after = undefined;
        after();
      }
      return;
    }
    const target = m.path[0];
    if (!target) return;
    const pos = m.group.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const stepLen = m.speed * dt;
    if (dist <= stepLen) {
      pos.x = target.x;
      pos.z = target.z;
      m.path.shift();
      if (!m.path.length && m.onArrive) {
        const arrive = m.onArrive;
        m.onArrive = undefined;
        arrive();
      }
      return;
    }
    pos.x += (dx / dist) * stepLen;
    pos.z += (dz / dist) * stepLen;
    m.group.rotation.y = Math.atan2(dx, dz);
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;

    if (this.tween) {
      this.tween.k = Math.min(1, this.tween.k + dt / this.tween.dur);
      const e = 1 - Math.pow(1 - this.tween.k, 3);
      this.controls.target.lerpVectors(this.tween.t0, this.tween.t1, e);
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e);
      if (this.tween.k >= 1) this.tween = null;
    }
    this.controls.update();

    for (const m of this.movers) this.step(m, dt);
    for (const m of this.movers.filter((x) => x.dead)) {
      if (m.group !== this.truck) this.scene.remove(m.group);
    }
    this.movers = this.movers.filter((m) => !m.dead);

    const t = now / 1000;
    if (!this.options.reducedMotion) {
      for (const puff of this.steam) {
        const k = (t * 0.5 + (puff.userData.phase as number)) % 1;
        puff.position.y = 2.7 + k * 1.6;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
        puff.scale.setScalar(0.6 + k);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.projectLabels(dt);
    this.raf = requestAnimationFrame(this.loop);
  };

  private projectLabels(dt: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const zone of ZONES) {
      const pin = this.pins.get(zone.id);
      if (!pin) continue;
      const [x, y, z] = ZONE_ANCHOR[zone.id];
      v.set(x, y, z).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      pin.style.display = visible ? "" : "none";
      pin.style.transform = `translate(${((v.x + 1) / 2) * rect.width}px, ${((1 - v.y) / 2) * rect.height}px) translate(-50%, -100%)`;
    }
    for (const f of this.floaters) {
      f.life -= dt;
      f.pos.y += dt * 0.8;
      v.copy(f.pos).project(this.camera);
      f.el.style.transform = `translate(${((v.x + 1) / 2) * rect.width}px, ${((1 - v.y) / 2) * rect.height}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(Math.max(0, Math.min(1, f.life / 0.6)));
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        (Array.isArray(material) ? material : [material]).forEach((m) => {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    el.remove();
    this.labels.innerHTML = "";
  }
}
