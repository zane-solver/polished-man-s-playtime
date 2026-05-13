import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Float, Sparkles, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// @ts-ignore
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

/* ---------------- Global scroll state ---------------- */
const scroll = { p: 0, mood: "idle" as "idle" | "rose" | "gold" | "sky", pulse: 0, hover: 0 };

/* ---------------- Dark Luxury palette ---------------- */
const PALETTE = {
  // Backgrounds
  deepObsidian: "#070810",
  steelCharcoal: "#141824",
  darkGray: "#1E2230",
  // Electric
  electricAzure: "#4D88FF",
  azureGlow: "#6BA3FF",
  platinumWhite: "#E8E4F5",
  lightGray: "#7A8098",
  // Mood / accent trio (previously missing — required by MoodLights, Petals, Sparkles, Scene)
  rose:  "#C87A9A",   // warm rose
  gold:  "#C8A96A",   // burnished gold
  sky:   "#5B9BD5",   // soft azure
  // Auxiliary (previously missing — required by MoodLights ambient/fill)
  blush: "#3A1E2E",   // deep plum (dark idle rim)
  ivory: "#EDE8D8",   // warm ivory (ambient / fill light & primary text)
  pearl: "#D8D4E8",   // cool pearl (key directional light)
};

const builtObjectUrl = "/assets/polished-man-5th.glb";
const dracoDecoderPath = "/draco/gltf/";

/* ---------------- Placeholder mascot — luminous silhouette ---------------- */
function MascotPlaceholder() {
  const group = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const inner = useRef<THREE.Mesh>(null!);
  const { mouse } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.y = Math.sin(t * 0.7) * 0.1;
    const tx = mouse.x * 0.35;
    const ty = -mouse.y * 0.2;
    group.current.rotation.y += (tx - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (ty - group.current.rotation.x) * 0.04;

    scroll.pulse *= 0.93;
    const pulse = scroll.pulse;
    if (inner.current) {
      const s = 1 + pulse * 0.18 + Math.sin(t * 1.4) * 0.015;
      inner.current.scale.setScalar(s);
    }
    if (halo.current) {
      halo.current.rotation.z = t * 0.15;
      const m = halo.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + pulse * 0.4;
    }
  });

  const moodColor = useMemo(() => new THREE.Color(PALETTE.electricAzure), []);
  useFrame(() => {
    const target = new THREE.Color(
      scroll.mood === "rose" ? PALETTE.rose :
      scroll.mood === "gold" ? PALETTE.gold :
      scroll.mood === "sky"  ? PALETTE.electricAzure : PALETTE.azureGlow
    );
    moodColor.lerp(target, 0.05);
    if (inner.current) {
      const m = inner.current.material as THREE.MeshStandardMaterial;
      m.emissive = moodColor;
    }
  });

  return (
    <group ref={group} scale={19}>
      <mesh ref={halo} position={[0, 0.1, -0.4]}>
        <ringGeometry args={[1.2, 1.9, 64]} />
        <meshBasicMaterial color={PALETTE.electricAzure} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <mesh position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.62, 0.9, 24, 48]} />
          <meshPhysicalMaterial
            color={PALETTE.steelCharcoal}
            emissive={PALETTE.electricAzure}
            emissiveIntensity={0.25}
            roughness={0.15}
            metalness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.08}
            transparent
            opacity={0.92}
          />
        </mesh>
        <mesh position={[0, -0.1, -0.03]} scale={1.04}>
          <capsuleGeometry args={[0.62, 0.9, 24, 48]} />
          <meshBasicMaterial color={PALETTE.electricAzure} transparent opacity={0.28} side={THREE.BackSide} />
        </mesh>
        <mesh ref={inner} position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.42, 48, 48]} />
          <meshStandardMaterial
            color={PALETTE.platinumWhite}
            emissive={PALETTE.electricAzure}
            emissiveIntensity={1.0}
            roughness={0.25}
            metalness={0.15}
          />
        </mesh>
        <mesh position={[0.85, 0.4, 0.2]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={PALETTE.azureGlow} emissive={PALETTE.azureGlow} emissiveIntensity={1.3} />
        </mesh>
      </Float>
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 1.1, 64]} />
        <meshStandardMaterial color={PALETTE.darkGray} metalness={0.95} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BuiltObject({ onImpact }: { onImpact?: () => void }) {
  const { mouse } = useThree();

  const dracoLoader = useMemo(() => {
    const loader = new DRACOLoader();
    loader.setDecoderPath(dracoDecoderPath);
    return loader;
  }, []);

  useEffect(() => {
    return () => { dracoLoader.dispose(); };
  }, [dracoLoader]);

  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const group = useRef<THREE.Group>(null!);
  const wheelDelta = useRef(0);

  const gltf = useLoader(GLTFLoader, builtObjectUrl, (loader) => loader.setDRACOLoader(dracoLoader));
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;

    cloned.position.sub(center);
    cloned.scale.setScalar(3.15 / maxAxis);
    cloned.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return cloned;
  }, [gltf.scene]);

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;
    const targetScale = clicked ? 1.24 : hovered ? 1.14 : 1;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    const targetY = isDragging ? mouse.x * 0.9 : group.current.rotation.y + 0.012 + wheelDelta.current * 0.12;
    const targetX = isDragging ? -mouse.y * 0.35 : Math.sin(t * 0.5) * 0.05;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.08;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.08;
    group.current.position.y = -0.08 + Math.sin(t * 0.55) * 0.045 + (clicked ? 0.05 : 0);
    wheelDelta.current *= 0.86;
    scroll.pulse *= 0.96;
  });

  const triggerImpact = () => {
    if (onImpact) onImpact();
  };

  const handlePointerDown = (event: any) => {
    event.stopPropagation();
    setIsDragging(true);
    setClicked(true);
    scroll.pulse = 1;
    setTimeout(() => setClicked(false), 220);
  };

  useEffect(() => {
    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        triggerImpact();
      }
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [isDragging]);

  const handleWheel = (event: any) => {
    event.stopPropagation();
    event.preventDefault();
    wheelDelta.current = Math.max(-1.4, Math.min(1.4, wheelDelta.current + event.deltaY * -0.0014));
    scroll.pulse = 1;
  };

  return (
    <Float speed={0.9} rotationIntensity={0.08} floatIntensity={0.22}>
      <group
        ref={group}
        scale={1}
        rotation={[0, Math.PI * 0.12, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          scroll.pulse = 1;
        }}
        onPointerOut={(event) => { event.stopPropagation(); setHovered(false); }}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
      >
        <primitive object={scene} dispose={null} />
      </group>
    </Float>
  );
}

