import { r as reactExports, j as jsxRuntimeExports, e as ee } from "./react.mjs";
import { H as HalfFloatType, N as NoToneMapping } from "./three.mjs";
import { E as EffectComposer, R as RenderPass, N as NormalPass, D as DepthDownsamplingPass, a as Effect, b as EffectPass, P as Pass, B as BloomEffect, C as ChromaticAberrationEffect, V as VignetteEffect } from "./postprocessing.mjs";
import "./maath.mjs";
import { a as useThree, u as useFrame, e as extend } from "./react-three__fiber.mjs";
const D = /* @__PURE__ */ reactExports.createContext(null), ie = (e) => (e.getAttributes() & 2) === 2, dt = /* @__PURE__ */ reactExports.memo(/* @__PURE__ */ reactExports.forwardRef(({ children: e, camera: t, scene: o, resolutionScale: r, enabled: a = true, renderPriority: n = 1, autoClear: i = true, depthBuffer: s, enableNormalPass: l, stencilBuffer: p, multisampling: _ = 8, frameBufferType: S = HalfFloatType }, g) => {
  const { gl: d, scene: m, camera: v, size: x } = useThree(), f = o || m, u = t || v, [c, U, b] = reactExports.useMemo(() => {
    const C = new EffectComposer(d, { depthBuffer: s, stencilBuffer: p, multisampling: _, frameBufferType: S });
    C.addPass(new RenderPass(f, u));
    let R = null, E = null;
    return l && (E = new NormalPass(f, u), E.enabled = false, C.addPass(E), r !== void 0 && (R = new DepthDownsamplingPass({ normalBuffer: E.texture, resolutionScale: r }), R.enabled = false, C.addPass(R))), [C, E, R];
  }, [u, d, s, p, _, S, f, l, r]);
  reactExports.useEffect(() => c?.setSize(x.width, x.height), [c, x]), useFrame((C, R) => {
    if (a) {
      const E = d.autoClear;
      d.autoClear = i, p && !i && d.clearStencil(), c.render(R), d.autoClear = E;
    }
  }, a ? n : 0);
  const F = reactExports.useRef(null);
  reactExports.useLayoutEffect(() => {
    const C = [], R = F.current.__r3f;
    if (R && c) {
      const E = R.children;
      for (let T = 0; T < E.length; T++) {
        const N = E[T].object;
        if (N instanceof Effect) {
          const q = [N];
          if (!ie(N)) {
            let G = null;
            for (; (G = E[T + 1]?.object) instanceof Effect && !ie(G); ) q.push(G), T++;
          }
          const $ = new EffectPass(u, ...q);
          C.push($);
        } else N instanceof Pass && C.push(N);
      }
      for (const T of C) c?.addPass(T);
      U && (U.enabled = true), b && (b.enabled = true);
    }
    return () => {
      for (const E of C) c?.removePass(E);
      U && (U.enabled = false), b && (b.enabled = false);
    };
  }, [c, e, u, U, b]), reactExports.useEffect(() => {
    const C = d.toneMapping;
    return d.toneMapping = NoToneMapping, () => {
      d.toneMapping = C;
    };
  }, [d]);
  const X = reactExports.useMemo(() => ({ composer: c, normalPass: U, downSamplingPass: b, resolutionScale: r, camera: u, scene: f }), [c, U, b, r, u, f]);
  return reactExports.useImperativeHandle(g, () => c, [c]), /* @__PURE__ */ jsxRuntimeExports.jsx(D.Provider, { value: X, children: /* @__PURE__ */ jsxRuntimeExports.jsx("group", { ref: F, children: e }) });
}));
let vt = 0;
const le = /* @__PURE__ */ new WeakMap(), P = (e, t) => function({ blendFunction: o = t?.blendFunction, opacity: r = t?.opacity, ...a }) {
  let n = le.get(e);
  if (!n) {
    const l = `@react-three/postprocessing/${e.name}-${vt++}`;
    extend({ [l]: e }), le.set(e, n = l);
  }
  const i = useThree((l) => l.camera), s = ee.useMemo(() => [...t?.args ?? [], ...a.args ?? [{ ...t, ...a }]], [JSON.stringify(a)]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(n, { camera: i, "blendMode-blendFunction": o, "blendMode-opacity-value": r, ...a, args: s });
};
const wt = /* @__PURE__ */ P(BloomEffect, { blendFunction: 0 }), yt = /* @__PURE__ */ P(ChromaticAberrationEffect);
const qt = /* @__PURE__ */ P(VignetteEffect);
export {
  dt as d,
  qt as q,
  wt as w,
  yt as y
};
