import { defineConfig } from 'vitest/config'

// Vitest runs the pure modules under hooks/lib through tests/unit/*.spec.ts.
// Files named *.test.ts are the mod-level tests that `claude plugin test .`
// runs with the claude-code/testing kit; Vitest never touches them.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    coverage: { include: ['hooks/lib/**/*.ts'] },
  },
})