/* ---------------- Soft volumetric backdrop ---------------- */
function Backdrop() {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({
      uTime:   { value: 0 },
      uMouse:  { value: new THREE.Vector2(0, 0) },
      uColorA: { value: new THREE.Color(PALETTE.deepObsidian) },
      uColorB: { value: new THREE.Color(PALETTE.steelCharcoal) },
      uColorC: { value: new THREE.Color(PALETTE.electricAzure) },
    }),
    []
  );
  const { mouse } = useThree();
  useFrame((s) => {
    if (mat.current) {
      mat.current.uniforms.uTime.value = s.clock.elapsedTime;
      mat.current.uniforms.uMouse.value.set(mouse.x, mouse.y);
    }
  });
  return (
    <mesh position={[0, 0, -6]} scale={[30, 18, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          precision highp float;
          varying vec2 vUv;
          uniform float uTime;
          uniform vec2 uMouse;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform vec3 uColorC;
          void main(){
            vec2 uv = vUv;
            vec2 m = uMouse * 0.15;
            float d1 = smoothstep(0.0, 1.2, length(uv - vec2(0.3 + m.x, 0.7 + m.y)));
            float d2 = smoothstep(0.0, 1.0, length(uv - vec2(0.7 - m.x, 0.3 - m.y)));
            float wave = sin(uv.y*4.0 + uTime*0.3)*0.05;
            vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, uv.y + wave));
            col = mix(col, uColorC, d1*0.55);
            col = mix(col, uColorA, (1.0-d2)*0.25);
            float v = smoothstep(1.4, 0.2, length(uv - 0.5));
            col *= mix(0.92, 1.05, v);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/* ---------------- Camera rig ---------------- */
function CameraRig() {
  const { camera, mouse } = useThree();
  useFrame(() => {
    const p = scroll.p;
    let pos = new THREE.Vector3();
    if (p < 0.2) {
      const k = p / 0.2;
      pos.set(0.1, 0.3, 6.2 - k * 0.7);
    } else if (p < 0.45) {
      const k = (p - 0.2) / 0.25;
      const a = k * Math.PI * 0.35 - 0.15;
      pos.set(Math.sin(a) * 2.4, 0.25, Math.cos(a) * 2.4 + 2.6);
    } else if (p < 0.65) {
      pos.set(0, 0.2, 4.8);
    } else if (p < 0.88) {
      const k = (p - 0.65) / 0.23;
      pos.set(0, 0.15, 4.8 + k * 0.4);
    } else {
      const k = (p - 0.88) / 0.12;
      pos.set(0, 0.1, 5.2 + k * 0.3);
    }
    pos.x += mouse.x * 0.18;
    pos.y += mouse.y * 0.12;
    camera.position.lerp(pos, 0.05);
    camera.lookAt(0, 0.05, 0);
  });
  return null;
}

/* ---------------- Mood lights ---------------- */
function MoodLights() {
  const key  = useRef<THREE.DirectionalLight>(null!);
  const rim  = useRef<THREE.PointLight>(null!);
  const fill = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const reveal = Math.min(1, Math.max(0, (scroll.p - 0.04) / 0.2));
    if (key.current) key.current.intensity = 0.4 + reveal * 1.0;
    const target = new THREE.Color(
      scroll.mood === "rose" ? PALETTE.rose :
      scroll.mood === "gold" ? PALETTE.gold :
      scroll.mood === "sky"  ? PALETTE.sky  : PALETTE.blush
    );
    if (rim.current) {
      rim.current.color.lerp(target, 0.06);
      rim.current.intensity = 1.2 * reveal + scroll.pulse * 0.8;
    }
    if (fill.current) {
      fill.current.color.lerp(new THREE.Color(PALETTE.ivory), 0.05);
      fill.current.intensity = 0.6 * reveal;
    }
  });
  return (
    <>
      <ambientLight intensity={0.45} color={PALETTE.ivory} />
      <directionalLight ref={key} position={[2.5, 3.5, 2]} intensity={0.4} color={PALETTE.pearl} />
      <pointLight ref={rim}  position={[-3, 1.5, -1]} intensity={0.8} color={PALETTE.rose}  distance={12} />
      <pointLight ref={fill} position={[3, -0.5, 2]}  intensity={0.4} color={PALETTE.ivory} distance={10} />
    </>
  );
}

