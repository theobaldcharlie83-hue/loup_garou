import { defineConfig } from 'vitest/config'

// Configuration de test isolée (sans le plugin PWA, inutile pour les tests unitaires).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    globals: true,
  },
})
