import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

function mediapipeWasm() {
  const sync = () => {
    const src = path.resolve('node_modules/@mediapipe/tasks-vision/wasm');
    const dst = path.resolve('public/mediapipe/wasm');
    mkdirSync(dst, { recursive: true });
    for (const file of WASM_FILES) copyFileSync(path.join(src, file), path.join(dst, file));
  };
  return {
    name: 'mediapipe-wasm',
    buildStart: sync,
    configureServer: sync,
  };
}

export default defineConfig({
  plugins: [mediapipeWasm(), react(), tailwindcss(), cloudflare()],
  // Expose the dev server on the LAN so a real phone on the same Wi-Fi can open http://<laptop-ip>:5173
  server: { host: true },
});
