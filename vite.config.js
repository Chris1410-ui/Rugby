import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Cause racine « page blanche » sur certains appareils : la cible par défaut
    // de Vite (es2020 / Safari 14) laisse `?.`, `globalThis`, Promise.allSettled…
    // dans le bundle. Sur un navigateur plus ancien (vieil iPhone, WebView
    // Android, Chrome < 80), le script ne PARSE même pas → aucun JS ne tourne →
    // page bleue vide (seul le CSS charge). plugin-legacy émet un bundle
    // transpilé + polyfills (chargé via <script nomodule>) pour ces appareils ;
    // les navigateurs modernes gardent le bundle moderne, inchangé.
    legacy({
      targets: ['defaults', 'iOS >= 11', 'Safari >= 11', 'Chrome >= 60', 'not dead'],
    }),
  ],
  server: { port: 5173 },
})