/* ---------------- Signature petals ---------------- */
function Petals() {
  const COUNT = import.meta.env.DEV ? 300 : 1200;
  const ref = useRef<THREE.Points>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);
  const { origins, targets } = useMemo(() => {
    const o = new Float32Array(COUNT * 3);
    const t = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 0.5 + Math.random() * 0.4;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      o[i * 3]     = r * Math.sin(b) * Math.cos(a);
      o[i * 3 + 1] = r * Math.sin(b) * Math.sin(a) * 0.6;
      o[i * 3 + 2] = r * Math.cos(b);
      const k   = i / COUNT;
      const ang = k * Math.PI * 12;
      const rad = 0.3 + k * 1.7;
      t[i * 3]     = Math.cos(ang) * rad;
      t[i * 3 + 1] = Math.sin(ang) * rad * 0.55 + (Math.random() - 0.5) * 0.1;
      t[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return { origins: o, targets: t };
  }, []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useFrame((s) => {
    const t  = s.clock.elapsedTime;
    const sp = scroll.p;
    let k = 0;
    if      (sp < 0.62) k = 0;
    else if (sp < 0.80) k = (sp - 0.62) / 0.18;
    else if (sp < 0.90) k = 1;
    else                k = Math.max(0, 1 - (sp - 0.9) / 0.06);
    const e = k * k * (3 - 2 * k);
    for (let i = 0; i < COUNT; i++) {
      const ix  = i * 3;
      const wob = Math.sin(t * 1.1 + i * 0.05) * 0.05 * (1 - e);
      positions[ix]     = origins[ix]     + (targets[ix]     - origins[ix])     * e + wob;
      positions[ix + 1] = origins[ix + 1] + (targets[ix + 1] - origins[ix + 1]) * e + wob * 0.6;
      positions[ix + 2] = origins[ix + 2] + (targets[ix + 2] - origins[ix + 2]) * e;
    }
    if (ref.current) {
      const attr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.array = positions;
      attr.needsUpdate = true;
      ref.current.rotation.z = t * 0.05 * e;
    }
    if (mat.current) {
      mat.current.opacity = 0.1 + e * 0.85;
      mat.current.size    = 0.025 + e * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.025}
        color={PALETTE.rose}
        transparent
        opacity={0.1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/* ---------------- Scene ---------------- */
function Scene({ onImpact }: { onImpact?: () => void }) {
  return (
    <>
      {/* Dark fog matches the obsidian backdrop — object pops cleanly */}
      <fog attach="fog" args={["#070810", 10, 28]} />
      {import.meta.env.DEV ? null : <Backdrop />}
      <CameraRig />
      <MoodLights />
      <Suspense fallback={<MascotPlaceholder />}>
        <BuiltObject onImpact={onImpact} />
        <Environment preset="apartment" environmentIntensity={0.5} />
      </Suspense>
      {import.meta.env.DEV ? null : (
        <ContactShadows
          position={[0, -0.95, 0]}
          opacity={0.65}
          scale={6}
          blur={3.2}
          far={2.5}
          color="#000820"
        />
      )}
      <Petals />
      <Sparkles count={import.meta.env.DEV ? 35 : 70} scale={[10, 6, 6]} size={2}   speed={0.18} color={PALETTE.gold} opacity={0.55} />
      <Sparkles count={import.meta.env.DEV ? 20 : 40} scale={[14, 8, 8]} size={1.2} speed={0.10} color={PALETTE.rose} opacity={0.40} />
      {import.meta.env.DEV ? null : (
        <EffectComposer>
          <Bloom intensity={0.70} luminanceThreshold={0.50} luminanceSmoothing={0.5} mipmapBlur />
          <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation={false} modulationOffset={0} />
          <Vignette eskil={false} offset={0.42} darkness={0.60} />
        </EffectComposer>
      )}
    </>
  );
}

/* ── Custom GSAP-smooth cursor ── */
function CursorGlow() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [visible,  setVisible]  = useState(false);
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    const dot  = dotRef.current;
    const ring = ringRef.current;
    const glow = glowRef.current;
    if (!dot || !ring || !glow) return;

    const xDot  = gsap.quickTo(dot,  "x", { duration: 0.06 });
    const yDot  = gsap.quickTo(dot,  "y", { duration: 0.06 });
    const xRing = gsap.quickTo(ring, "x", { duration: 0.28, ease: "power2.out" });
    const yRing = gsap.quickTo(ring, "y", { duration: 0.28, ease: "power2.out" });
    const xGlow = gsap.quickTo(glow, "x", { duration: 0.55, ease: "power2.out" });
    const yGlow = gsap.quickTo(glow, "y", { duration: 0.55, ease: "power2.out" });

    const onMove  = (e: MouseEvent) => {
      setVisible(true);
      xDot(e.clientX);  yDot(e.clientY);
      xRing(e.clientX); yRing(e.clientY);
      xGlow(e.clientX); yGlow(e.clientY);
    };
    const onLeave = () => setVisible(false);
    const onDown  = () => setPressing(true);
    const onUp    = () => setPressing(false);

    window.addEventListener("mousemove",  onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown",  onDown);
    window.addEventListener("mouseup",    onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown",  onDown);
      window.removeEventListener("mouseup",    onUp);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 60, opacity: visible ? 1 : 0, transition: "opacity 0.35s" }}
    >
      {/* Ambient blob — slowest follower */}
      <div
        ref={glowRef}
        className="absolute rounded-full"
        style={{
          width: 480, height: 480,
          marginLeft: -240, marginTop: -240,
          background: "radial-gradient(circle, rgba(237,232,216,0.12) 0%, rgba(200,169,106,0.10) 34%, transparent 70%)",
          left: 0, top: 0,
        }}
      />
      {/* Trailing ring — medium lag */}
      <div
        ref={ringRef}
        className="absolute rounded-full"
        style={{
          width:      pressing ? 26 : 38,
          height:     pressing ? 26 : 38,
          marginLeft: pressing ? -13 : -19,
          marginTop:  pressing ? -13 : -19,
          border:     `2px solid ${pressing ? "rgba(237,232,216,0.98)" : "rgba(200,169,106,0.94)"}`,
          boxShadow:  pressing
            ? "0 0 0 1px rgba(15,12,6,0.78), 0 0 18px rgba(237,232,216,0.52)"
            : "0 0 0 1px rgba(15,12,6,0.72), 0 0 16px rgba(200,169,106,0.46)",
          transition: "width 0.18s, height 0.18s, margin 0.18s, border-color 0.18s, box-shadow 0.18s",
          left: 0, top: 0,
        }}
      />
      {/* Crisp center dot — fastest */}
      <div
        ref={dotRef}
        className="absolute rounded-full"
        style={{
          width: pressing ? 5 : 8,
          height: pressing ? 5 : 8,
          marginLeft: pressing ? -2.5 : -4,
          marginTop: pressing ? -2.5 : -4,
          background: pressing ? "#EDE8D8" : PALETTE.gold,
          boxShadow: "0 0 0 1px rgba(7,8,16,0.92), 0 0 12px rgba(237,232,216,0.86), 0 0 26px rgba(200,169,106,0.70)",
          transition: "width 0.15s, height 0.15s, margin 0.15s, background 0.15s",
          left: 0, top: 0,
        }}
      />
    </div>
  );
}

/* ── Click-to-jump chapter navigation dots ── */
function ChapterNav({ p }: { p: number }) {
  const labels  = ["Intro", "Hero", "Craft", "Patience", "Philosophy", "Movement", "Build", "Transition", "The Man", "Afterglow", "Fin"];
  const current = Math.min(10, Math.floor(p * 11));
  const [hovered, setHovered] = useState<number | null>(null);

  const jumpTo = (i: number) => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: h * ((i + 0.5) / 11), behavior: "smooth" });
  };

  return (
    <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 flex flex-col items-end gap-[9px] pointer-events-auto">
      {labels.map((label, i) => (
        <button
          key={i}
          onClick={() => jumpTo(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 transition-all duration-300"
          aria-label={`Jump to chapter: ${label}`}
        >
          {/* Label — slides in on hover */}
          <span
            className="text-[8px] uppercase tracking-[0.45em] whitespace-nowrap overflow-hidden transition-all duration-300"
            style={{
              color:    "#9094A8",
              maxWidth: hovered === i ? "90px" : "0px",
              opacity:  hovered === i ? 1 : 0,
            }}
          >
            {label}
          </span>
          {/* Dot */}
          <span
            className="block rounded-full flex-shrink-0 transition-all duration-300"
            style={{
              width:      i === current ? 10 : hovered === i ? 6 : 4,
              height:     i === current ? 10 : hovered === i ? 6 : 4,
              background: i === current
                ? PALETTE.gold
                : hovered === i
                  ? "rgba(200,169,106,0.60)"
                  : "rgba(110,100,155,0.35)",
              boxShadow:  i === current ? `0 0 14px ${PALETTE.gold}` : "none",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/* ── Cinematic mood-name reveal overlay ── */
function MoodReveal({ mood }: { mood: "idle" | "rose" | "gold" | "sky" }) {
  const [displayMood, setDisplayMood] = useState<typeof mood>("idle");
  const [opacity, setOpacity]         = useState(0);

  useEffect(() => {
    if (mood === "idle") return;
    setDisplayMood(mood);
    setOpacity(1);
    const t = setTimeout(() => setOpacity(0), 2200);
    return () => clearTimeout(t);
  }, [mood]);

  const cfg = {
    rose: { label: "TENDERNESS", color: PALETTE.rose },
    gold: { label: "WARMTH",     color: PALETTE.gold },
    sky:  { label: "SERENITY",   color: PALETTE.sky  },
    idle: { label: "",           color: "#fff"        },
  } as const;
  const { label, color } = cfg[displayMood];

  return (
    <div
      className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 25, opacity, transition: "opacity 0.65s ease" }}
    >
      <p className="text-[8px] uppercase tracking-[1.25em] mb-4" style={{ color: "rgba(144,148,168,0.75)" }}>
        mood ·
      </p>
      <p
        style={{
          fontFamily:    "'Cormorant Garamond', serif",
          fontSize:      "clamp(3rem, 9vw, 6.5rem)",
          fontWeight:    200,
          letterSpacing: "0.38em",
          color,
          filter:        `drop-shadow(0 0 55px ${color}BB) drop-shadow(0 0 110px ${color}55)`,
          transition:    "color 0.4s, filter 0.4s",
        }}
      >
        {label}
      </p>
      <div
        className="mt-4 h-px"
        style={{ width: 80, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
    </div>
  );
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D scene failed to render", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(77,136,255,0.12), transparent 48%), #070810",
      }}
    />
  );
}

/* ---------------- HUD ---------------- */
export default function PolishedFilm() {
  const [mounted, setMounted]             = useState(false);
  const [, force]                          = useState(0);
  const [interactVisible, setInteractVisible] = useState(false);
  const [introPhase, setIntroPhase]       = useState<0 | 1 | 2 | 3>(0);
  const [activeMood, setActiveMood]       = useState<"idle" | "rose" | "gold" | "sky">("idle");
  const [impactActive, setImpactActive]   = useState(false);
  const impactTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      scroll.p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      setInteractVisible(scroll.p > 0.4 && scroll.p < 0.62);
      force((n) => n + 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const t1 = setTimeout(() => setIntroPhase(1), 350);
    const t2 = setTimeout(() => setIntroPhase(2), 1900);
    const t3 = setTimeout(() => setIntroPhase(3), 3400);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (impactTimeoutRef.current) clearTimeout(impactTimeoutRef.current);
    };
  }, []);

  const setMood = (m: "rose" | "gold" | "sky") => {
    scroll.mood = m;
    scroll.pulse = 1;
    setActiveMood(m);
    setTimeout(() => {
      if (scroll.mood === m) { scroll.mood = "idle"; setActiveMood("idle"); }
    }, 2800);
  };

  const triggerImpact = () => {
    setImpactActive(true);
    if (impactTimeoutRef.current) clearTimeout(impactTimeoutRef.current);
    impactTimeoutRef.current = setTimeout(() => setImpactActive(false), 420);
  };

  if (!mounted) return <div className="fixed inset-0" style={{ background: PALETTE.deepObsidian }} />;

  const p = scroll.p;
  const seg = (i: number) => [i / 11, (i + 1) / 11] as const;
  const win = (start: number, end: number, fade = 0.008) => {
    if (p < start - fade || p > end + fade) return 0;
    if (p < start) return (p - (start - fade)) / fade;
    if (p > end)   return 1 - (p - end) / fade;
    return 1;
  };
  const s = Array.from({ length: 11 }, (_, i) => {
    const [a, b] = seg(i);
    return win(a, b);
  });
  const endOn    = p > 0.93 ? Math.min(1, (p - 0.93) / 0.04) : 0;
  const romans   = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];
  const chapter  = romans[Math.min(10, Math.floor(p * 11))];
  // Exclusive opacity windows — Section 1 fully fades out before Section 2 appears
  const fadeIntro = p < 0.075 ? 1 : p < 0.092 ? (0.092 - p) / 0.017 : 0;
  const heroSec   = p < 0.092 ? 0 : s[1];
  const hudLabelStyle: CSSProperties = {
    color: "#F6F1DF",
    fontWeight: 600,
    textShadow: "0 0 14px rgba(237,232,216,0.58), 0 1px 5px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)",
  };
  const hudMetaStyle: CSSProperties = {
    color: "#EDE8D8",
    fontWeight: 600,
    textShadow: "0 0 12px rgba(237,232,216,0.50), 0 1px 5px rgba(0,0,0,0.92), 0 0 2px rgba(0,0,0,0.90)",
  };
  const chapterStyle = (opacity: number, extra?: CSSProperties): CSSProperties => ({
    opacity,
    visibility: opacity > 0.02 ? "visible" : "hidden",
    ...extra,
  });

  return (
    <>
      {/* ── Cinematic canvas — dark obsidian base so 3D object pops ── */}
      <div className="fixed inset-0 z-0" style={{ background: PALETTE.deepObsidian }}>
        <SceneErrorBoundary fallback={<SceneFallback />}>
          <Canvas
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            camera={{ position: [0, 0.3, 6.5], fov: 38 }}
          >
            <Scene onImpact={triggerImpact} />
          </Canvas>
        </SceneErrorBoundary>

        {/* Dark vignette corners — adds cinematic depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,15,0.70) 100%)",
          }}
        />
        {/* End fade — dark */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: endOn * 0.55,
            background: "linear-gradient(180deg, #070810, #0D0A1E)",
          }}
        />
      </div>

      {/* ── HUD ── */}
      <div className="pointer-events-none fixed inset-0 z-10" style={{ color: "#EDE8D8" }}>

        {/* Top brand bar */}
        <div className="absolute top-6 left-6 md:top-9 md:left-12 flex items-center gap-3">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: PALETTE.gold, boxShadow: `0 0 8px ${PALETTE.gold}` }}
          />
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em]" style={hudLabelStyle}>
            Polish · Atelier
          </p>
        </div>
        <div className="absolute top-6 right-6 md:top-9 md:right-12 text-right">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em]" style={hudLabelStyle}>
            Chapter&nbsp;&nbsp;{chapter}&nbsp;·&nbsp;Five Years of Patience
          </p>
        </div>

        {/* Gold hairline separator below header */}
        <div
          className="absolute top-[4.25rem] md:top-[5.5rem] left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(200,169,106,0.22) 30%, rgba(200,169,106,0.22) 70%, transparent)",
          }}
        />

        {/* Bottom-left meta */}
        <div className="absolute bottom-6 left-6 md:bottom-9 md:left-12 max-w-[220px]">
          <p className="text-[10px] uppercase tracking-[0.5em]" style={hudMetaStyle}>
            an interactive bloom
          </p>
          <p className="mt-2 text-[10px] tracking-wider" style={hudMetaStyle}>
            scroll &nbsp;·&nbsp; hover &nbsp;·&nbsp; press
          </p>
        </div>

        {/* Ambient floating decor */}
        <FloatingDecor />

        {/* ── SECTION 1 — Cinematic intro headline ── */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={chapterStyle(fadeIntro, { pointerEvents: "none", transition: "opacity 1000ms" })}
        >
          {/* eyebrow */}
          <p className="text-[9px] uppercase tracking-[0.85em] mb-6" style={{ color: "#6A6E84" }}>
            polish · atelier
          </p>
          {/* Giant 磨 character */}
          <p
            className="leading-none font-extralight hud-mo-pulse"
            style={{
              fontSize: "clamp(7rem, 18vw, 14rem)",
              fontFamily: "'Cormorant Garamond', 'Songti SC', 'Noto Serif CJK TC', serif",
              color: "transparent",
              backgroundImage: `linear-gradient(170deg, ${PALETTE.gold} 0%, ${PALETTE.ivory} 45%, ${PALETTE.rose} 85%, ${PALETTE.gold} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 60px rgba(200,169,106,0.65)) drop-shadow(0 0 130px rgba(200,120,154,0.30))",
              opacity: impactActive ? 0.95 : 1,
              transition: "filter 120ms ease, opacity 120ms ease, transform 120ms ease",
              transform: impactActive ? "skewX(-3deg) scale(1.03)" : "none",
              textShadow: impactActive
                ? "0 0 18px rgba(255,255,255,0.75), 0 0 28px rgba(198,118,214,0.35)"
                : undefined,
            }}
          >
            磨
          </p>
          {/* subtitle with decorative lines */}
          <div className="mt-4 flex items-center gap-5">
            <span
              className="h-px w-16"
              style={{ background: "linear-gradient(90deg, transparent, rgba(246,241,223,0.78))" }}
            />
            <p className="text-[10px] md:text-xs uppercase tracking-[0.7em]" style={hudLabelStyle}>
              to refine — with patience
            </p>
            <span
              className="h-px w-16"
              style={{ background: "linear-gradient(90deg, rgba(246,241,223,0.78), transparent)" }}
            />
          </div>
          {/* scroll cue */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.75em]" style={hudMetaStyle}>
              scroll to bloom
            </span>
            <span
              className="hud-scroll-caret block w-px h-8"
              style={{ background: "linear-gradient(180deg, rgba(246,241,223,0.82), transparent)" }}
            />
          </div>
        </div>

        {/* ── SECTION 2 — Hero + Material / Mood buttons ── */}
        <div
          className="absolute inset-x-0 top-[8%] md:top-[7%] flex flex-col items-center text-center px-5"
          style={chapterStyle(heroSec, { transition: "opacity 700ms" })}
        >
          {/* Eyebrow with flanking hairlines */}
          <div className="flex items-center gap-5 mb-5">
            <span
              className="h-px w-10 md:w-16"
              style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,106,0.50))" }}
            />
            <p className="text-[9px] uppercase tracking-[0.85em]" style={{ color: "#9094A8" }}>
              polish · atelier
            </p>
            <span
              className="h-px w-10 md:w-16"
              style={{ background: "linear-gradient(90deg, rgba(200,169,106,0.50), transparent)" }}
            />
          </div>
          {/* Large editorial headline */}
          <h1
            className="font-extralight leading-[1.04] tracking-[0.08em] max-w-4xl px-4"
            style={{
              fontSize: "clamp(2.1rem, 4.8vw, 4.55rem)",
              fontFamily: "'Cormorant Garamond', serif",
              color: "transparent",
              backgroundImage: `linear-gradient(128deg, ${PALETTE.rose} 0%, ${PALETTE.ivory} 40%, ${PALETTE.sky} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 2px 40px rgba(91,155,213,0.22))",
            }}
          >
            A creative studio crafting immersive 3D experiences
          </h1>
          {/* Tag line */}
          <div className="mt-6 flex items-center gap-3" style={{ color: "#444860" }}>
            <span className="h-px w-6" style={{ background: "currentColor" }} />
            <p className="text-[10px] tracking-[0.5em] uppercase" style={{ color: "#666A80" }}>
              refined &nbsp;·&nbsp; cinematic &nbsp;·&nbsp; interactive
            </p>
            <span className="h-px w-6" style={{ background: "currentColor" }} />
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-[5%] md:bottom-[7%] flex flex-col items-center gap-3 md:gap-4 transition-opacity duration-700 pointer-events-auto px-5"
          style={chapterStyle(heroSec)}
        >
          <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: "#9094A8" }}>materials</p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {[
              { l: "glass",    c: PALETTE.sky,  a: "#3A6A9A" },
              { l: "rose gold",c: PALETTE.rose, a: "#A0527A" },
              { l: "ivory",    c: PALETTE.gold, a: "#A08040" },
              { l: "pearl",    c: PALETTE.pearl,a: "#8080A8" },
            ].map((m) => (
              <ChipButton key={m.l} color={m.c} accent={m.a} label={m.l} onClick={() => { scroll.pulse = 1; }} />
            ))}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.5em]" style={{ color: "#9094A8" }}>moods</p>
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <MoodButton color={PALETTE.rose} accent="#8A3A6A" label="tenderness" onClick={() => setMood("rose")} />
            <MoodButton color={PALETTE.gold} accent="#8A6A20" label="warmth"     onClick={() => setMood("gold")} />
            <MoodButton color={PALETTE.sky}  accent="#3A6A9A" label="serenity"   onClick={() => setMood("sky")}  />
          </div>
        </div>

        {/* ── SECTION 3 — Feature close-up 1 ── */}
        <SidePanel side="left" opacity={s[2]} eyebrow="03 · craft">
          <p
            className="text-2xl md:text-3xl font-light leading-snug"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            We craft interactive 3D experiences for{" "}
            <em style={{ color: PALETTE.rose }}>luxury</em>,{" "}
            <em style={{ color: PALETTE.gold }}>automotive</em> and{" "}
            <em style={{ color: PALETTE.sky  }}>energy</em> brands.
          </p>
          <p className="mt-4 text-xs tracking-[0.3em] uppercase" style={{ color: "#666A80" }}>
            real-time · webgl · cinematic
          </p>
        </SidePanel>

        {/* ── SECTION 4 — Feature close-up 2 ── */}
        <SidePanel side="right" opacity={s[3]} eyebrow="04 · patience">
          <p
            className="text-2xl md:text-3xl font-light leading-snug"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            Every project is refined with patience, cinematic storytelling, and visual polish.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: "#9094A8" }}>
            <div><span style={{ color: PALETTE.rose }}>·</span> direction</div>
            <div><span style={{ color: PALETTE.gold }}>·</span> motion</div>
            <div><span style={{ color: PALETTE.sky  }}>·</span> code</div>
          </div>
        </SidePanel>

        {/* ── SECTION 5 — Philosophy ── */}
        <div
          className="absolute inset-x-0 top-[14%] flex flex-col items-center text-center px-6 transition-opacity duration-700"
          style={chapterStyle(s[4])}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>05 · philosophy</p>
          <p
            className="mt-6 max-w-2xl text-xl md:text-2xl font-light leading-relaxed"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            We believe a brand should breathe — not shout. Each frame is a brushstroke,
            each interaction a small act of attention.
          </p>
        </div>

        {/* ── SECTION 6 — Movement ── */}
        <div
          className="absolute inset-x-0 bottom-[14%] flex flex-col items-center text-center transition-opacity duration-700 pointer-events-auto"
          style={chapterStyle(s[5])}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>06 · movement</p>
          <p
            className="mt-3 text-xl md:text-2xl font-light tracking-[0.12em]"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            hover · scroll · breathe
          </p>
          <button
            onClick={() => { scroll.pulse = 1; setMood("rose"); }}
            onMouseEnter={() => { scroll.pulse = Math.min(1, scroll.pulse + 0.5); }}
            className="mt-6 px-8 py-3 rounded-full text-[10px] uppercase tracking-[0.5em] backdrop-blur-md border transition-all hover:scale-105 active:scale-95"
            style={{
              background:   "rgba(255,255,255,0.04)",
              borderColor:  "rgba(200,169,106,0.35)",
              color:        "#EDE8D8",
              boxShadow:    "0 8px 40px rgba(200,169,106,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            touch the bloom
          </button>
        </div>

        {/* ── SECTION 7 — Build-up ── */}
        <div
          className="absolute inset-x-0 top-[18%] flex flex-col items-center text-center transition-opacity duration-700"
          style={chapterStyle(s[6])}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>07 · build-up</p>
          <p
            className="mt-4 text-3xl md:text-5xl font-extralight tracking-[0.2em]"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              color: "transparent",
              backgroundImage: `linear-gradient(120deg, ${PALETTE.rose}, ${PALETTE.gold})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            light gathers
          </p>
        </div>
        {/* radial build-up glow */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: s[6] * 0.45,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(200,169,106,0.18) 0%, transparent 55%)",
          }}
        />

        {/* ── SECTION 8 — Transition / light beams ── */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700"
          style={chapterStyle(s[7])}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute top-[-30%] left-1/2 origin-top"
              style={{
                width: 180,
                height: "160%",
                transform: `translateX(-50%) rotate(${(i - 2) * 9}deg)`,
                background:
                  "linear-gradient(180deg, rgba(91,155,213,0.12), rgba(200,169,106,0.0) 70%)",
                filter:  "blur(22px)",
                opacity: 0.65,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-x-0 top-[12%] text-center transition-opacity duration-700"
          style={chapterStyle(s[7])}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>08 · transition</p>
          <p
            className="mt-3 text-xl md:text-2xl font-light italic"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            a slow inhale before the bloom
          </p>
        </div>

        {/* ── SECTION 9 — Signature climax ── */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center transition-opacity duration-700"
          style={chapterStyle(s[8])}
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>
            09 · the polished man
          </p>
          <p
            className="mt-6 text-4xl md:text-6xl font-light tracking-[0.4em]"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              color: "transparent",
              backgroundImage: `linear-gradient(120deg, ${PALETTE.rose}, ${PALETTE.gold}, ${PALETTE.sky}, ${PALETTE.rose})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            磨 → POLISH
          </p>
          <p className="mt-4 text-xs tracking-[0.45em]" style={{ color: "#666A80" }}>
            five years &nbsp;·&nbsp; crafted in light
          </p>
        </div>

        {/* ── SECTION 10 — Afterglow ── */}
        <div
          className="absolute inset-x-0 bottom-[16%] text-center px-6 transition-opacity duration-700"
          style={chapterStyle(s[9])}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>10 · afterglow</p>
          <p
            className="mt-4 max-w-xl mx-auto text-lg md:text-xl font-light italic leading-relaxed"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            What lingers is not the spectacle — it is the warmth that stays
            when the screen quiets.
          </p>
        </div>

        {/* ── SECTION 11 — Footer ── */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-1000 pointer-events-auto"
          style={chapterStyle(Math.max(s[10], endOn))}
        >
          {/* decorative divider */}
          <div className="mb-8 flex items-center gap-4">
            <span
              className="h-px w-16"
              style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,106,0.45))" }}
            />
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: PALETTE.gold, boxShadow: `0 0 10px ${PALETTE.gold}` }}
            />
            <span
              className="h-px w-16"
              style={{ background: "linear-gradient(90deg, rgba(200,169,106,0.45), transparent)" }}
            />
          </div>

          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#9094A8" }}>
            crafted with patience
          </p>
          <p
            className="mt-4 text-2xl md:text-3xl font-extralight tracking-[0.4em]"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#EDE8D8" }}
          >
            until next bloom
          </p>
          <p className="mt-3 text-[10px] tracking-[0.4em] uppercase" style={{ color: "#666A80" }}>
            hello@polish.atelier
          </p>
          <div className="mt-8 flex items-center gap-6 text-[10px] uppercase tracking-[0.5em]" style={{ color: "#666A80" }}>
            <a className="transition-colors hover:text-[#C8A96A]" href="#">instagram</a>
            <span className="h-px w-8" style={{ background: "currentColor" }} />
            <a className="transition-colors hover:text-[#C8A96A]" href="#">journal</a>
            <span className="h-px w-8" style={{ background: "currentColor" }} />
            <a className="transition-colors hover:text-[#C8A96A]" href="#">contact</a>
          </div>
          <p className="mt-10 text-[9px] tracking-[0.4em] uppercase" style={{ color: "#2E3048" }}>
            © polish atelier — mmxxv
          </p>
        </div>

        {/* Chapter navigation dots — replaces scroll rail */}
        <ChapterNav p={p} />
      </div>

      {/* Cinematic global styles */}
      <style>{`
        @keyframes hudMoPulse {
          0%,100% { filter: drop-shadow(0 0 50px rgba(200,169,106,0.60)) drop-shadow(0 0 110px rgba(200,120,154,0.28)); }
          50%     { filter: drop-shadow(0 0 90px rgba(200,169,106,0.90)) drop-shadow(0 0 180px rgba(200,120,154,0.50)); }
        }
        .hud-mo-pulse { animation: hudMoPulse 5s ease-in-out infinite; }

        @keyframes hudScrollCaret {
          0%,100% { opacity: 0; transform: scaleY(0.4) translateY(-4px); }
          50%     { opacity: 1; transform: scaleY(1)   translateY(0);    }
        }
        .hud-scroll-caret { animation: hudScrollCaret 2.2s ease-in-out infinite; transform-origin: top; }

        @keyframes moodOrbBreathe {
          0%,100% { opacity: 0.65; transform: scale(1);    }
          50%     { opacity: 1;    transform: scale(1.18); }
        }
        .mood-orb-breathe { animation: moodOrbBreathe 3s ease-in-out infinite; }

        @keyframes hudScanline {
          from { background-position: 0 0; }
          to   { background-position: 0 120px; }
        }
        .hud-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,20,0.06) 2px,
            rgba(0,0,20,0.06) 4px
          );
          animation: hudScanline 12s linear infinite;
        }

        /* Hide native cursor on pointer devices — replaced by CursorGlow */
        @media (hover: hover) {
          *, *::before, *::after { cursor: none !important; }
        }
      `}</style>

      {/* Cinematic scanlines overlay */}
      <div
        className="pointer-events-none fixed inset-0 hud-scanlines"
        style={{ zIndex: 6, opacity: 0.7 }}
      />

      {/* Scroll spacer — 11 chapters */}
      <div className="relative z-0" style={{ height: "1180vh" }} />

      {/* Custom cursor — GSAP smooth multi-layer */}
      <CursorGlow />

      {/* Mood name cinematic reveal */}
      <MoodReveal mood={activeMood} />

      {/* Cinematic intro overlay */}
      <IntroOverlay phase={introPhase} onSkip={() => setIntroPhase(3)} />
    </>
  );
}

