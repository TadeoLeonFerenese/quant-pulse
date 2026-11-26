import { Activity } from 'lucide-react';

export function App() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <main className="mx-auto flex h-full w-full max-w-md flex-col justify-between p-4 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            <h1 className="text-lg font-semibold tracking-tight">Quant-Pulse</h1>
          </div>
          <span
            role="status"
            className="inline-flex items-center rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300"
          >
            Sistema listo
          </span>
        </header>

        <section className="h-fit rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-300">
            Base cuantitativa inicializada. Sin custodia ni ejecución de órdenes.
          </p>
        </section>

        <footer className="text-center text-xs text-slate-500">v0.1.0 · Fail-Closed</footer>
      </main>
    </div>
  );
}
