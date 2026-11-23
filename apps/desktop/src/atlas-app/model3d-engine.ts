import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Model3DPreset } from "./media-helpers";

let cachedSoftwareGl: boolean | null = null;

/**
 * Detects software WebGL rasterizers (SwiftShader, llvmpipe, WARP) from the GPU renderer string
 * so we only adjust rendering cost (AA, pixel ratio, shadows, pacing) while keeping scene identical.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === "undefined") {
    cachedSoftwareGl = true;
    return true;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      gpu,
    );
  } catch {
    cachedSoftwareGl = true;
  }
  return cachedSoftwareGl;
}

/**
 * Helper to register an explode-view offset on a mesh/group while preserving its resting base position.
 */
function tagPart(
  obj: THREE.Object3D,
  explodeVec: [number, number, number],
): THREE.Object3D {
  obj.userData.basePosition = obj.position.clone();
  obj.userData.explodeOffset = new THREE.Vector3(
    explodeVec[0],
    explodeVec[1],
    explodeVec[2],
  );
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return obj;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw, hh);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

/**
 * Builds a procedural radial soft contact-shadow texture so every 3D model sits grounded on the studio floor.
 */
export function createContactShadowPlane(radius = 2.5): THREE.Mesh {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48,
    );
    grad.addColorStop(0, "rgba(0, 0, 0, 0.34)");
    grad.addColorStop(0.55, "rgba(0, 0, 0, 0.12)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    mat,
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.004;
  return plane;
}

/**
 * 10-part composite industrial Leica-style rangefinder assembly (grounded at y = 0).
 */
function buildOpticalCamera(): THREE.Group {
  const root = new THREE.Group();

  const matteBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d1e22,
    roughness: 0.78,
    metalness: 0.08,
  });
  const anodizedTopMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c32,
    roughness: 0.28,
    metalness: 0.88,
    clearcoat: 0.2,
  });
  const brushedSilverMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce2,
    roughness: 0.22,
    metalness: 0.94,
  });
  const lensMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x16171a,
    roughness: 0.32,
    metalness: 0.85,
  });
  const coatedGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a3b5c,
    roughness: 0.06,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
  });
  const accentRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.28,
    metalness: 0.15,
  });

  // 1. Primary vulcanite body chassis (ExtrudeGeometry with bevels)
  const bodyShape = createRoundedRectShape(2.18, 1.02, 0.24);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.62,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4,
  });
  bodyGeo.center();
  const bodyMesh = new THREE.Mesh(bodyGeo, matteBodyMat);
  bodyMesh.position.set(0, 0.72, 0);
  root.add(tagPart(bodyMesh, [0, 0, -0.35]));

  // 2. Machined top deck plate
  const topShape = createRoundedRectShape(2.2, 0.26, 0.12);
  const topGeo = new THREE.ExtrudeGeometry(topShape, {
    depth: 0.64,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  topGeo.center();
  const topPlate = new THREE.Mesh(topGeo, anodizedTopMat);
  topPlate.position.set(0, 1.32, 0);
  root.add(tagPart(topPlate, [0, 0.55, 0]));

  // 3. Machined baseplate (sits flush on y = 0)
  const basePlate = new THREE.Mesh(topGeo.clone(), anodizedTopMat);
  basePlate.scale.set(1, 0.62, 1);
  basePlate.position.set(0, 0.11, 0);
  root.add(tagPart(basePlate, [0, -0.32, 0]));

  // 4. Stepped precision lens barrel (LatheGeometry)
  const barrelPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.56, 0.0),
    new THREE.Vector2(0.56, 0.12),
    new THREE.Vector2(0.5, 0.14),
    new THREE.Vector2(0.5, 0.42),
    new THREE.Vector2(0.47, 0.44),
    new THREE.Vector2(0.47, 0.68),
    new THREE.Vector2(0.41, 0.7),
    new THREE.Vector2(0.39, 0.58),
  ];
  const barrelGeo = new THREE.LatheGeometry(barrelPoints, 48);
  const barrel = new THREE.Mesh(barrelGeo, lensMetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.08, 0.68, 0.32);
  root.add(tagPart(barrel, [0, 0, 0.65]));

  // 5. Brushed silver bayonet mount ring
  const mountRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.53, 0.042, 18, 48),
    brushedSilverMat,
  );
  mountRing.position.set(0.08, 0.68, 0.43);
  root.add(tagPart(mountRing, [0, 0, 0.38]));

  // 6. Precision aperture focus ring
  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.515, 0.515, 0.14, 48, 1, true),
    brushedSilverMat,
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0.08, 0.68, 0.66);
  root.add(tagPart(focusRing, [0, 0, 0.88]));

  // 7. Curved multi-coated front optical lens element
  const lensGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.36),
    coatedGlassMat,
  );
  lensGlass.rotation.x = Math.PI / 2;
  lensGlass.position.set(0.08, 0.68, 0.64);
  root.add(tagPart(lensGlass, [0, 0, 1.15]));

  // 8. Brightline rangefinder viewfinder window
  const vfWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.19, 0.08),
    coatedGlassMat,
  );
  vfWindow.position.set(0.68, 1.32, 0.33);
  root.add(tagPart(vfWindow, [0.22, 0.62, 0.32]));

  // 9. Machined shutter speed dial + shutter release button
  const dialGroup = new THREE.Group();
  const shutterDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.17, 0.13, 32),
    brushedSilverMat,
  );
  const shutterBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.16, 24),
    brushedSilverMat,
  );
  shutterBtn.position.set(0.32, 0.04, 0.02);
  dialGroup.add(shutterDial, shutterBtn);
  dialGroup.position.set(-0.62, 1.52, 0.04);
  root.add(tagPart(dialGroup, [-0.35, 0.88, 0]));

  // 10. Signature red focal emblem dot
  const redDot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.035, 28),
    accentRedMat,
  );
  redDot.rotation.x = Math.PI / 2;
  redDot.position.set(-0.66, 1.12, 0.35);
  root.add(tagPart(redDot, [-0.4, 0.25, 0.45]));

  return root;
}

