import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { useTexture, Sparkles, Environment } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import mascotUrl from "@/assets/polished-man.png";

/* -------------------- Iridescent shader background -------------------- */
const bgVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }
`;
const bgFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uMouse;

  // cheap hash noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
  }

  void main(){
    vec2 uv = vUv;
    vec2 p  = (uv - 0.5);
    p.x *= 1.6;
    float d = length(p - uMouse*0.15);

    float n = noise(uv*3.0 + uTime*0.05);
    float n2= noise(uv*8.0 - uTime*0.08);

    // iridescent palette
    vec3 c1 = vec3(0.05,0.02,0.12);
    vec3 c2 = vec3(0.55,0.10,0.45);
    vec3 c3 = vec3(0.95,0.35,0.20);
    vec3 c4 = vec3(0.10,0.45,0.95);

    vec3 col = mix(c1, c2, smoothstep(0.0,0.7, n + d*0.4));
    col = mix(col, c3, smoothstep(0.5,1.0, n2 - d*0.6));
    col = mix(col, c4, smoothstep(0.65,1.0, sin(uTime*0.3 + uv.x*4.0)*0.5+0.5)*0.35);

    // vignette
    float v = smoothstep(1.1, 0.2, length(p));
    col *= v;

    // grain
    col += (hash(uv*1000.0 + uTime)-0.5)*0.025;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop() {
  const ref = useRef<THREE.ShaderMaterial>(null!);
  const { mouse } = useThree();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.uniforms.uTime.value += dt;
    const m = ref.current.uniforms.uMouse.value as THREE.Vector2;
    m.x += (mouse.x - m.x) * 0.05;
    m.y += (mouse.y - m.y) * 0.05;
  });
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() } }),
    []
  );
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={bgVertex}
        fragmentShader={bgFragment}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* -------------------- Mascot plane with chroma key & tilt -------------------- */
const mascotFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uHover;
  void main(){
    vec4 c = texture2D(uMap, vUv);
    // remove pale background (#eef3fa-ish)
    float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
    float bg = smoothstep(0.86, 0.96, lum) * step(0.85, min(c.r, min(c.g, c.b)));
    float a = 1.0 - bg;
    if (a < 0.05) discard;

    // subtle rim shimmer
    float rim = pow(1.0 - vUv.y, 2.0);
    vec3 col = c.rgb;
    col += rim * vec3(0.8,0.4,1.0) * (0.10 + uHover*0.25);
    // hover saturation pump
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(l), col, 1.0 + uHover*0.4);

    gl_FragColor = vec4(col, a);
  }
`;
const mascotVert = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function Mascot({ onClick }: { onClick: (p: THREE.Vector3) => void }) {
  const tex = useTexture(mascotUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const { mouse } = useThree();

  // size based on image aspect (≈ 612/460)
  const aspect = 612 / 460;
  const h = 4.2;
  const w = h * aspect;

  useFrame((state, dt) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // bob
    group.current.position.y = Math.sin(t * 1.2) * 0.12;
    // mouse tilt
    const tx = mouse.x * 0.35;
    const ty = -mouse.y * 0.25;
    group.current.rotation.y += (tx - group.current.rotation.y) * 0.08;
    group.current.rotation.x += (ty - group.current.rotation.x) * 0.08;

    if (mat.current) {
      mat.current.uniforms.uTime.value += dt;
      const target = hovered ? 1 : 0;
      mat.current.uniforms.uHover.value +=
        (target - mat.current.uniforms.uHover.value) * 0.1;
    }
  });

  const uniforms = useMemo(
    () => ({ uMap: { value: tex }, uTime: { value: 0 }, uHover: { value: 0 } }),
    [tex]
  );

  return (
    <group ref={group}>
      {/* soft glow disc behind */}
      <mesh position={[0, 0.2, -0.6]}>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color={"#ff7ad9"} transparent opacity={0.18} />
      </mesh>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => onClick(e.point)}
      >
        <planeGeometry args={[w, h, 1, 1]} />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={mascotVert}
          fragmentShader={mascotFrag}
          transparent
        />
      </mesh>
    </group>
  );
}

/* -------------------- Bouncing gem balls (tiny physics) -------------------- */
type Gem = { id: number; pos: THREE.Vector3; vel: THREE.Vector3; color: string; life: number };

function Gems({ gems, setGems }: { gems: Gem[]; setGems: React.Dispatch<React.SetStateAction<Gem[]>> }) {
  useFrame((_, dt) => {
    setGems((prev) => {
      const floorY = -3.0;
      const next: Gem[] = [];
      for (const g of prev) {
        g.vel.y -= 9.8 * dt;
        g.pos.addScaledVector(g.vel, dt);
        if (g.pos.y < floorY) {
          g.pos.y = floorY;
          g.vel.y *= -0.62;
          g.vel.x *= 0.85;
        }
        g.life -= dt;
        if (g.life > 0) next.push(g);
      }
      return next;
    });
  });
  return (
    <>
      {gems.map((g) => (
        <mesh key={g.id} position={g.pos.toArray()}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <meshPhysicalMaterial
            color={g.color}
            metalness={0.2}
            roughness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.05}
            emissive={g.color}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </>
  );
}

/* -------------------- Scene -------------------- */
function Scene() {
  const [gems, setGems] = useState<Gem[]>([]);
  const idRef = useRef(0);
  const colors = ["#3b6df0", "#e0e3eb", "#e94234", "#f0a73b", "#9b51e0"];

  const spawn = (p: THREE.Vector3) => {
    const burst = 6 + Math.floor(Math.random() * 4);
    setGems((prev) => {
      const add: Gem[] = [];
      for (let i = 0; i < burst; i++) {
        add.push({
          id: idRef.current++,
          pos: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, 0.1)),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            2 + Math.random() * 2.5,
            (Math.random() - 0.5) * 1.2
          ),
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 4.5,
        });
      }
      return [...prev, ...add].slice(-80);
    });
  };

  return (
    <>
      <Backdrop />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <pointLight position={[-3, 2, 3]} intensity={1.5} color={"#ff5fa2"} />
      <pointLight position={[3, -2, 3]} intensity={1.2} color={"#5fb0ff"} />
      <Suspense fallback={null}>
        <Mascot onClick={spawn} />
        <Environment preset="city" />
      </Suspense>
      <Sparkles count={120} scale={12} size={3} speed={0.4} color={"#ffd1f0"} />
      <Sparkles count={60} scale={18} size={6} speed={0.2} color={"#9bd0ff"} />
      <Gems gems={gems} setGems={setGems} />
    </>
  );
}

export default function Sanctuary() {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-foreground/60">Polished Design</p>
            <h1 className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight text-foreground">
              The Polished Man
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.4em] text-foreground/60">Anniversary</p>
            <p className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-primary via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
              5 Years
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <p className="max-w-sm text-xs md:text-sm text-foreground/60 leading-relaxed">
            A small sanctuary for our mascot. Move your cursor to tilt him.
            Click anywhere to release the gems.
          </p>
          <p
            className={`text-xs uppercase tracking-[0.3em] text-foreground/50 transition-opacity duration-700 ${
              hint ? "opacity-100" : "opacity-30"
            }`}
          >
            ◦ click to play ◦
          </p>
        </div>
      </div>
    </div>
  );
}
