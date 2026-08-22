'use client';

import { useState } from 'react';
import { Eye, KeyRound, ArrowRight } from 'lucide-react';
import { redefinirSenha } from '../login/actions';

export function ResetSenhaForm({ erro }: { erro?: string }) {
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sapphire-soft">
            <Eye size={20} className="text-sapphire" />
          </div>
          <h1 className="text-lg font-semibold text-ivory">Bonus Vision</h1>
          <p className="mt-1 text-xs text-muted">Defina sua nova senha</p>
        </div>

        <div className="rounded-2xl border border-line bg-white/[0.025] p-6 backdrop-blur-md">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound size={15} className="text-sapphire" />
            <h2 className="text-sm font-medium text-ivory">Nova senha</h2>
          </div>

          {erro && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erro}
            </div>
          )}

          <form action={redefinirSenha} onSubmit={() => setEnviando(true)} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs text-muted">Nova senha</label>
              <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                <input
                  name="senha"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
            >
              {enviando ? 'Aguarde…' : 'Salvar nova senha'}
              {!enviando && <ArrowRight size={14} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
