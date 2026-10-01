import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // Expose the dev server on the LAN so a real phone on the same Wi-Fi can open http://<laptop-ip>:5173
  server: { host: true },
});
