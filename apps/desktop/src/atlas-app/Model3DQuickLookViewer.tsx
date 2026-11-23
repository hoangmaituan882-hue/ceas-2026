import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { HERO_MOTION_EASE } from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import { formatCompactCount } from "./media-helpers";
import {
  buildCompositeModel,
  createContactShadowPlane,
  detectSoftwareWebGL,
  disposeObject3D,
} from "./model3d-engine";
import type { LibraryItem, ThemeMode } from "./library-engine";

export interface Model3DQuickLookViewerProps {
  item: LibraryItem;
  theme: ThemeMode;
  locale: AppLocale;
  /** Final QuickLook stage dimensions so WebGL allocates once at destination resolution instead of reallocating every animation frame. */
  targetWidth?: number;
  targetHeight?: number;
  /** Invoked once after the first real WebGL frame renders so QuickLook cross-dissolves seamlessly without blank frames. */
  onFirstFrameReady?: () => void;
}

type RenderStyle = "pbr" | "clay" | "wireframe";
type StudioLighting = "studio" | "warm" | "dramatic";

const _targetVec = new THREE.Vector3();

export function Model3DQuickLookViewer({
  item,
  theme,
  locale,
  targetWidth,
  targetHeight,
  onFirstFrameReady,
}: Model3DQuickLookViewerProps) {
  const m = getMessages(locale);
  const meta = item.modelMeta!;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onFirstFrameReadyRef = useRef(onFirstFrameReady);
  onFirstFrameReadyRef.current = onFirstFrameReady;

  const [renderStyle, setRenderStyle] = useState<RenderStyle>("pbr");
  const [lighting, setLighting] = useState<StudioLighting>("studio");
  const [explode, setExplode] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const stateRef = useRef({
    renderStyle,
    lighting,
    explodeTarget: explode,
    explodeCurrent: 0,
    autoRotate,
    theme,
  });
  const resetCameraFnRef = useRef<(() => void) | null>(null);
  const triggerRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current.renderStyle = renderStyle;
    stateRef.current.lighting = lighting;
    stateRef.current.explodeTarget = explode;
    stateRef.current.autoRotate = autoRotate;
    stateRef.current.theme = theme;
    triggerRenderRef.current?.();
  }, [renderStyle, lighting, explode, autoRotate, theme]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglUnavailable(true);
      onFirstFrameReadyRef.current?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = Math.max(320, Math.round(targetWidth ?? container.clientWidth));
    const initialH = Math.max(260, Math.round(targetHeight ?? container.clientHeight));
    renderer.setSize(initialW, initialH, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      34,
      initialW / initialH,
      0.1,
      60,
    );

    const defaultCamPos =
      meta.preset === "braun-turntable"
        ? new THREE.Vector3(2.7, 2.4, 3.3)
        : meta.preset === "sculptural-vessel"
          ? new THREE.Vector3(2.5, 2.0, 3.7)
          : new THREE.Vector3(2.55, 1.8, 4.35);
    const defaultTarget =
      meta.preset === "braun-turntable"
        ? new THREE.Vector3(0, 0.3, 0)
        : meta.preset === "sculptural-vessel"
          ? new THREE.Vector3(0, 0.85, 0)
          : new THREE.Vector3(0, 0.58, 0);

    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.6;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
    controls.autoRotateSpeed = 1.15;
    controls.update();

    // Three-point studio rig
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 0.85);
    const keyLight = new THREE.DirectionalLight(0xfff6eb, 2.2);
    keyLight.position.set(4.5, 6.8, 5.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 3;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
    rimLight.position.set(-4.2, 3.8, -4.5);
    scene.add(hemiLight, keyLight, rimLight);

    const shadowPlane = createContactShadowPlane(2.6);
    scene.add(shadowPlane);

    const clayMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8dce3,
      roughness: 0.62,
      metalness: 0.04,
    });
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
      wireframe: true,
    });

    const originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
    let modelGroup: THREE.Object3D = buildCompositeModel(meta.preset);

    const registerMaterials = (root: THREE.Object3D) => {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          originalMaterials.set(mesh, mesh.material);
        }
      });
    };
    registerMaterials(modelGroup);
    scene.add(modelGroup);

    // Optional real local .glb/.gltf/.obj model loader when user drops a real 3D file
    let disposed = false;
    if (meta.modelUrl) {
      const ext = item.filename.split(".").pop()?.toLowerCase() ?? "";
      const replaceModel = (loaded: THREE.Object3D) => {
        if (disposed) {
          disposeObject3D(loaded);
          return;
        }
        // Center & normalize loaded model to sit cleanly on studio floor y = 0
        const box = new THREE.Box3().setFromObject(loaded);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 2.0 / maxDim;
        loaded.scale.setScalar(scale);
        const scaledBox = new THREE.Box3().setFromObject(loaded);
        const center = scaledBox.getCenter(new THREE.Vector3());
        loaded.position.x -= center.x;
        loaded.position.z -= center.z;
        loaded.position.y -= scaledBox.min.y;

        scene.remove(modelGroup);
        disposeObject3D(modelGroup);
        modelGroup = loaded;
        registerMaterials(modelGroup);
        scene.add(modelGroup);
        requestRender();
      };

      if (ext === "obj") {
        new OBJLoader().load(meta.modelUrl, replaceModel, undefined, () => {});
      } else if (ext === "glb" || ext === "gltf") {
        new GLTFLoader().load(
          meta.modelUrl,
          (gltf) => replaceModel(gltf.scene),
          undefined,
          () => {},
        );
      }
    }

    const applySceneSettings = (dt: number): boolean => {
      const s = stateRef.current;
      const isDark = s.theme === "dark";

      // Background + horizon-matched fog + lighting temperature
      let bgHex = isDark ? 0x1d1e22 : 0xf1f2f5;
      if (s.lighting === "warm") {
        bgHex = isDark ? 0x221d1a : 0xf5efe6;
        keyLight.color.setHex(0xffd7a8);
        keyLight.intensity = 2.55;
        hemiLight.color.setHex(0xfff0db);
        hemiLight.intensity = 0.72;
        rimLight.color.setHex(0xfb923c);
        rimLight.intensity = 0.95;
      } else if (s.lighting === "dramatic") {
        bgHex = 0x13151a;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 2.9;
        hemiLight.color.setHex(0x334155);
        hemiLight.intensity = 0.38;
        rimLight.color.setHex(0x38bdf8);
        rimLight.intensity = 1.95;
      } else {
        keyLight.color.setHex(0xfff6eb);
        keyLight.intensity = 2.2;
        hemiLight.color.setHex(isDark ? 0xdbeafe : 0xf8fafc);
        hemiLight.intensity = 0.85;
        rimLight.color.setHex(0x93c5fd);
        rimLight.intensity = 1.15;
      }

      if (!scene.background || (scene.background as THREE.Color).getHex() !== bgHex) {
        scene.background = new THREE.Color(bgHex);
        scene.fog = new THREE.Fog(bgHex, 9, 20);
      }

      // Material finish mode
      modelGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (s.renderStyle === "clay") {
          mesh.material = clayMaterial;
        } else if (s.renderStyle === "wireframe") {
          mesh.material = wireMaterial;
        } else {
          const orig = originalMaterials.get(mesh);
          if (orig) mesh.material = orig;
        }
      });

      // Smooth exponential damping for Exploded View
      const prevExplode = s.explodeCurrent;
      s.explodeCurrent = THREE.MathUtils.damp(
        s.explodeCurrent,
        s.explodeTarget,
        8.5,
        dt,
      );
      if (Math.abs(s.explodeCurrent - s.explodeTarget) < 0.001) {
        s.explodeCurrent = s.explodeTarget;
      }
      const explodeActive = Math.abs(s.explodeCurrent - prevExplode) > 0.0002;

      for (const child of modelGroup.children) {
        const base = child.userData.basePosition as THREE.Vector3 | undefined;
        const offset = child.userData.explodeOffset as THREE.Vector3 | undefined;
        if (base && offset) {
          _targetVec.copy(base).addScaledVector(offset, s.explodeCurrent);
          child.position.copy(_targetVec);
        }
      }

      controls.autoRotate = !isSoftwareGl && s.autoRotate;
      return explodeActive || controls.autoRotate;
    };

    // Coalesced on-demand render + software-WebGL afterDraw pacing (per threejs/SKILL.md)
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let firstFrameNotified = false;
    let lastTime = performance.now();
    let currentRenderW = initialW;
    let currentRenderH = initialH;
    let pendingW: number | null = null;
    let pendingH: number | null = null;
    let resizeDebounceTimer = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Apply any pending viewport resize atomically right before rendering so the WebGL
        // drawing buffer is NEVER cleared without an immediate paint in the same frame!
        if (pendingW !== null && pendingH !== null) {
          if (pendingW !== currentRenderW || pendingH !== currentRenderH) {
            currentRenderW = pendingW;
            currentRenderH = pendingH;
            camera.aspect = currentRenderW / currentRenderH;
            camera.updateProjectionMatrix();
            renderer.setSize(currentRenderW, currentRenderH, false);
          }
          pendingW = null;
          pendingH = null;
        }

        const keepGoing = applySceneSettings(dt);
        controls.update();
        renderer.render(scene, camera);

        if (!firstFrameNotified) {
          firstFrameNotified = true;
          onFirstFrameReadyRef.current?.();
        }

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || keepGoing)) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    triggerRenderRef.current = requestRender;
    resetCameraFnRef.current = () => {
      camera.position.copy(defaultCamPos);
      controls.target.copy(defaultTarget);
      controls.update();
      requestRender();
    };

    controls.addEventListener("change", requestRender);

    // Debounce ResizeObserver slightly so the 360ms hero flight scales smoothly via CSS
    // without thrashing WebGL framebuffer reallocation on every single animation frame.
    const onResize = () => {
      if (disposed) return;
      window.clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = window.setTimeout(() => {
        if (disposed) return;
        const w = Math.max(320, Math.round(container.clientWidth));
        const h = Math.max(260, Math.round(container.clientHeight));
        if (Math.abs(w - currentRenderW) > 2 || Math.abs(h - currentRenderH) > 2) {
          pendingW = w;
          pendingH = h;
          requestRender();
        }
      }, 90);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.clearTimeout(resizeDebounceTimer);
      ro.disconnect();
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeObject3D(modelGroup);
      disposeObject3D(shadowPlane);
      clayMaterial.dispose();
      wireMaterial.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      triggerRenderRef.current = null;
      resetCameraFnRef.current = null;
    };
  }, [item.filename, meta.modelUrl, meta.preset]);

  return (
    <div
      className="ql-model3d-stage"
      data-testid="ql-model3d-viewer"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} className="ql-model3d-canvas-mount" />

      {webglUnavailable && (
        <div className="ql-model3d-fallback">
          <strong>3D WebGL Preview</strong>
          <span>{item.filename}</span>
        </div>
      )}

      {/* Minimal Top-Left Static Spec Strip (No pulsating dots, no backdrop-filter over WebGL) */}
      <motion.div
        className="ql-model3d-spec"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.08, ease: HERO_MOTION_EASE }}
      >
        <span>{meta.format}</span>
        <span aria-hidden="true">·</span>
        <span>{formatCompactCount(meta.vertices)} {m.modelVerts}</span>
        <span aria-hidden="true">·</span>
        <span>{formatCompactCount(meta.triangles)} {m.modelTris}</span>
        <span aria-hidden="true">·</span>
        <span>{meta.fileSize}</span>
      </motion.div>

      {/* Unified Collapsible Bottom HUD Dock (Zero viewport occlusion, solid/rgba backing) */}
      <motion.div
        className={`ql-model3d-hud-wrap ${hudCollapsed ? "ql-model3d-hud-wrap--collapsed" : ""}`}
        initial={{ opacity: 0, x: "-50%", y: 12 }}
        animate={{ opacity: 1, x: "-50%", y: 0 }}
        transition={{ duration: 0.28, delay: 0.12, ease: HERO_MOTION_EASE }}
      >
        <button
          type="button"
          className="ql-model3d-hud-toggle"
          onClick={() => setHudCollapsed((v) => !v)}
          data-testid="ql-model3d-hud-toggle"
        >
          {hudCollapsed ? `▴ ${m.modelShowControls}` : `▾ ${m.modelHideControls}`}
        </button>

        {!hudCollapsed && (
          <div className="ql-model3d-hud" data-testid="ql-model3d-hud">
            {/* Material Mode */}
            <div className="ql-model3d-seg">
              {(["pbr", "clay", "wireframe"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  data-testid={`ql-model3d-style-${style}`}
                  className={`ql-model3d-seg-btn ${renderStyle === style ? "ql-model3d-seg-btn--active" : ""}`}
                  onClick={() => setRenderStyle(style)}
                >
                  {style === "pbr"
                    ? m.modelMatPbr
                    : style === "clay"
                      ? m.modelMatClay
                      : m.modelMatWire}
                </button>
              ))}
            </div>

            <span className="ql-model3d-sep" />

            {/* Studio Lighting */}
            <div className="ql-model3d-seg">
              {(["studio", "warm", "dramatic"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-testid={`ql-model3d-light-${preset}`}
                  className={`ql-model3d-seg-btn ${lighting === preset ? "ql-model3d-seg-btn--active" : ""}`}
                  onClick={() => setLighting(preset)}
                >
                  {preset === "studio"
                    ? m.modelLightStudio
                    : preset === "warm"
                      ? m.modelLightWarm
                      : m.modelLightDramatic}
                </button>
              ))}
            </div>

            <span className="ql-model3d-sep" />

            {/* Exploded View Slider */}
            <div className="ql-model3d-explode">
              <span>{m.modelExplode}</span>
              <ElasticMotionBar
                min={0}
                max={100}
                step={1}
                value={Math.round(explode * 100)}
                size="xs"
                width={92}
                ariaLabel={m.modelExplode}
                testId="ql-model3d-explode-slider"
                onChange={(nextVal) => setExplode(nextVal / 100)}
              />
            </div>

            <span className="ql-model3d-sep" />

            <button
              type="button"
              className={`ql-model3d-action ${autoRotate ? "ql-model3d-action--active" : ""}`}
              onClick={() => setAutoRotate((v) => !v)}
            >
              {m.modelTurntable}
            </button>

            <button
              type="button"
              className="ql-model3d-action"
              onClick={() => {
                setExplode(0);
                resetCameraFnRef.current?.();
              }}
            >
              {m.dockReset}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
