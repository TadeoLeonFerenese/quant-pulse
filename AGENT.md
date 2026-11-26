# AGENTS.md — Contexto del Proyecto: QUANT-PULSE

Plataforma Móvil (APK / Android) y Web de Inteligencia Cuantitativa, Arbitraje Macro (Dólar / Tasas) y Detección Probabilística de Riesgo en Criptoactivos.

---

## 1. Declaración de Misión & Seguridad Innegociable (Security First)

QUANT-PULSE es un sistema analítico de consulta y toma de decisiones; **NO es una wallet, NO custodia llaves privadas ni ejecuta órdenes directas con fondos del usuario**.

- **Integridad de Datos (Fail-Closed):** Si una fuente de datos (Binance, DolarApi, Ámbito) devuelve valores anómalos (outliers > 4 sigmas en <1s) o pierde conexión, el sistema bloquea inmediatamente las recomendaciones de arbitraje y muestra una bandera de advertencia. Prohibido operar o alertar sobre datos corruptos.
- **Cero Hardcoded Secrets:** Ninguna API key (de LLM, proveedores o proxies) vive en el cliente. Todo secreto local se almacena en el Android Keystore / EncryptedSharedPreferences o se resuelve mediante variables de entorno en el pipeline.
- **Protección contra MitM:** Todas las llamadas a APIs externas se realizan sobre HTTPS estricto con validación de certificados TLS y sanitización de payloads de entrada.

---

## 2. Stack Tecnológico de la APK

- **Frontend / Móvil:** React 19 + TypeScript (Modo Estricto) empaquetado para Android vía Capacitor (o Jetpack Compose nativo si es módulo puro).
- **Estilos & UI:** Tailwind CSS con tokens de diseño Mobile-First y simetría geométrica en escala 4px/8px.
- **Iconografía:** Lucide React (estricta regla de no duplicar iconos ni mezclar emojis junto al mismo icono).
- **Gestión de Estado:** Zustand (desacoplado de la UI, con stores atómicos y selectores puros).
- **Motor Cuantitativo Local:** Módulos TypeScript puros en `/src/domain/math/` para cálculos en tiempo real (Z-Score, retornos logarítmicos, spreads, VaR).
- **Visualización Gráfica:** Lightweight Charts / Recharts optimizado (lazy loading, cero iframes pesados, prevención estricta de GPU Thrashing sobre backdrop-blur).
- **Testing:** Vitest + React Testing Library (Strict TDD con 100% de cobertura en funciones matemáticas críticas).

---

## 3. Funciones Núcleo (CRÍTICAS — Cero Tolerancia a Fallos)

Estas 3 funciones son el corazón del sistema y deben contar con suites de tests matemáticos unitarios exhaustivos:

### 🚨 Núcleo 1: Motor de Arbitraje Macro y Brechas en Tiempo Real

- **Cálculo de Dólar Implícito:** Mapeo de cotizaciones en tiempo real: Dólar MEP (bonos AL30/GD30), CCL, Blue y Dólar Cripto (USDT P2P en exchanges).
- **Cálculo de Carry Trade Neto:** Tasa Nominal Anual (TNA/TEA de Lecaps / Plazos Fijos) vs variación proyectada de brecha cambiaria, descontando comisiones del broker (0.5% - 1.5%) y slippage.
- **Z-Score de Desvío Estadístico:** Cálculo sobre ventana móvil de 30/90 días de la brecha MEP vs Blue / Crypto.
  - Alerta de Convergencia: Cuando el Z-Score > 2.0 (anomalía estadística histórica), el sistema emite un semáforo de oportunidad con probabilidad de reversión a la media.

### 🚨 Núcleo 2: Motor Probabilístico Cripto y Detección de Régimen

- **Detección de Régimen de Mercado:** Clasificación del activo (BTC, ETH, SOL) en 3 estados:
  1. _Régimen de Rango / Baja Volatilidad_ (Estrategias de acumulación / compra en soporte).
  2. _Régimen Tendencial Fuerte_ (Breakouts y seguimiento de tendencia).
  3. _Régimen de Pánico / Liquidación Masiva_ (Alertas de salida o stop-loss probabilístico).
- **Funding Rates & Presión Subyacente:** Monitoreo del funding rate de contratos perpetuos. Si el funding es extremadamente positivo/negativo junto a picos de interés abierto, alerta riesgo de liquidación en cascada.
- **Bandas de Salida y Entrada Asimétrica (VaR):** Cálculo de Valor en Riesgo paramétrico e histórico (95% y 99% de confianza) para determinar si la relación beneficio/riesgo de entrada es matemáticamente viable (> 2.5:1).

### 🚨 Núcleo 3: Módulo de Integridad y Fallback de Datos

- Timeout estricto de 3 segundos en llamadas de red.
- Mecanismo de caché local (stale-while-revalidate con SQLite/IndexedDB local) con timestamp visible al segundo. Si la data tiene más de 10 minutos, se marca en amarillo (Stale). Si falla la red, el sistema no crashea: mantiene la última foto confiable e informa desconexión.

---

## 4. Funciones Secundarias (Experiencia de Usuario y Soporte)

- **Dashboard de Semáforos de Riesgo:** Vista principal de 1 sola pantalla (above-the-fold) donde el inversor ve en 3 segundos el estado macro: _¿Conviene tasa o dólar? ¿Crypto está en zona de compra o sobrecalentada?_
- **Simulador de Rulo / Carry Trade:** Input interactivo donde el usuario ingresa su capital (ARS o USD) y el sistema calcula la ruta de mayor eficiencia neta descontando impuestos y comisiones.
- **Asistente Cuantitativo Conversacional:** Módulo declarativo que consume los snapshots matemáticos ya calculados por el motor local y genera un reporte en lenguaje claro y accesible.

---

## 5. Reglas Inviolables de Implementación (Lecciones de Sentinel, Vortex y Portfolio)

1. **Mobile-First Estricto & Cero Clipping:**
   - Prohibido combinar paddings laterales fijos (`pl-10`, `px-8`) con anchos de pantalla completa (`w-screen`, `100vw`) en drawers, modales o sheets. Obligatorio `w-full max-w-md` y padding responsivo (`pl-0 sm:pl-10`).
2. **Simetría Matemática:**
   - Escala modular de 4px/8px. Botones, inputs y selectores comparten altura idéntica (`h-9` o `h-10`, `px-3`) con chevrons perfectamente centrados.
3. **Affordance & Cero Duplicación:**
   - Badges de datos y semáforos no deben parecer botones interactivos si no lo son.
   - Prohibido duplicar iconos (nunca colocar emojis junto al mismo icono Lucide).
4. **Modales Accesibles:**
   - Todo menú o modal desplegable debe cerrarse limpiamente con click-outside (`mousedown`) y pulsación de tecla `Escape`.
5. **Cero GPU Thrashing:**
   - Gráficos renderizados con lazy-loading y renderizado condicional si no están en el viewport. Cero filtros `backdrop-blur-xl` intensos sobre áreas con scroll o canvas interactivos.
6. **Compilación y Tests:**
   - Prohibido ejecutar `npm run build` tras cambios. Validar exclusivamente con `npx tsc --noEmit` y `npx vitest run`.
   - Conventional commits únicamente. Cero atribuciones de IA ("Co-Authored-By").
