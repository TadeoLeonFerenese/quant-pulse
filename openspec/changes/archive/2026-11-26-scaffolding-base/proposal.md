# Proposal: Scaffolding Base

## Intent
Greenfield repo with no tooling. We need a verifiable foundation (typecheck + tests + lint) so every later change can run under Strict TDD. The dev machine has no disk or CPU headroom for an Android emulator or Gradle builds, so the base must be fully usable **without a local Android toolchain**.

## Scope

### In Scope
- Vite 8 + React 19 + TypeScript **6.0.x** (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- Tailwind 4 via `@tailwindcss/vite` with `@theme` tokens (4px/8px scale, success/danger/stale colors)
- Vitest 5 + jsdom + Testing Library + v8 coverage (100% threshold on `src/domain/math/**`)
- ESLint 10 flat config + typescript-eslint `strictTypeChecked` + react-hooks, `--max-warnings 0`; Prettier
- Zustand, lucide-react, `@capacitor/core` + `@capacitor/cli` + `capacitor.config.ts`
- Layered skeleton: `src/domain/math`, `src/application`, `src/infrastructure`, `src/ui/{atoms,molecules,organisms,containers}`
- Scripts: `dev` (`vite --host`, so a real phone on the same Wi-Fi can open it), `test`, `test:coverage`, `typecheck`, `lint`
- One smoke test proving the runner works

### Out of Scope
- `npx cap add android` and APK generation → next change `android-ci-build` (GitHub Actions builds the APK in the cloud and uploads it as an artifact)
- Local emulator, JDK 21, `ANDROID_HOME` (not needed at all)
- Charts, SQLite/IndexedDB cache, data clients, real math functions

## Capabilities

### New Capabilities
- `dev-tooling`: typecheck, test, coverage and lint commands with their quality gates

### Modified Capabilities
None

## Approach
`npm create vite` (react-ts) then add each tool deliberately. Pin exact versions verified on npm (2026-11-26). TypeScript stays on 6.0.x because typescript-eslint 8.74 declares a peer dependency of `typescript >=4.8.4 <6.1.0`, and TS 7 (Go-native) has no programmatic API yet. Upgrade once typescript-eslint supports it.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `package.json`, lockfile | New | deps + scripts |
| `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc` | New | tooling config |
| `capacitor.config.ts` | New | appId `com.quantpulse.app`, `webDir: dist` |
| `src/**`, `index.html` | New | skeleton + entry |
| `openspec/config.yaml` | Modified | testing section → real commands |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Teams pinning TS 7 later break lint | Med | Pin `typescript@~6.0.3`, document reason |
| Extra-strict TS flags clash with lib types | Low | Relax per-file with rationale in design |
| `npm install` needs network | High | Run install outside sandbox only |

## Rollback Plan
Single commit/PR on `feat/scaffolding-base`; revert the commit (or delete the branch). No data or external state touched.

## Dependencies
- Node ≥22.12 (local: 24.7 ✅)

## Success Criteria
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` green with ≥1 test
- [ ] `npm run lint` exits 0 with 0 warnings
- [ ] App opens in desktop browser (mobile viewport) and on a phone via `--host`
- [ ] `/sdd-init` re-run reports `strict_tdd: true`
