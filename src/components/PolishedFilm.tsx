import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, RoundedBox, Sparkles, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ---------------- Global scroll progress (0..1) ---------------- */
const scroll = { p: 0, mood: "idle" as "idle" | "blue" | "black" | "red", pulse: 0 };

/* ---------------- Mascot face shader ---------------- */
const faceVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const faceFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uReveal;   // 0..1 face wakes up
  uniform float uMood;     // 0 idle, 1 blue, 2 black, 3 red
  uniform float uPulse;    // transient pulse 0..1

  float circle(vec2 p, vec2 c, float r, float soft){
    return 1.0 - smoothstep(r, r+soft, length(p-c));
  }

  void main(){
    vec2 uv = vUv;
    // eyes
    float ey = 0.55;
    float blink = step(0.985, fract(uTime*0.13));
    float eyeR = mix(0.07, 0.005, blink);
    float left  = circle(uv, vec2(0.38, ey), eyeR, 0.012);
    float right = circle(uv, vec2(0.62, ey), eyeR, 0.012);

    // smile / mouth (subtle)
    float mouth = smoothstep(0.012, 0.0, abs(uv.y - 0.34 - sin(uv.x*8.0)*0.012)) *
                  step(0.32, uv.x) * step(uv.x, 0.68);
    mouth *= 0.35;

    float face = max(max(left, right), mouth);

    // base screen color by mood
    vec3 cBlue = vec3(0.35, 0.75, 1.0);
    vec3 cBlack= vec3(0.10, 0.18, 0.30);
    vec3 cRed  = vec3(1.0, 0.35, 0.55);
    vec3 cIdle = vec3(0.45, 0.78, 1.0);
    vec3 col = cIdle;
    col = mix(col, cBlue,  smoothstep(0.5,1.5,uMood) * step(uMood,1.5));
    col = mix(col, cBlack, smoothstep(1.5,2.5,uMood) * step(uMood,2.5));
    col = mix(col, cRed,   smoothstep(2.5,3.5,uMood));

    // background screen subtle gradient
    vec3 bg = mix(vec3(0.02,0.05,0.10), col*0.18, smoothstep(0.0,1.0,uv.y));
    bg += 0.12*col*uPulse;

    vec3 final = mix(vec3(0.0), bg + face*col*2.5, uReveal);
    float alpha = uReveal * (0.85 + face*0.15);
    gl_FragColor = vec4(final, alpha);
  }
