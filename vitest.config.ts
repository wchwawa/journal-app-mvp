import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // 'server-only' throws outside a React Server environment; stub it so
      // server modules can be unit-tested.
      'server-only': fileURLToPath(
        new URL('./tests/mocks/server-only.ts', import.meta.url)
      )
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
});
