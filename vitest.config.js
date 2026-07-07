import { defineConfig } from "vitest/config";

// Tests unitaires du cœur métier (lib/*) et des utilitaires de données.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    // Le client Supabase est instancié à l'import : on fournit des valeurs
    // factices pour que createClient ne lève pas (aucun appel réseau en test).
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
