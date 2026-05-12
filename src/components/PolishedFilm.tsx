import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Sparkles, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ---------------- Global scroll state ---------------- */
const scroll = { p: 0, mood: "idle" as "idle" | "rose" | "gold" | "sky", pulse: 0, hover: 0 };

/* ---------------- Soft pastel color palette ---------------- */
const PALETTE = {
  rose: "#f7c8d4",
  blush: "#f9d9e0",
  gold: "#e8c890",
  ivory: "#fbf3e6",
  sky: "#cfe1f0",
  pearl: "#ffffff",
  mauve: "#c8a3b6",
};

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

    // hover/mood pulse on inner glow
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

  // mood color
  const moodColor = useMemo(() => new THREE.Color(PALETTE.rose), []);
  useFrame(() => {
    const target = new THREE.Color(
      scroll.mood === "rose" ? PALETTE.rose :
      scroll.mood === "gold" ? PALETTE.gold :
      scroll.mood === "sky" ? PALETTE.sky : PALETTE.blush
    );
    moodColor.lerp(target, 0.05);
    if (inner.current) {
      const m = inner.current.material as THREE.MeshStandardMaterial;
      m.emissive = moodColor;
    }
  });

  return (
    <group ref={group} scale={1.9}>
      {/* Outer glow halo */}
      <mesh ref={halo} position={[0, 0.1, -0.4]}>
        <ringGeometry args={[1.2, 1.9, 64]} />
        <meshBasicMaterial color={PALETTE.rose} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Soft polished capsule body — intentionally visible placeholder silhouette */}
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <mesh position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.62, 0.9, 24, 48]} />
          <meshPhysicalMaterial
            color={PALETTE.blush}
            emissive={PALETTE.rose}
            emissiveIntensity={0.22}
            roughness={0.18}
            metalness={0.18}
            clearcoat={1}
            clearcoatRoughness={0.08}
            transparent
            opacity={0.84}
          />
        </mesh>

        {/* Readable rose-gold rim so the mascot never disappears on light or dark chapters */}
        <mesh position={[0, -0.1, -0.03]} scale={1.04}>
          <capsuleGeometry args={[0.62, 0.9, 24, 48]} />
          <meshBasicMaterial color={PALETTE.gold} transparent opacity={0.22} side={THREE.BackSide} />
        </mesh>

        {/* Inner glowing core */}
        <mesh ref={inner} position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.42, 48, 48]} />
          <meshStandardMaterial
            color={PALETTE.ivory}
            emissive={PALETTE.rose}
            emissiveIntensity={0.9}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>

        {/* Tiny gold orbiting dot */}
        <mesh position={[0.85, 0.4, 0.2]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={1.2} />
        </mesh>
      </Float>

      {/* Pedestal disc */}
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 1.1, 64]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- Soft volumetric backdrop ---------------- */
function Backdrop() {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColorA: { value: new THREE.Color("#fbe9ef") }, // soft rose
      uColorB: { value: new THREE.Color("#f4e6d0") }, // warm ivory
      uColorC: { value: new THREE.Color("#dde9f3") }, // gentle blue
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
            // soft vignette warmth
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
    // Keep mascot always framed — gentle dolly only.
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
  const key = useRef<THREE.DirectionalLight>(null!);
  const rim = useRef<THREE.PointLight>(null!);
  const fill = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const reveal = Math.min(1, Math.max(0, (scroll.p - 0.04) / 0.2));
    if (key.current) key.current.intensity = 0.4 + reveal * 1.0;
    const target = new THREE.Color(
      scroll.mood === "rose" ? PALETTE.rose :
      scroll.mood === "gold" ? PALETTE.gold :
      scroll.mood === "sky" ? PALETTE.sky : PALETTE.blush
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
      <pointLight ref={rim} position={[-3, 1.5, -1]} intensity={0.8} color={PALETTE.rose} distance={12} />
      <pointLight ref={fill} position={[3, -0.5, 2]} intensity={0.4} color={PALETTE.ivory} distance={10} />
    </>
  );
}

