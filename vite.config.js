/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { readFileSync } from 'node:fs'

// Infos de build injectées dans le bundle (indicateur de version dans l'app,
// pour diagnostiquer un cache/déploiement périmé d'un coup d'œil). Le SHA vient
// de Vercel (VERCEL_GIT_COMMIT_SHA) au build ; « dev » en local.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const buildSha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev'
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
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
