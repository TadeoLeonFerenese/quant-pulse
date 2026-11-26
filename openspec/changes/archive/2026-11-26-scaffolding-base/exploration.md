## Exploration: scaffolding-base

### Current State
- Greenfield: repo contains only `AGENT.md`, `.gitignore`, `openspec/`. No `package.json`, no `src/`, no tooling.
- Local toolchain (verified 2026-11-26): Node v24.7.0, npm 11.6.2, OpenJDK 17.0.16, Android SDK present at `%LOCALAPPDATA%\Android\Sdk` (but `ANDROID_HOME` not set).
- Mobile packaging decided: **Capacitor** (single React/TS codebase for web + APK; math engine reused as-is).
- Ecosystem (web search, must be confirmed with `npm view <pkg> version` at apply time): Vite 8 (Rolldown), Vitest 5 (needs Node ≥22.12 ✅), Tailwind v4 via `@tailwindcss/vite` (CSS-first `@theme`, no `tailwind.config.js`), Capacitor 8 (JDK 21 recommended, 17 minimum; minSdk 24, targetSdk 36).

### Affected Areas (all NEW)
- `package.json`, `package-lock.json` — deps + scripts (`dev`, `test`, `typecheck`, `lint`; NO build in workflow)
- `tsconfig*.json` — strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (money/math code must not silently read `undefined`)
- `vite.config.ts` / `vitest.config.ts` — React plugin, Tailwind plugin, jsdom env, v8 coverage with per-path thresholds (100% on `src/domain/math/**`)
- `eslint.config.js` — flat config, typescript-eslint strict, react-hooks; 0 warnings policy (`--max-warnings 0`)
- `src/index.css` — Tailwind v4 `@import` + `@theme` tokens (4px/8px spacing, semantic colors success/danger/stale)
- `capacitor.config.ts` — appId/appName/webDir
- Folder skeleton (screaming/hexagonal):
  ```
  src/
  ├── domain/        # pure TS, zero React/IO imports
  │   └── math/
  ├── application/   # use cases, Zustand stores
  ├── infrastructure/# HTTP clients, cache adapters (later changes)
  └── ui/
      ├── atoms/ molecules/ organisms/
      └── containers/
  ```
- `src/test/setup.ts` — jest-dom matchers

### Approaches
1. **Vite `react-ts` template + manual layering** — `npm create vite` then add Tailwind, Vitest, ESLint, Zustand, Lucide, Capacitor.
   - Pros: minimal, every dependency is intentional; Capacitor's officially documented path for React; fastest HMR/test loop.
   - Cons: we wire configs ourselves (more upfront tasks).
   - Effort: Low-Medium
2. **Ionic React starter (`ionic start --type=react`)** — Ionic UI kit + Capacitor preconfigured.
   - Pros: Capacitor + native-feel components out of the box.
   - Cons: Ionic components fight our own Atomic Design + Tailwind tokens (two design systems); extra weight; React 19 support lags.
   - Effort: Low upfront, High later (removal/override)
3. **Next.js static export + Capacitor**
   - Pros: routing conventions.
   - Cons: SSR/server features are dead weight in a client-only APK; `output: export` limitations; slower test setup.
   - Effort: Medium

Sub-decisions:
| Topic | Option A | Option B | Lean |
|---|---|---|---|
| Lint/format | ESLint flat + typescript-eslint + Prettier | Biome (single tool, faster) | ESLint — react-hooks rules + typed lint (`strictTypeChecked`) matter for this domain; Biome lacks type-aware rules |
| Android platform | `npx cap add android` now | Defer to `android-shell` change | Defer — JDK 17 < recommended 21 and `ANDROID_HOME` unset; keeps this change verifiable with tsc+vitest only |
| Smoke test | Trivial `sum` test | First real pure fn (e.g. `logReturn`) | Trivial guard test only; real math goes in its own TDD change |

### Recommendation
Approach 1 (Vite react-ts + manual layering), ESLint flat config, Capacitor core/cli + `capacitor.config.ts` only (Android platform deferred). Install Zustand and Lucide now so later changes don't invent deps. Defer charts (Lightweight Charts/Recharts), SQLite/IndexedDB, and data clients to their own changes.

Done = `npx tsc --noEmit` clean, `npx vitest run` green (≥1 test), `npm run lint` 0 warnings. Then re-run `/sdd-init` → `strict_tdd: true`.

### Risks
- Version claims (Vite 8 / Vitest 5 / Capacitor 8) come from web search — confirm with `npm view` before pinning.
- npm install needs network → must run outside sandbox.
- JDK 17 may be rejected by Capacitor 8 Gradle toolchain → address in `android-shell` (install JDK 21 or use Android Studio JBR).
- `exactOptionalPropertyTypes` can create friction with some libs' types — acceptable, can relax with rationale in design.

### Ready for Proposal
Yes — confirm with the user: (1) ESLint vs Biome, (2) defer `cap add android`, (3) extra-strict TS flags.