/* ---------------- Signature petals (particles forming a soft bloom) ---------------- */
function Petals() {
  const COUNT = 1200;
  const ref = useRef<THREE.Points>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);
  const { origins, targets } = useMemo(() => {
    const o = new Float32Array(COUNT * 3);
    const t = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // origin: cloud near mascot
      const r = 0.5 + Math.random() * 0.4;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      o[i * 3] = r * Math.sin(b) * Math.cos(a);
      o[i * 3 + 1] = r * Math.sin(b) * Math.sin(a) * 0.6;
      o[i * 3 + 2] = r * Math.cos(b);
      // target: rose/spiral bloom
      const k = i / COUNT;
      const ang = k * Math.PI * 12;
      const rad = 0.3 + k * 1.7;
      t[i * 3] = Math.cos(ang) * rad;
      t[i * 3 + 1] = Math.sin(ang) * rad * 0.55 + (Math.random() - 0.5) * 0.1;
      t[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return { origins: o, targets: t };
  }, []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const sp = scroll.p;
    let k = 0;
    if (sp < 0.62) k = 0;
    else if (sp < 0.8) k = (sp - 0.62) / 0.18;
    else if (sp < 0.9) k = 1;
    else k = Math.max(0, 1 - (sp - 0.9) / 0.06);
    const e = k * k * (3 - 2 * k);
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const wob = Math.sin(t * 1.1 + i * 0.05) * 0.05 * (1 - e);
      positions[ix] = origins[ix] + (targets[ix] - origins[ix]) * e + wob;
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
      mat.current.size = 0.025 + e * 0.02;
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
function Scene() {
  return (
    <>
      <fog attach="fog" args={["#fbe9ef", 9, 22]} />
      <Backdrop />
      <CameraRig />
      <MoodLights />
      <Suspense fallback={null}>
        <MascotPlaceholder />
        <Environment preset="apartment" environmentIntensity={0.5} />
      </Suspense>
      <ContactShadows
        position={[0, -0.95, 0]}
        opacity={0.35}
        scale={6}
        blur={3.2}
        far={2.5}
        color="#b58aa0"
      />
      <Petals />
      <Sparkles count={70} scale={[10, 6, 6]} size={2} speed={0.18} color={PALETTE.gold} opacity={0.55} />
      <Sparkles count={40} scale={[14, 8, 8]} size={1.2} speed={0.1} color={PALETTE.rose} opacity={0.4} />
      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.6} luminanceSmoothing={0.5} mipmapBlur />
        <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.5} darkness={0.18} />
      </EffectComposer>
    </>
  );
}