/**
 * 11-part Dieter Rams inspired industrial audio turntable (grounded at y = 0).
 */
function buildBraunTurntable(): THREE.Group {
  const root = new THREE.Group();

  const brushedAlumMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6e8ec,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.18,
  });
  const warmWhiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f3ef,
    roughness: 0.56,
    metalness: 0.04,
  });
  const charcoalMat = new THREE.MeshStandardMaterial({
    color: 0x222327,
    roughness: 0.72,
    metalness: 0.12,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f4f8,
    roughness: 0.14,
    metalness: 0.96,
  });
  const orangeAccentMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.34,
    metalness: 0.1,
  });

  // 1. Isolation rubber feet (4 feet seated flush at y = 0)
  const feetGroup = new THREE.Group();
  const footGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.08, 24);
  const footOffsets: [number, number][] = [
    [-0.95, -0.72],
    [0.95, -0.72],
    [-0.95, 0.72],
    [0.95, 0.72],
  ];
  for (const [fx, fz] of footOffsets) {
    const foot = new THREE.Mesh(footGeo, charcoalMat);
    foot.position.set(fx, 0.04, fz);
    feetGroup.add(foot);
  }
  root.add(tagPart(feetGroup, [0, -0.35, 0]));

  // 2. Main beveled plinth chassis
  const plinthShape = createRoundedRectShape(2.42, 1.88, 0.14);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  plinthGeo.rotateX(Math.PI / 2);
  plinthGeo.center();
  const plinth = new THREE.Mesh(plinthGeo, warmWhiteMat);
  plinth.position.set(0, 0.22, 0);
  root.add(tagPart(plinth, [0, -0.1, 0]));

  // 3. Brushed aluminum top deck inset
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.26, 0.04, 1.72),
    brushedAlumMat,
  );
  deck.position.set(0, 0.37, 0);
  root.add(tagPart(deck, [0, 0.18, 0]));

  // 4. Machined aluminum platter
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.77, 0.11, 64),
    chromeMat,
  );
  platter.position.set(-0.24, 0.45, -0.04);
  root.add(tagPart(platter, [-0.18, 0.45, 0]));

  // 5. Matte acoustic rubber slipmat + concentric groove ring
  const matDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.71, 0.71, 0.03, 56),
    charcoalMat,
  );
  matDisc.position.set(-0.24, 0.52, -0.04);
  root.add(tagPart(matDisc, [-0.18, 0.74, 0]));

  // 6. Center orange vinyl label + steel spindle
  const labelGroup = new THREE.Group();
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.015, 36),
    orangeAccentMat,
  );
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.14, 18),
    chromeMat,
  );
  spindle.position.y = 0.06;
  labelGroup.add(label, spindle);
  labelGroup.position.set(-0.24, 0.545, -0.04);
  root.add(tagPart(labelGroup, [-0.18, 1.02, 0]));

  // 7. Tonearm gimbal pedestal
  const gimbal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.21, 0.2, 32),
    charcoalMat,
  );
  gimbal.position.set(0.84, 0.49, -0.46);
  root.add(tagPart(gimbal, [0.42, 0.35, -0.22]));

  // 8. Precision S-curved TubeGeometry tonearm
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.84, 0.61, -0.66),
    new THREE.Vector3(0.84, 0.61, -0.46),
    new THREE.Vector3(0.82, 0.6, 0.04),
    new THREE.Vector3(0.71, 0.58, 0.38),
    new THREE.Vector3(0.56, 0.56, 0.54),
  ]);
  const tonearm = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 36, 0.024, 14, false),
    chromeMat,
  );
  root.add(tagPart(tonearm, [0.52, 0.68, 0.12]));

  // 9. Counterweight cylinder
  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24),
    brushedAlumMat,
  );
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.set(0.84, 0.61, -0.66);
  root.add(tagPart(counterweight, [0.55, 0.68, -0.45]));

  // 10. Angled headshell & orange phono cartridge
  const headshell = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.065, 0.22),
    charcoalMat,
  );
  headshell.position.set(0.52, 0.55, 0.59);
  headshell.rotation.y = 0.55;
  root.add(tagPart(headshell, [0.35, 0.72, 0.45]));

  // 11. Front tactile speed selector + pitch knob
  const controlsGroup = new THREE.Group();
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.095, 0.09, 28),
    charcoalMat,
  );
  knob.position.set(0.84, 0.43, 0.62);
  const startCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.05, 0.09),
    orangeAccentMat,
  );
  startCap.position.set(-0.88, 0.41, 0.66);
  controlsGroup.add(knob, startCap);
  root.add(tagPart(controlsGroup, [0, 0.45, 0.42]));

  return root;
}