/* ── Intro overlay — dark aurora luxury ── */
function IntroOverlay({ phase, onSkip }: { phase: 0 | 1 | 2 | 3; onSkip: () => void }) {
  if (phase >= 3) return null;
  const opacity = phase === 2 ? 0 : 1;
  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-opacity duration-[1400ms] ease-out"
      style={{
        opacity,
        pointerEvents: phase === 2 ? "none" : "auto",
        background:
          "radial-gradient(ellipse at 50% 40%, #0D1228 0%, #08051A 40%, #070810 100%)",
      }}
    >
      {/* Aurora glows */}
      <div className="pointer-events-none absolute inset-0">
        {[
          { c: "#C87A9A", x: "20%", y: "30%", s: 520, d: "0s"   },
          { c: "#C8A96A", x: "75%", y: "60%", s: 600, d: "1.2s" },
          { c: "#5B9BD5", x: "55%", y: "20%", s: 460, d: "0.6s" },
          { c: "#8B5CF6", x: "30%", y: "75%", s: 540, d: "1.8s" },
        ].map((g, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-3xl opacity-25 intro-glow"
            style={{
              background: `radial-gradient(circle, ${g.c} 0%, transparent 70%)`,
              width:  g.s,
              height: g.s,
              left:   g.x,
              top:    g.y,
              transform:      "translate(-50%, -50%)",
              animationDelay: g.d,
            }}
          />
        ))}

        {/* Rising shimmer particles */}
        {Array.from({ length: 28 }).map((_, i) => {
          const left  = (i * 37) % 100;
          const delay = (i * 0.23) % 4;
          const size  = 2 + ((i * 13) % 5);
          const dur   = 7 + ((i * 7)  % 6);
          return (
            <span
              key={i}
              className="absolute rounded-full intro-particle"
              style={{
                left:             `${left}%`,
                bottom:           `-10px`,
                width:             size,
                height:            size,
                background:       "rgba(200,180,255,0.55)",
                boxShadow:        "0 0 8px rgba(150,120,255,0.8)",
                animationDelay:   `${delay}s`,
                animationDuration: `${dur}s`,
              }}
            />
          );
        })}

        {/* Central aurora bloom */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-[1600ms] ease-out"
          style={{
            width:   phase >= 1 ? 820 : 120,
            height:  phase >= 1 ? 820 : 120,
            background:
              "radial-gradient(circle, rgba(200,169,106,0.12) 0%, rgba(91,155,213,0.07) 40%, transparent 70%)",
            opacity: phase >= 1 ? 1 : 0,
            filter:  "blur(14px)",
          }}
        />
      </div>

      {/* Text */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-6 transition-all duration-[1400ms] ease-out"
        style={{
          opacity:   phase >= 1 ? 1 : 0,
          transform: `translateY(${phase >= 1 ? 0 : 18}px)`,
        }}
      >
        {/* 磨 character */}
        <div
          className="text-[7rem] md:text-[10rem] leading-none font-extralight intro-mo"
          style={{
            fontFamily:           '"Cormorant Garamond", "Songti SC", serif',
            background:           "linear-gradient(180deg, #C8A96A 0%, #EDE8D8 50%, #C87A9A 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
            backgroundClip:       "text",
            filter:               "drop-shadow(0 0 40px rgba(200,169,106,0.45))",
          }}
        >
          磨
        </div>

        <div
          className="mt-6 text-[11px] md:text-xs uppercase tracking-[0.55em]"
          style={{ color: "#9094A8" }}
        >
          to refine — with patience
        </div>

        <div
          className="mt-10 text-[10px] tracking-[0.4em] uppercase transition-opacity duration-700"
          style={{ color: "#666A80", opacity: phase >= 1 ? 0.65 : 0 }}
        >
          tap to enter
        </div>
      </div>

      <style>{`
        @keyframes introParticleRise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
        }
        .intro-particle {
          animation-name: introParticleRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes introGlowDrift {
          0%,100% { transform: translate(-50%, -50%) scale(1); }
          50%     { transform: translate(-48%, -52%) scale(1.1); }
        }
        .intro-glow {
          animation: introGlowDrift 10s ease-in-out infinite;
        }
        @keyframes introMoBreathe {
          0%,100% { letter-spacing: 0;      filter: drop-shadow(0 0 30px rgba(200,169,106,0.40)); }
          50%     { letter-spacing: 0.04em; filter: drop-shadow(0 0 60px rgba(200,169,106,0.75)); }
        }
        .intro-mo { animation: introMoBreathe 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ── Mood orb buttons ── */
function MoodButton({
  color,
  accent,
  label,
  onClick,
}: {
  color: string;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { scroll.pulse = Math.min(1, scroll.pulse + 0.4); }}
      className="group flex flex-col items-center gap-4 transition-transform duration-500 hover:scale-110 active:scale-95"
    >
      {/* Outer glow halo — large, always visible */}
      <span className="relative flex items-center justify-center" style={{ width: "clamp(68px, 8vw, 88px)", height: "clamp(68px, 8vw, 88px)" }}>
        {/* Diffuse outer bloom */}
        <span
          className="absolute rounded-full transition-opacity duration-500"
          style={{
            inset: -12,
            background: `radial-gradient(circle, ${color}55 0%, transparent 68%)`,
            filter: "blur(18px)",
            opacity: 0.9,
          }}
        />
        {/* Mid glow ring */}
        <span
          className="absolute inset-0 rounded-full mood-orb-breathe"
          style={{
            background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
            filter: "blur(10px)",
          }}
        />
        {/* Crisp orb */}
        <span
          className="relative rounded-full"
          style={{
            width: "clamp(48px, 5.8vw, 64px)",
            height: "clamp(48px, 5.8vw, 64px)",
            background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, ${color} 50%, ${accent} 100%)`,
            boxShadow: `0 0 0 1.5px ${color}66, 0 4px 24px ${color}BB, 0 8px 48px ${color}66, inset 0 -4px 10px rgba(0,0,0,0.30)`,
          }}
        />
        {/* Specular highlight */}
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "clamp(12px, 1.8vw, 18px)",
            height: "clamp(8px, 1.2vw, 12px)",
            top: 14,
            left: 18,
            background: "rgba(255,255,255,0.45)",
            filter: "blur(4px)",
          }}
        />
      </span>
      <span className="text-[10px] uppercase tracking-[0.5em]" style={{ color: "#9094A8" }}>
        {label}
      </span>
    </button>
  );
}

