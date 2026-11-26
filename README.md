# Quant-Pulse

Plataforma móvil (Android vía Capacitor) y web de inteligencia cuantitativa, arbitraje macro (Dólar / Tasas) y detección probabilística de riesgo en criptoactivos.

> **Seguridad ante todo:** Quant-Pulse es un sistema **100% analítico y client-only**. **NO es una wallet**, no custodia llaves privadas ni ejecuta órdenes con fondos del usuario. Opera bajo política **fail-closed**: ante anomalías estadísticas (`>4σ` en `<1s`), datos vencidos (`>10 min`) o desconexión, bloquea automáticamente las recomendaciones.

---

## Estado actual (`main`)

| Módulo                               | Estado     | Cobertura / Tests                                                                                                                                                         | Spec                                     |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Scaffolding & Tooling                | ✅ Listo   | Vite 8 · React 19 · TS 6 estricto · Tailwind 4 · Vitest 5 · ESLint 10                                                                                                     | `openspec/specs/dev-tooling/spec.md`     |
| **Núcleo 3 — Integridad y Fallback** | ✅ Listo   | `outlierGuard` **100%**, `safeFetch` HTTPS + timeout 3s + Zod, caché IndexedDB SWR, `IntegrityBadge`                                                                      | `openspec/specs/data-integrity/spec.md`  |
| **Núcleo 1 — Arbitraje Macro**       | ✅ Listo   | `macroArbitrage` **100%** (MEP/CCL/Blue/Cripto, carry trade TNA/TEA neto, Z-Score 30/90d `\|Z\| > 2.0`), adaptador DolarApi                                               | `openspec/specs/macro-arbitrage/spec.md` |
| **Núcleo 2 — Riesgo Cripto**         | ✅ Listo   | `cryptoRisk` **100%** (3 regímenes, funding/OI squeeze, VaR 95/99 paramétrico + histórico, `R:R > 2.5:1`), Binance público sin API keys, watchlist extensible con **ADA** | `openspec/specs/crypto-regime/spec.md`   |
| Dashboard Mobile-First (`100dvh`)    | 🔲 Próximo | `/sdd-new dashboard-ui`                                                                                                                                                   | —                                        |
| Build APK en GitHub Actions          | 🔲 Próximo | `/sdd-new android-ci-build`                                                                                                                                               | —                                        |

---

## Requisitos en tu PC

- **Node.js `>= 22.12`** (recomendado Node 24 LTS) y **npm**.
- **No necesitás Android Studio, JDK ni emulador** para desarrollar ni correr los tests.

---

## Instalación y uso en casa

```bash
git clone https://github.com/TadeoLeonFerenese/quant-pulse.git
cd quant-pulse
npm install
```

### 1. Levantar la app en desarrollo (PC + Celular por Wi-Fi)

```bash
npm run dev
```

Vite arranca con `--host` y te muestra dos URLs en la terminal:

- **En la PC:** abrí `http://localhost:5173` (usá DevTools `F12` → vista móvil).
- **En tu celular Android (mismo Wi-Fi):** abrí la URL `Network` (`http://<IP-de-tu-PC>:5173`) en Chrome del teléfono.

_(Nota: todavía está el shell base en pantalla; los 3 motores cuantitativos ya están testeados y listos para conectarse en el próximo cambio `dashboard-ui`.)_

### 2. Correr todas las validaciones y tests

```bash
npm run test            # Suite completa (80 tests)
npm run test:watch      # Modo interactivo mientras programás
npm run test:coverage   # Reporte de cobertura (exige 100% en src/domain/math/**)
npm run typecheck       # TypeScript estricto (tsc --noEmit)
npm run lint            # ESLint strictTypeChecked (--max-warnings 0)
npm run format:check    # Verifica formato Prettier
```

> **Regla del proyecto:** no ejecutar `npm run build` como validación local; validar siempre con `typecheck`, `test`, `test:coverage` y `lint`.

---

## Arquitectura del proyecto

Las dependencias apuntan estrictamente hacia adentro (`src/domain/` no importa React, Zustand, Zod ni IO):

```text
src/
├── domain/
│   ├── math/            # Matemática pura (100% cobertura obligatoria)
│   │   ├── outlierGuard.ts      # Guardia >4σ en <1s
│   │   ├── macroArbitrage.ts    # Dólar implícito, carry trade neto, Z-Score 30/90d (Welford + erf)
│   │   └── cryptoRisk.ts        # Regímenes, funding/OI squeeze, VaR 95/99 y R:R > 2.5:1
│   ├── integrity/       # Contratos fail-closed, frescura >10m y puertos
│   ├── macro/           # Tipos FX (MEP, CCL, BLUE, CRIPTO)
│   └── crypto/          # Watchlist por defecto (BTC, ETH, SOL, ADA, BNB, XRP, LINK)
├── infrastructure/
│   ├── http/            # safeFetch (HTTPS estricto, timeout 3s, Zod)
│   ├── cache/           # IndexedDbSnapshotCache + InMemorySnapshotCache
│   └── feeds/           # dolarApiClient.ts y binanceClient.ts (públicos, sin API keys)
├── application/
│   ├── integrity/       # fetchWithIntegrity (stale-while-revalidate)
│   ├── macro/           # evaluateMacroSignal (fail-closed)
│   ├── crypto/          # evaluateCryptoSignal (fail-closed)
│   └── stores/          # Zustand atómicos (useIntegrityStore, useMacroStore, useCryptoStore)
└── ui/
    └── atoms/           # IntegrityBadge (role="status", HH:mm:ss)
```

---

## Próximos pasos (flujo SDD)

Las especificaciones viven versionadas en `openspec/specs/` y el historial completo de cambios en `openspec/changes/archive/`. Para continuar:

1. `/sdd-new dashboard-ui` — Pantalla principal above-the-fold (`100dvh`), semáforos Macro/Cripto (con **ADA**) y simulador de Carry Trade.
2. `/sdd-new android-ci-build` — Plantilla Android de Capacitor + workflow de GitHub Actions para compilar y descargar la `.apk` directo al celular.
