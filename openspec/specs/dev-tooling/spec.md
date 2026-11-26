# dev-tooling Specification

## Purpose

Define the mandatory developer tooling, quality gates, and structural baseline for `quant-pulse` so all subsequent features run under Strict TDD without requiring a local Android SDK or emulator.

## Requirements

### Requirement: Strict Static Type Checking

The project SHALL enforce TypeScript strict mode plus unchecked indexed access (`noUncheckedIndexedAccess`) and exact optional properties (`exactOptionalPropertyTypes`). Validation MUST run via `npx tsc --noEmit` without emitting build artifacts.

#### Scenario: Clean codebase passes typecheck
- GIVEN all TypeScript files conform to strict type contracts
- WHEN a developer runs `npm run typecheck` (`npx tsc --noEmit`)
- THEN the command exits with code `0` and produces no errors

#### Scenario: Unchecked array indexing fails typecheck
- GIVEN a module reads `const v: number = prices[0]` without guarding against `undefined`
- WHEN `npm run typecheck` runs
- THEN the command exits with a non-zero code reporting the unsafe access

### Requirement: Automated Unit and DOM Test Runner with Math Coverage Gate

The project MUST provide a fast test runner (`npx vitest run`) supporting pure TypeScript unit tests and React DOM integration tests. Coverage enforcement MUST require 100% lines, branches, functions, and statements under `src/domain/math/**`.

#### Scenario: Passing test suite
- GIVEN at least one passing smoke test exists
- WHEN a developer runs `npx vitest run`
- THEN all tests pass and the command exits with code `0`

#### Scenario: Uncovered branch in math domain fails coverage gate
- GIVEN a file in `src/domain/math/` has an untested branch
- WHEN a developer runs `npm run test:coverage`
- THEN the command exits with a non-zero code due to threshold failure

### Requirement: Zero-Warning Type-Aware Linting

The project MUST run type-aware ESLint (`strictTypeChecked`) and React Hooks rules with `--max-warnings 0`. Any warning or error SHALL fail the check.

#### Scenario: Clean code passes lint
- GIVEN source files satisfy all lint and formatting rules
- WHEN a developer runs `npm run lint`
- THEN the command exits with code `0` with zero errors and zero warnings

#### Scenario: Floating promise or explicit `any` fails lint
- GIVEN a source file contains an unhandled promise or an explicit `any` type
- WHEN `npm run lint` runs
- THEN the command exits with a non-zero code identifying the rule violation

### Requirement: Layered Architecture, Mobile-First Baseline, and Capacitor Config

The repository MUST establish separated directories (`src/domain/math`, `src/application`, `src/infrastructure`, `src/ui/{atoms,molecules,organisms,containers}`), CSS design tokens on a 4px/8px scale with semantic status colors, and a valid Capacitor config (`com.quantpulse.app`). Domain math MUST NOT depend on React or I/O. Local validation MUST NOT require `ANDROID_HOME`, JDK 21, or `npm run build`.

#### Scenario: Root shell renders without errors on mobile viewport
- GIVEN the app renders in a test DOM environment
- WHEN `App` mounts
- THEN it renders the Quant-Pulse shell without console errors or horizontal overflow classes (`w-screen` + fixed lateral padding)

#### Scenario: Capacitor configuration exists without Android platform artifacts
- GIVEN `capacitor.config.ts` is present in the project root
- WHEN inspecting the workspace
- THEN `appId` is `com.quantpulse.app`, `webDir` is `dist`, and no `android/` directory is created yet

### Requirement: LAN-Accessible Dev Server

The dev script (`npm run dev`) MUST bind to network interfaces (`vite --host`) so a physical Android phone on the same Wi-Fi can open the app directly in Chrome.

#### Scenario: Dev script configuration
- GIVEN `package.json` defines project scripts
- WHEN inspecting `scripts.dev`
- THEN it invokes Vite with `--host`