/* ── Chip / material buttons ── */
function ChipButton({
  color,
  accent,
  label,
  onClick,
}: {
  color: string;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { scroll.pulse = Math.min(1, scroll.pulse + 0.3); }}
      className="group relative px-5 py-2 rounded-full text-[10px] uppercase tracking-[0.4em] backdrop-blur-md border transition-all hover:scale-105 active:scale-95"
      style={{
        background:  "rgba(255,255,255,0.05)",
        borderColor: `${accent}55`,
        color:       "#EDE8D8",
        boxShadow:   `0 6px 22px ${color}28`,
      }}
    >
      <span
        className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          filter:     "blur(12px)",
        }}
      />
      <span className="relative">{label}</span>
    </button>
  );
}

/* ── Side panels — dark glassmorphism ── */
function SidePanel({
  side,
  opacity,
  eyebrow,
  children,
}: {
  side: "left" | "right";
  opacity: number;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 max-w-md px-6 transition-opacity duration-700 ${
        side === "left" ? "left-4 md:left-16 text-left" : "right-4 md:right-16 text-right"
      }`}
      style={{ opacity, visibility: opacity > 0.02 ? "visible" : "hidden" }}
    >
      <div
        className="p-6 rounded-2xl backdrop-blur-md border"
        style={{
          background:  "rgba(8,8,22,0.70)",
          borderColor: "rgba(200,180,255,0.10)",
          boxShadow:
            "0 20px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.5em] mb-3"
          style={{ color: "#9094A8" }}
        >
          {eyebrow}
        </p>
        {children}
      </div>
    </div>
  );
}

/* ── Ambient floating decor — dark aurora blobs + hairlines ── */
function FloatingDecor() {
  const blobs = [
    { c: "#C87A9A", x: "12%", y: "22%", s: 200, d: "0s",   dur: "11s" },
    { c: "#C8A96A", x: "82%", y: "18%", s: 160, d: "1.6s", dur: "13s" },
    { c: "#5B9BD5", x: "78%", y: "72%", s: 220, d: "0.8s", dur: "12s" },
    { c: "#8B5CF6", x: "18%", y: "78%", s: 180, d: "2.2s", dur: "14s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl decor-float"
          style={{
            width:      b.s,
            height:     b.s,
            left:       b.x,
            top:        b.y,
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            opacity:    0.10,
            animationDelay:    b.d,
            animationDuration: b.dur,
          }}
        />
      ))}
      {/* Subtle vertical light hairlines */}
      {[15, 38, 62, 84].map((x, i) => (
        <div
          key={`s-${i}`}
          className="absolute top-0 h-full"
          style={{
            left:       `${x}%`,
            width:       1,
            background:
              "linear-gradient(180deg, transparent, rgba(200,180,255,0.07), transparent)",
            opacity:     0.5,
            transform:  `translateY(${i % 2 ? -10 : 10}%)`,
          }}
        />
      ))}
      <style>{`
        @keyframes decorFloat {
          0%,100% { transform: translate(0, 0)    scale(1);    }
          50%     { transform: translate(12px,-14px) scale(1.06); }
        }
        .decor-float {
          animation-name: decorFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