`;

function Mascot() {
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const { mouse } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uMood: { value: 0 },
      uPulse: { value: 0 },
    }),
    []
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;

    // breathing float
    group.current.position.y = -0.15 + Math.sin(t * 0.9) * 0.06;
    // mouse parallax
    const tx = mouse.x * 0.25;
    const ty = -mouse.y * 0.18;
    group.current.rotation.y += (tx - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (ty - group.current.rotation.x) * 0.04;

    // ending bow (last 10% of scroll)
    const bow = Math.max(0, (scroll.p - 0.9) / 0.1);
    group.current.rotation.x += bow * 0.35;
    group.current.position.y -= bow * 0.4;

    if (mat.current) {
      mat.current.uniforms.uTime.value = t;
      const target = Math.min(1, Math.max(0, (scroll.p - 0.08) / 0.18));
      mat.current.uniforms.uReveal.value +=
        (target - mat.current.uniforms.uReveal.value) * 0.05;
      const moodVal =
        scroll.mood === "blue" ? 1 : scroll.mood === "black" ? 2 : scroll.mood === "red" ? 3 : 0;
      mat.current.uniforms.uMood.value +=
        (moodVal - mat.current.uniforms.uMood.value) * 0.08;
      scroll.pulse *= 0.92;
      mat.current.uniforms.uPulse.value = scroll.pulse;
    }
  });

  return (
    <group ref={group}>
      {/* Body */}
      <RoundedBox args={[1.35, 1.55, 1.0]} radius={0.42} smoothness={6} position={[0, -0.25, 0]}>
        <meshPhysicalMaterial
          color="#050505"
          metalness={0.85}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.6}
          reflectivity={0.9}
        />
      </RoundedBox>

      {/* Subtle metallic chest accent */}
      <mesh position={[0, -0.15, 0.51]}>
        <circleGeometry args={[0.08, 32]} />
        <meshPhysicalMaterial color="#9aa3b2" metalness={1} roughness={0.25} />
      </mesh>

      {/* Head */}
      <group position={[0, 0.85, 0]}>
        <mesh>
          <sphereGeometry args={[0.78, 64, 64]} />
          <meshPhysicalMaterial
            color="#040404"
            metalness={0.9}
            roughness={0.14}
            clearcoat={1}
            clearcoatRoughness={0.04}
            envMapIntensity={1.8}
          />
        </mesh>

        {/* Face screen — a flat disc nestled into the front of the head */}
        <mesh position={[0, 0.0, 0.71]}>
          <circleGeometry args={[0.46, 64]} />
          <shaderMaterial
            ref={mat}
            uniforms={uniforms}
            vertexShader={faceVert}
            fragmentShader={faceFrag}
            transparent
          />
        </mesh>

        {/* glow halo behind face */}
        <pointLight position={[0, 0, 0.6]} intensity={1.2} distance={2.2} color="#5fb8ff" />
      </group>

      {/* Arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.78, -0.2, 0]} rotation={[0, 0, s * 0.15]}>
          <capsuleGeometry args={[0.16, 0.55, 8, 16]} />
          <meshPhysicalMaterial color="#050505" metalness={0.85} roughness={0.18} clearcoat={1} />
        </mesh>
      ))}

      {/* Feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.32, -1.15, 0.05]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshPhysicalMaterial color="#050505" metalness={0.85} roughness={0.18} clearcoat={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Particle system: ambient + signature 磨 ---------------- */
function buildCharTargets(count: number): Float32Array {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 220px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("磨", size / 2, size / 2 + 8);
  const data = ctx.getImageData(0, 0, size, size).data;
  const pts: number[] = [];
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4;
      if (data[i] > 128) pts.push(x, y);
    }
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = (Math.floor(Math.random() * (pts.length / 2))) * 2;
    const x = (pts[j] / size - 0.5) * 4.5;
    const y = -(pts[j + 1] / size - 0.5) * 4.5;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  return out;
}

function Particles() {
  const COUNT = 2400;
  const ref = useRef<THREE.Points>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);
  const targets = useMemo(() => buildCharTargets(COUNT), []);
  const origins = useMemo(() => {
    const a = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // start near mascot center with slight cloud
      const r = 0.4 + Math.random() * 0.2;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      a[i * 3] = r * Math.sin(p) * Math.cos(t);
      a[i * 3 + 1] = r * Math.sin(p) * Math.sin(t) + 0.2;
      a[i * 3 + 2] = r * Math.cos(p);
    }
    return a;
  }, []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // signature progress: scroll segment 0.62..0.82 form character; 0.82..0.9 hold; >0.9 dissipate
    const s = scroll.p;
    let k = 0; // 0 = origin (cloud near mascot), 1 = character target
    if (s < 0.6) k = 0;
    else if (s < 0.78) k = (s - 0.6) / 0.18;
    else if (s < 0.88) k = 1;
    else k = Math.max(0, 1 - (s - 0.88) / 0.06);

    const arr = positions;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const ox = origins[ix],
        oy = origins[ix + 1],
        oz = origins[ix + 2];
      const tx = targets[ix],
        ty = targets[ix + 1],
        tz = targets[ix + 2];
      // ease
      const e = k * k * (3 - 2 * k);
      const wob = Math.sin(t * 1.3 + i * 0.07) * 0.04 * (1 - e);
      arr[ix] = ox + (tx - ox) * e + wob;
      arr[ix + 1] = oy + (ty - oy) * e + wob;
      arr[ix + 2] = oz + (tz - oz) * e;
    }
    if (ref.current) {
      const attr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.array = arr;
      attr.needsUpdate = true;
    }
    if (mat.current) {
      mat.current.opacity = 0.05 + k * 0.85;
      mat.current.size = 0.018 + k * 0.012;
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
        size={0.02}
        color="#9ed6ff"
        transparent
        opacity={0.1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/* ---------------- Camera rig driven by scroll ---------------- */
function CameraRig() {
  const { camera, mouse } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  useFrame(() => {
    const p = scroll.p;
    // keyframes
    // 0.0 dark wide / off-axis
    // 0.2 reveal closer
    // 0.4 hero orbit
    // 0.6 pulled back for signature
    // 0.95 ending soft
    let pos = new THREE.Vector3();
    if (p < 0.2) {
      const k = p / 0.2;
      pos.set(0.4, 0.3, 7 - k * 1.5);
    } else if (p < 0.45) {
      const k = (p - 0.2) / 0.25;
      const a = k * Math.PI * 0.6 - 0.3;
      pos.set(Math.sin(a) * 4.2, 0.4 + k * 0.2, Math.cos(a) * 4.2);
    } else if (p < 0.6) {
      const k = (p - 0.45) / 0.15;
      pos.set(Math.sin(0.6) * (4.2 + k * 0.6), 0.6, Math.cos(0.6) * (4.2 + k * 0.4));
    } else if (p < 0.88) {
      const k = (p - 0.6) / 0.28;
      pos.set(0, 0.2, 6 + k * 1.5);
    } else {
      const k = (p - 0.88) / 0.12;
      pos.set(0, -0.2 + k * 0.1, 6.5 + k * 0.8);
    }
    // micro parallax
    pos.x += mouse.x * 0.15;
    pos.y += mouse.y * 0.1;
    camera.position.lerp(pos, 0.06);
    target.set(0, 0.1, 0);
    camera.lookAt(target);
  });
  return null;
}

/* ---------------- Lighting that responds to mood + scroll ---------------- */
function MoodLights() {
  const rim = useRef<THREE.PointLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  const fill = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const reveal = Math.min(1, Math.max(0, (scroll.p - 0.05) / 0.25));
    if (key.current) key.current.intensity = 0.2 + reveal * 1.3;
    const moodK = scroll.mood;
    const target = new THREE.Color(
      moodK === "blue" ? "#4aa9ff" :
      moodK === "red" ? "#ff5f7a" :
      moodK === "black" ? "#1a2030" : "#7fbfff"
    );
    if (rim.current) {
      rim.current.color.lerp(target, 0.08);
      rim.current.intensity = (moodK === "black" ? 0.4 : 1.6) * reveal;
    }
    if (fill.current) {
      const fillTarget = new THREE.Color(moodK === "red" ? "#ff8aa0" : "#9ec8ff");
      fill.current.color.lerp(fillTarget, 0.08);
      fill.current.intensity = (moodK === "black" ? 0.2 : 0.9) * reveal;
    }
  });
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight ref={key} position={[2.5, 3.5, 2]} intensity={0.2} color="#ffffff" />
      <pointLight ref={rim} position={[-3, 2, -2]} intensity={0} color="#7fbfff" distance={12} />
      <pointLight ref={fill} position={[3, -1, 2]} intensity={0} color="#9ec8ff" distance={10} />
    </>
  );
}

/* ---------------- Scene ---------------- */
function Scene() {
  return (
    <>
      <color attach="background" args={["#020205"]} />
      <fog attach="fog" args={["#020205", 6, 18]} />
      <CameraRig />
      <MoodLights />
      <Suspense fallback={null}>
        <Mascot />
        <Environment preset="studio" environmentIntensity={0.35} />
      </Suspense>
      <ContactShadows
        position={[0, -1.45, 0]}
        opacity={0.55}
        scale={8}
        blur={3}
        far={3}
        color="#000000"
      />
      <Particles />
      <Sparkles count={50} scale={[8, 6, 6]} size={1.4} speed={0.15} color="#9ec8ff" opacity={0.4} />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.4} mipmapBlur />
        <ChromaticAberration offset={[0.0006, 0.0006] as unknown as THREE.Vector2} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </>
  );
}

/* ---------------- HUD with sections + interaction buttons ---------------- */
export default function PolishedFilm() {
  const [mounted, setMounted] = useState(false);
  const [, force] = useState(0);
  const [interactVisible, setInteractVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      scroll.p = Math.min(1, Math.max(0, window.scrollY / h));
      // section 3 visibility for buttons
      setInteractVisible(scroll.p > 0.4 && scroll.p < 0.62);
      force((n) => n + 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const setMood = (m: "blue" | "black" | "red") => {
    scroll.mood = m;
    scroll.pulse = 1;
    setTimeout(() => {
      if (scroll.mood === m) scroll.mood = "idle";
    }, 2600);
  };

  if (!mounted) {
    return <div className="fixed inset-0 bg-black" />;
  }

  const p = scroll.p;
  const fadeIntro = p < 0.08 ? 1 : Math.max(0, 1 - (p - 0.08) / 0.06);
  const heroOn = p > 0.18 && p < 0.42 ? 1 : 0;
  const sigOn = p > 0.78 && p < 0.9 ? 1 : 0;
  const endOn = p > 0.92 ? Math.min(1, (p - 0.92) / 0.04) : 0;

  return (
    <>
      {/* Fixed cinematic canvas */}
      <div className="fixed inset-0 z-0 bg-black">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.3, 7], fov: 38 }}
        >
          <Scene />
        </Canvas>
        {/* film grain + subtle gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
            mixBlendMode: "multiply",
          }}
        />
        {/* End fade-to-black */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-700"
          style={{ opacity: endOn * 0.85 }}
        />
      </div>

      {/* HUD */}
      <div className="pointer-events-none fixed inset-0 z-10">
        {/* Top brand */}
        <div className="absolute top-6 left-6 md:top-8 md:left-10 flex items-center gap-3 opacity-80">
          <div className="h-1.5 w-1.5 rounded-full bg-white/90" />
          <p className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-white/70">
            Polish Design Studio
          </p>
        </div>
        <div className="absolute top-6 right-6 md:top-8 md:right-10 text-right opacity-70">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-white/60">
            Chapter {p < 0.18 ? "01" : p < 0.42 ? "02" : p < 0.62 ? "03" : p < 0.9 ? "04" : "05"}
          </p>
        </div>

        {/* Section 1 — Intro */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-1000"
          style={{ opacity: fadeIntro }}
        >
          <p
            className="text-7xl md:text-9xl font-light tracking-tight text-white"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            磨
          </p>
          <p className="mt-6 text-xs md:text-sm uppercase tracking-[0.55em] text-white/55">
            to refine — with patience
          </p>
          <p className="mt-16 text-[10px] uppercase tracking-[0.5em] text-white/35">
            scroll to begin
          </p>
        </div>

        {/* Section 2 — Hero label */}
        <div
          className="absolute bottom-12 left-0 right-0 flex flex-col items-center transition-opacity duration-700"
          style={{ opacity: heroOn }}
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em] text-white/55">
            meet the polished man
          </p>
          <p className="mt-3 text-2xl md:text-4xl font-extralight tracking-[0.25em] text-white/90">
            A QUIET COMPANION
          </p>
        </div>

        {/* Section 3 — Interaction buttons */}
        <div
          className={`absolute bottom-16 left-0 right-0 flex flex-col items-center gap-6 transition-opacity duration-700 ${
            interactVisible ? "opacity-100 pointer-events-auto" : "opacity-0"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.55em] text-white/50">
            press to feel
          </p>
          <div className="flex items-center gap-5">
            <MoodButton color="#3a8dff" label="calm" onClick={() => setMood("blue")} />
            <MoodButton color="#0a0a0a" label="still" border onClick={() => setMood("black")} />
            <MoodButton color="#ff4d6d" label="love" heart onClick={() => setMood("red")} />
          </div>
        </div>

        {/* Section 4 — Signature label */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center transition-opacity duration-700"
          style={{ opacity: sigOn }}
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.55em] text-white/55">
            from particle to permanence
          </p>
          <p
            className="mt-6 text-3xl md:text-5xl font-light tracking-[0.35em] text-white"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            POLISH&nbsp;&nbsp;DESIGN
          </p>
        </div>

        {/* Section 5 — Ending */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-1000"
          style={{ opacity: endOn }}
        >
          <p className="text-xs uppercase tracking-[0.55em] text-white/50">
            crafted with patience
          </p>
          <p className="mt-4 text-2xl md:text-3xl font-extralight tracking-[0.35em] text-white/85">
            POLISH DESIGN
          </p>
          <p className="mt-12 text-[10px] uppercase tracking-[0.55em] text-white/30">
            est. five years
          </p>
        </div>

        {/* Scroll progress rail */}
        <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 h-40 w-px bg-white/10">
          <div
            className="absolute left-0 top-0 w-px bg-white/70 transition-all"
            style={{ height: `${p * 100}%` }}
          />
        </div>
      </div>

      {/* Scroll spacer (six full screens) */}
      <div className="relative z-0" style={{ height: "600vh" }} />
    </>
  );
}

function MoodButton({
  color,
  label,
  onClick,
  border,
  heart,
}: {
  color: string;
  label: string;
  onClick: () => void;
  border?: boolean;
  heart?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition-transform hover:scale-[1.06] active:scale-95"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all group-hover:shadow-[0_8px_40px_rgba(255,255,255,0.18)]"
        style={{
          background: heart
            ? `radial-gradient(circle at 30% 30%, #ff8aa0, ${color})`
            : `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), ${color})`,
          border: border ? "1px solid rgba(255,255,255,0.18)" : "none",
        }}
      >
        {heart ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/95">
            <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 4 0 6.5 4.5 4.5 8.5C19 16.65 12 21 12 21z" />
          </svg>
        ) : null}
      </span>
      <span className="text-[10px] uppercase tracking-[0.4em] text-white/60">{label}</span>
    </button>
  );
}
