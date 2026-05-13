// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  // Remove the nitro plugin - TanStack Start handles this via tanstackStart config
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      allowedHosts: ["monogenistic-nonfloriferous-keiko.ngrok-free.dev"],
    },
  },
});