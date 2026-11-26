# Tasks: Scaffolding Base

## Phase 1: Package & Tooling Config (Infrastructure)

- [x] 1.1 Create `package.json` with pinned deps (React 19.3, Vite 8.4, TS `~6.0.3`, Tailwind 4.3, Vitest 5.1, RTL, jsdom, ESLint 10, `typescript-eslint` 8.74, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `globals`, Prettier, Zustand 5.1, `lucide-react`, `@capacitor/core`, `@capacitor/cli`) and scripts (`dev` as `vite --host`, `test`, `test:coverage`, `typecheck`, `lint` with `--max-warnings 0`, `format:check`). Install via `npm install`.
- [x] 1.2 Create `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `@/*` → `./src/*` path alias.
- [x] 1.3 Create `vite.config.ts` (`@vitejs/plugin-react`, `@tailwindcss/vite`, `@` alias) and `vitest.config.ts` (`mergeConfig`, `jsdom`, `src/test/setup.ts`, v8 coverage with 100% lines/branches/functions/statements threshold on `src/domain/math/**`).
- [x] 1.4 Create `eslint.config.js` (flat config: `strictTypeChecked` with `projectService`, `react-hooks`, `eslint-config-prettier`) and `.prettierrc`.
- [x] 1.5 Create `capacitor.config.ts` (`appId: 'com.quantpulse.app'`, `appName: 'Quant-Pulse'`, `webDir: 'dist'`). Verify no `android/` directory is generated.

## Phase 2: Layered Skeleton & App Shell (Implementation)

- [x] 2.1 Create layered directory skeleton with `.gitkeep` files: `src/domain/math/`, `src/application/`, `src/infrastructure/`, `src/ui/atoms/`, `src/ui/molecules/`, `src/ui/organisms/`, `src/ui/containers/`.
- [x] 2.2 Create `index.html` (mobile viewport with `viewport-fit=cover`) and `src/index.css` (`@import "tailwindcss";` + `@theme` semantic tokens `--color-status-success`, `--color-status-danger`, `--color-status-stale`).
- [x] 2.3 Create `src/main.tsx` and mobile-first `src/App.tsx` (`h-dvh overflow-hidden`, `w-full max-w-md`, 4px/8px spacing, no fixed lateral padding with `w-screen`).

## Phase 3: Testing & Quality Gates

- [x] 3.1 Create `src/test/setup.ts` (`@testing-library/jest-dom/vitest`) and `src/App.test.tsx` covering spec scenario "Root shell renders without errors on mobile viewport".
- [x] 3.2 Run all local gates (NEVER `npm run build`): `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run lint`, `npm run format:check`. Verify exit code `0` on all.
- [x] 3.3 Update `openspec/config.yaml` (`testing:` section with detected commands) and confirm `scripts.dev` uses `vite --host`.
