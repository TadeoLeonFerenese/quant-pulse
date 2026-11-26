# Design: Scaffolding Base

## Technical Approach

Bootstrap a minimal Vite 8 + React 19 + TypeScript 6.0.x project manually (no meta-framework, no Ionic) wired with Tailwind CSS v4, Vitest 5, ESLint 10 flat config (`strictTypeChecked`), Prettier, Zustand, Lucide, and Capacitor config. Every validation gate runs locally with Node only (`tsc --noEmit`, `vitest run`, `eslint --max-warnings 0`), deferring Android native project generation and cloud APK builds to `android-ci-build`.

## Architecture Decisions

| Topic | Options Considered | Tradeoff | Decision |
|---|---|---|---|
| Base scaffold | Vite react-ts vs Ionic React vs Next static | Ionic conflicts with Tailwind/Atomic DS; Next SSR is dead weight in client-only APK | **Vite 8.4 + React 19.3** |
| TypeScript version | TS 7.0.2 (Go native) vs TS ~6.0.3 | `typescript-eslint@8.74` peer range is `>=4.8.4 <6.1.0`; TS 7 lacks programmatic API for type-aware lint | **Pin `typescript@~6.0.3`** |
| Extra TS flags | `strict` only vs `+noUncheckedIndexedAccess +exactOptionalPropertyTypes` | Slight extra narrowing in exchange for catching `undefined` → `NaN` bugs in math arrays | **Enable both flags** |
| Linter & formatter | ESLint 10 + typescript-eslint + Prettier vs Biome | Biome is faster but lacks type-aware rules (`no-floating-promises`, `no-unsafe-*`) | **ESLint 10 (`strictTypeChecked`) + `eslint-config-prettier` + Prettier** |
| Styling | Tailwind v4 `@tailwindcss/vite` vs Tailwind v3 PostCSS | v4 eliminates `tailwind.config.js` via CSS `@theme` and integrates natively with Vite | **Tailwind 4.3 + `@tailwindcss/vite`** |
| Test config | Unified `vite.config.ts` vs separate `vitest.config.ts` | Separate `vitest.config.ts` (merging Vite config) keeps test types clean from `tsconfig.node.json` | **`vitest.config.ts` via `mergeConfig`** |
| Android platform | `cap add android` now vs defer to `android-ci-build` | Dev PC lacks disk/CPU for local Android builds; APK will build in GitHub Actions | **Config only (`@capacitor/core` + `@capacitor/cli` + `capacitor.config.ts`)** |

## Layer & Dependency Flow

Dependencies point strictly inward. `src/domain/` has ZERO imports from React, Zustand, Capacitor, or browser APIs.

```
  src/ui/ (atoms, molecules, organisms, containers)
     │
     ▼
  src/application/ (Zustand stores, use cases)
     │
     ▼
  src/domain/math/ (pure TS: Z-Score, VaR, spreads — 100% coverage)
     ▲
     │
  src/infrastructure/ (HTTP clients, local cache — future changes)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `package-lock.json` | Create | Pinned deps + scripts (`dev`, `test`, `test:coverage`, `typecheck`, `lint`, `format:check`) |
| `index.html` | Create | Mobile viewport meta (`viewport-fit=cover`), root mount |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Create | Project references; strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| `vite.config.ts` | Create | `@vitejs/plugin-react`, `@tailwindcss/vite`, `@/` path alias |
| `vitest.config.ts` | Create | `mergeConfig(viteConfig, ...)`, `jsdom`, setup file, v8 coverage with 100% glob on `src/domain/math/**` |
| `eslint.config.js`, `.prettierrc` | Create | Flat config: `strictTypeChecked`, `react-hooks`, `eslint-config-prettier`, `--max-warnings 0` |
| `capacitor.config.ts` | Create | `appId: 'com.quantpulse.app'`, `appName: 'Quant-Pulse'`, `webDir: 'dist'` |
| `src/index.css` | Create | `@import "tailwindcss";` + `@theme` semantic tokens (success, danger, stale, 4px/8px spacing) |
| `src/main.tsx`, `src/App.tsx` | Create | Minimal mobile-first `100dvh` shell (no Y-scroll overflow) |
| `src/test/setup.ts`, `src/App.test.tsx` | Create | `@testing-library/jest-dom/vitest` + smoke render test |
| `src/domain/math/.gitkeep`, `src/application/.gitkeep`, `src/infrastructure/.gitkeep`, `src/ui/{atoms,molecules,organisms,containers}/.gitkeep` | Create | Layered directory skeleton |
| `openspec/config.yaml` | Modify | Update `testing:` section with detected Vitest/ESLint/tsc commands |

## Key Configurations (Non-Obvious)

**`vitest.config.ts` — Per-path 100% math coverage gate:**
```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/main.tsx', 'src/test/**', '**/*.test.{ts,tsx}'],
  thresholds: {
    'src/domain/math/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
  },
}
```

**`src/index.css` — Tailwind v4 `@theme` semantic tokens:**
```css
@import "tailwindcss";

@theme {
  --color-status-success: #059669; /* emerald-600 */
  --color-status-danger: #e11d48;  /* rose-600 */
  --color-status-stale: #eab308;   /* yellow-500 */
}
```

**`eslint.config.js` — Type-aware checking without slow manual project lists:**
Use `parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }` with `tseslint.configs.strictTypeChecked`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Smoke / Integration | `App` renders title & status shell without errors | Vitest + `@testing-library/react` + `jsdom` |
| Static Gates | Strict TS contracts & lint rules | `npx tsc --noEmit` + `npm run lint` (`--max-warnings 0`) |
| Coverage Gate | Math threshold config validates cleanly | `npm run test:coverage` (enforced once `src/domain/math/*.ts` files land) |

## Migration / Rollout

No migration required. Immediately after `sdd-verify` passes, re-run `/sdd-init` so Engram and `openspec/config.yaml` flip `strict_tdd: true` for all subsequent domain changes.

## Open Questions

None.