/**
 * 6-part fluted architectural vessel on a travertine exhibition plinth (grounded at y = 0).
 */
function buildSculpturalVessel(): THREE.Group {
  const root = new THREE.Group();

  const travertineMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd3,
    roughness: 0.84,
    metalness: 0.02,
  });
  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b4856,
    roughness: 0.26,
    metalness: 0.14,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6b06b,
    roughness: 0.2,
    metalness: 0.94,
  });
  const innerGlazeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc26a4a,
    roughness: 0.18,
    metalness: 0.06,
    clearcoat: 0.8,
  });

  // 1. Beveled stone exhibition plinth (flush on y = 0)
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.0, 0.22, 48),
    travertineMat,
  );
  plinth.position.y = 0.11;
  root.add(tagPart(plinth, [0, -0.35, 0]));

  // 2. Lathe-turned sculptural vessel body
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.68, 0.32),
    new THREE.Vector2(0.76, 0.72),
    new THREE.Vector2(0.62, 1.15),
    new THREE.Vector2(0.36, 1.44),
    new THREE.Vector2(0.44, 1.62),
    new THREE.Vector2(0.39, 1.62),
    new THREE.Vector2(0.31, 1.42),
  ];
  const vessel = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 56),
    ceramicMat,
  );
  vessel.position.y = 0.22;
  root.add(tagPart(vessel, [0, 0.12, 0]));

  // 3. Brushed brass waist collar ring
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.038, 18, 56),
    brassMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.96;
  root.add(tagPart(collar, [0, 0.35, 0.35]));

  // 4. Brushed brass upper neck band
  const neckRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.385, 0.032, 16, 48),
    brassMat,
  );
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.y = 1.65;
  root.add(tagPart(neckRing, [0, 0.72, 0]));

  // 5. Recessed terracotta glazed mouth insert
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.26, 0.18, 36),
    innerGlazeMat,
  );
  mouth.position.y = 1.72;
  root.add(tagPart(mouth, [0, 1.05, 0]));

  // 6. Floating sculptural brass halo sphere accent beside neck
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 28, 20),
    brassMat,
  );
  finial.position.set(0.62, 1.48, 0.22);
  root.add(tagPart(finial, [0.48, 0.65, 0.32]));

  return root;
}

export function buildCompositeModel(preset: Model3DPreset): THREE.Group {
  if (preset === "braun-turntable") return buildBraunTurntable();
  if (preset === "sculptural-vessel") return buildSculpturalVessel();
  return buildOpticalCamera();
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        for (const val of Object.values(m)) {
          if (val && typeof val === "object" && "isTexture" in val) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

// Shared offscreen studio thumbnail cache (uses ONE temporary WebGL renderer on demand, zero context leak!)
const thumbnailCache = new Map<string, string>();

export function renderModelThumbnail(
  preset: Model3DPreset,
  theme: "light" | "dark",
): string | null {
  const key = `${preset}:${theme}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  try {
    const isSoftware = detectSoftwareWebGL();
    const width = 560;
    const height = 420;
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftware,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const bgHex = theme === "dark" ? 0x222327 : 0xf1f2f5;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 9, 18);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(
      theme === "dark" ? 0xdbeafe : 0xf8fafc,
      theme === "dark" ? 0x18181b : 0xd6d3d1,
      0.85,
    );
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(4.5, 6.5, 5.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
    rimLight.position.set(-4.2, 3.8, -4.5);
    scene.add(rimLight);

    const model = buildCompositeModel(preset);
    model.rotation.y = preset === "braun-turntable" ? -0.45 : -0.35;
    scene.add(model);

    const shadowPlane = createContactShadowPlane(2.35);
    scene.add(shadowPlane);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    if (preset === "braun-turntable") {
      camera.position.set(2.35, 2.15, 2.95);
      camera.lookAt(0, 0.35, 0);
    } else if (preset === "sculptural-vessel") {
      camera.position.set(2.2, 1.85, 3.25);
      camera.lookAt(0, 0.9, 0);
    } else {
      camera.position.set(1.9, 1.45, 3.35);
      camera.lookAt(0, 0.72, 0);
    }

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL("image/png");

    // Clean up all GPU resources immediately
    disposeObject3D(model);
    disposeObject3D(shadowPlane);
    envTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();

    thumbnailCache.set(key, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}