/* ---------------- HUD ---------------- */
export default function PolishedFilm() {
  const [mounted, setMounted] = useState(false);
  const [, force] = useState(0);
  const [interactVisible, setInteractVisible] = useState(false);
  const [introPhase, setIntroPhase] = useState<0 | 1 | 2 | 3>(0);
  // 0 = gradient only, 1 = text in, 2 = bloom reveal, 3 = fully gone

  useEffect(() => {
    setMounted(true);
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      scroll.p = Math.min(1, Math.max(0, window.scrollY / h));
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
    };
  }, []);

  const setMood = (m: "rose" | "gold" | "sky") => {
    scroll.mood = m;
    scroll.pulse = 1;
    setTimeout(() => {
      if (scroll.mood === m) scroll.mood = "idle";
    }, 2800);
  };

  if (!mounted) return <div className="fixed inset-0" style={{ background: PALETTE.blush }} />;

  const p = scroll.p;
  const fadeIntro = p < 0.08 ? 1 : Math.max(0, 1 - (p - 0.08) / 0.07);
  const heroOn = p > 0.18 && p < 0.42 ? 1 : 0;
  const sigOn = p > 0.78 && p < 0.92 ? 1 : 0;
  const endOn = p > 0.93 ? Math.min(1, (p - 0.93) / 0.04) : 0;
  const chapter = p < 0.18 ? "I" : p < 0.42 ? "II" : p < 0.62 ? "III" : p < 0.92 ? "IV" : "V";

  return (
    <>
      {/* Cinematic canvas */}
      <div className="fixed inset-0 z-0" style={{ background: "linear-gradient(180deg,#fbe9ef 0%,#f4e6d0 60%,#dde9f3 100%)" }}>
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.3, 6.5], fov: 38 }}
        >
          <Scene />
        </Canvas>

        {/* Soft warm corners — subtle, never darkens scene */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 70%, rgba(232,200,144,0.10) 100%)",
          }}
        />
        {/* End fade — pastel, gentle */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{ opacity: endOn * 0.45, background: "linear-gradient(180deg,#fbf3e6,#f9d9e0)" }}
        />
      </div>

      {/* HUD */}
      <div className="pointer-events-none fixed inset-0 z-10" style={{ color: "#5a3b48" }}>
        {/* Top brand */}
        <div className="absolute top-6 left-6 md:top-9 md:left-12 flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#c8a3b6" }} />
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em]" style={{ color: "#8a6677" }}>
            Polish · Atelier
          </p>
        </div>
        <div className="absolute top-6 right-6 md:top-9 md:right-12 text-right">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em]" style={{ color: "#8a6677" }}>
            Chapter&nbsp;&nbsp;{chapter}&nbsp;·&nbsp;Five Years of Patience
          </p>
        </div>

        {/* Bottom-left meta */}
        <div className="absolute bottom-6 left-6 md:bottom-9 md:left-12 max-w-[220px]">
          <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: "#a98598" }}>
            an interactive bloom
          </p>
          <p className="mt-2 text-[10px] tracking-wider" style={{ color: "#a98598" }}>
            scroll &nbsp;·&nbsp; hover &nbsp;·&nbsp; press
          </p>
        </div>

        {/* Section 1 — Intro */}
        <div
          className="absolute inset-x-0 top-[6%] flex flex-col items-center text-center transition-opacity duration-1000"
          style={{ opacity: fadeIntro }}
        >
          <p
            className="text-[7rem] md:text-[9rem] leading-none font-light"
            style={{
              fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
              color: "transparent",
              backgroundImage: "linear-gradient(180deg,#c8a3b6,#e8c890)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 4px 24px rgba(200,140,160,0.35))",
            }}
          >
            磨
          </p>
          <p className="mt-3 text-xs md:text-sm uppercase tracking-[0.6em]" style={{ color: "#8a6677" }}>
            to refine — with patience
          </p>
          <div className="mt-6 flex items-center gap-3" style={{ color: "#a98598" }}>
            <span className="h-px w-16" style={{ background: "currentColor" }} />
            <span className="text-[10px] uppercase tracking-[0.6em]">scroll to bloom</span>
            <span className="h-px w-16" style={{ background: "currentColor" }} />
          </div>
        </div>

        {/* Section 2 — Hero */}
        <div
          className="absolute bottom-24 left-0 right-0 flex flex-col items-center transition-opacity duration-700"
          style={{ opacity: heroOn }}
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.6em]" style={{ color: "#8a6677" }}>
            meet the polished one
          </p>
          <p
            className="mt-3 text-3xl md:text-5xl font-light tracking-[0.3em]"
            style={{
              color: "transparent",
              backgroundImage: "linear-gradient(120deg,#a36b80,#e8c890,#a36b80)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >
            A QUIET COMPANION
          </p>
          {/* Floating side panels */}
          <div className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 flex-col gap-4 pl-12">
            <div className="px-4 py-3 rounded-xl backdrop-blur-md border" style={{ background: "rgba(255,255,255,0.35)", borderColor: "rgba(200,140,160,0.35)" }}>
              <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: "#8a6677" }}>Material</p>
              <p className="text-sm" style={{ color: "#5a3b48" }}>Hand-poured glass</p>
            </div>
            <div className="px-4 py-3 rounded-xl backdrop-blur-md border" style={{ background: "rgba(255,255,255,0.35)", borderColor: "rgba(200,140,160,0.35)" }}>
              <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: "#8a6677" }}>Finish</p>
              <p className="text-sm" style={{ color: "#5a3b48" }}>Polished rose gold</p>
            </div>
          </div>
          <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 flex-col gap-4 pr-12 items-end">
            <div className="px-4 py-3 rounded-xl backdrop-blur-md border" style={{ background: "rgba(255,255,255,0.35)", borderColor: "rgba(200,140,160,0.35)" }}>
              <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: "#8a6677" }}>Mood</p>
              <p className="text-sm" style={{ color: "#5a3b48" }}>Soft &amp; luminous</p>
            </div>
            <div className="px-4 py-3 rounded-xl backdrop-blur-md border" style={{ background: "rgba(255,255,255,0.35)", borderColor: "rgba(200,140,160,0.35)" }}>
              <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: "#8a6677" }}>Origin</p>
              <p className="text-sm" style={{ color: "#5a3b48" }}>Atelier No. 5</p>
            </div>
          </div>
        </div>

        {/* Section 3 — Interactive moods */}
        <div
          className={`absolute bottom-20 left-0 right-0 flex flex-col items-center gap-6 transition-opacity duration-700 ${
            interactVisible ? "opacity-100 pointer-events-auto" : "opacity-0"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.6em]" style={{ color: "#8a6677" }}>
            press a feeling
          </p>
          <div className="flex items-center gap-8">
            <MoodButton color={PALETTE.rose} accent="#a36b80" label="tenderness" onClick={() => setMood("rose")} />
            <MoodButton color={PALETTE.gold} accent="#a07a3c" label="warmth" onClick={() => setMood("gold")} />
            <MoodButton color={PALETTE.sky} accent="#6f8aa3" label="serenity" onClick={() => setMood("sky")} />
          </div>
          <p className="text-[10px] tracking-[0.4em]" style={{ color: "#a98598" }}>
            the room responds
          </p>
        </div>

        {/* Section 4 — Signature */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center transition-opacity duration-700"
          style={{ opacity: sigOn }}
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.6em]" style={{ color: "#8a6677" }}>
            from a whisper to a bloom
          </p>
          <p
            className="mt-6 text-3xl md:text-5xl font-light tracking-[0.4em]"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              color: "transparent",
              backgroundImage: "linear-gradient(120deg,#a36b80,#e8c890,#cfe1f0,#a36b80)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            POLISH&nbsp;&nbsp;ATELIER
          </p>
          <p className="mt-4 text-xs tracking-[0.45em]" style={{ color: "#a98598" }}>
            est. five years &nbsp;·&nbsp; crafted in light
          </p>
        </div>

        {/* Section 5 — Ending */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-1000"
          style={{ opacity: endOn }}
        >
          <p className="text-xs uppercase tracking-[0.6em]" style={{ color: "#8a6677" }}>
            crafted with patience
          </p>
          <p
            className="mt-4 text-2xl md:text-3xl font-extralight tracking-[0.4em]"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#5a3b48" }}
          >
            until next bloom
          </p>
          <div className="mt-10 flex items-center gap-6 text-[10px] uppercase tracking-[0.5em]" style={{ color: "#a98598" }}>
            <span>instagram</span>
            <span className="h-px w-8" style={{ background: "currentColor" }} />
            <span>journal</span>
            <span className="h-px w-8" style={{ background: "currentColor" }} />
            <span>contact</span>
          </div>
        </div>

        {/* Vertical scroll rail */}
        <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 h-44 w-px" style={{ background: "rgba(168,116,140,0.25)" }}>
          <div
            className="absolute left-0 top-0 w-px transition-all"
            style={{ height: `${p * 100}%`, background: "linear-gradient(180deg,#a36b80,#e8c890)" }}
          />
          <div
            className="absolute -left-1 w-2 h-2 rounded-full transition-all"
            style={{ top: `calc(${p * 100}% - 4px)`, background: "#e8c890", boxShadow: "0 0 12px rgba(232,200,144,0.8)" }}
          />
        </div>
      </div>

      {/* Scroll spacer */}
      <div className="relative z-0" style={{ height: "650vh" }} />

      {/* Cinematic intro overlay */}
      <IntroOverlay phase={introPhase} onSkip={() => setIntroPhase(3)} />
    </>
  );
}

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
          "radial-gradient(ellipse at 50% 40%, #fff7f1 0%, #f9dee6 35%, #efd6c4 65%, #d8e4ef 100%)",
      }}
    >
      {/* soft drifting glows */}
      <div className="pointer-events-none absolute inset-0">
        {[
          { c: "#f7c8d4", x: "20%", y: "30%", s: 520, d: "0s" },
          { c: "#e8c890", x: "75%", y: "60%", s: 600, d: "1.2s" },
          { c: "#cfe1f0", x: "55%", y: "20%", s: 460, d: "0.6s" },
          { c: "#f9d9e0", x: "30%", y: "75%", s: 540, d: "1.8s" },
        ].map((g, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-3xl opacity-60 intro-glow"
            style={{
              background: `radial-gradient(circle, ${g.c} 0%, transparent 70%)`,
              width: g.s,
              height: g.s,
              left: g.x,
              top: g.y,
              transform: "translate(-50%, -50%)",
              animationDelay: g.d,
            }}
          />
        ))}
        {/* floating particles */}
        {Array.from({ length: 28 }).map((_, i) => {
          const left = (i * 37) % 100;
          const delay = (i * 0.23) % 4;
          const size = 2 + ((i * 13) % 5);
          const dur = 7 + ((i * 7) % 6);
          return (
            <span
              key={i}
              className="absolute rounded-full intro-particle"
              style={{
                left: `${left}%`,
                bottom: `-10px`,
                width: size,
                height: size,
                background: "rgba(255,255,255,0.85)",
                boxShadow: "0 0 12px rgba(255,220,230,0.9)",
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
              }}
            />
          );
        })}
        {/* central spotlight bloom for reveal */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-[1600ms] ease-out"
          style={{
            width: phase >= 1 ? 720 : 120,
            height: phase >= 1 ? 720 : 120,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,236,224,0.4) 35%, transparent 70%)",
            opacity: phase >= 1 ? 1 : 0,
            filter: "blur(8px)",
          }}
        />
      </div>

      {/* Text */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-6 transition-all duration-[1400ms] ease-out"
        style={{
          color: "#5a3b48",
          opacity: phase >= 1 ? 1 : 0,
          transform: `translateY(${phase >= 1 ? 0 : 18}px)`,
        }}
      >
        <div
          className="text-[7rem] md:text-[10rem] leading-none font-extralight intro-mo"
          style={{
            fontFamily: '"Cormorant Garamond", "Songti SC", serif',
            background:
              "linear-gradient(180deg, #6a4452 0%, #b88a78 50%, #8a6677 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 40px rgba(247,200,212,0.5)",
          }}
        >
          磨
        </div>
        <div
          className="mt-6 text-[11px] md:text-xs uppercase tracking-[0.55em]"
          style={{ color: "#8a6677" }}
        >
          to refine — with patience
        </div>
        <div
          className="mt-10 text-[10px] tracking-[0.4em] uppercase opacity-60 transition-opacity duration-700"
          style={{ color: "#a98598", opacity: phase >= 1 ? 0.6 : 0 }}
        >
          tap to enter
        </div>
      </div>

      <style>{`
        @keyframes introParticleRise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
        }
        .intro-particle {
          animation-name: introParticleRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes introGlowDrift {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-48%, -52%) scale(1.08); }
        }
        .intro-glow {
          animation: introGlowDrift 9s ease-in-out infinite;
        }
        @keyframes introMoBreathe {
          0%, 100% { letter-spacing: 0; filter: drop-shadow(0 0 30px rgba(247,200,212,0.4)); }
          50% { letter-spacing: 0.04em; filter: drop-shadow(0 0 50px rgba(247,200,212,0.7)); }
        }
        .intro-mo { animation: introMoBreathe 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

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
      className="group flex flex-col items-center gap-3 transition-transform duration-500 hover:scale-110 active:scale-95"
    >
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full">
        <span
          className="absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-md"
          style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
        />
        <span
          className="relative h-12 w-12 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), ${color} 60%, ${accent})`,
            boxShadow: `0 8px 30px ${color}88, inset 0 -3px 8px rgba(0,0,0,0.06)`,
          }}
        />
      </span>
      <span className="text-[10px] uppercase tracking-[0.45em]" style={{ color: "#8a6677" }}>
        {label}
      </span>
    </button>
  );
}
