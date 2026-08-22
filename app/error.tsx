'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="max-w-sm rounded-2xl border border-line bg-white/[0.025] p-6 text-center backdrop-blur-md">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
          <AlertTriangle size={20} className="text-red-300" />
        </div>
        <h1 className="text-sm font-medium text-ivory">Algo deu errado</h1>
        <p className="mt-1.5 text-xs text-muted">
          Não conseguimos carregar esta página. Tente novamente em instantes.
        </p>
        <button
          onClick={reset}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          <RotateCcw size={13} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
