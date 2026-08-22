'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Sparkles, ArrowRight } from 'lucide-react';
import { entrar, criarConta, esqueciSenha } from './actions';

export function LoginForm({ erro, mensagem }: { erro?: string; mensagem?: string }) {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar');
  const [enviando, setEnviando] = useState(false);

  const TITULOS: Record<typeof modo, string> = {
    entrar: 'Entrar na sua conta',
    criar: 'Criar conta da loja',
    esqueci: 'Recuperar senha',
  };

  const ACOES: Record<typeof modo, (formData: FormData) => void> = {
    entrar,
    criar: criarConta,
    esqueci: esqueciSenha,
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sapphire-soft">
            <Eye size={20} className="text-sapphire" />
          </div>
          <h1 className="text-lg font-semibold text-ivory">Bonus Vision</h1>
          <p className="mt-1 text-xs text-muted">CRM de cashback para óticas e clínicas</p>
        </div>

        <div className="rounded-2xl border border-line bg-white/[0.025] p-6 backdrop-blur-md">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles size={15} className="text-sapphire" />
            <h2 className="text-sm font-medium text-ivory">{TITULOS[modo]}</h2>
          </div>

          {erro && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erro}
            </div>
          )}
          {mensagem && (
            <div className="mb-4 rounded-lg border border-emerald/25 bg-emerald/10 px-3 py-2 text-xs text-[#6EE7B7]">
              {mensagem}
            </div>
          )}

          <form action={ACOES[modo]} onSubmit={() => setEnviando(true)} className="space-y-3.5">
            {modo === 'criar' && (
              <div>
                <label className="mb-1.5 block text-xs text-muted">Nome da loja/clínica</label>
                <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                  <input
                    name="nomeLoja"
                    required
                    placeholder="Ótica Visão Clara"
                    className="w-full bg-transparent text-sm text-ivory outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs text-muted">E-mail</label>
              <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="voce@loja.com"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </div>
            </div>

            {modo !== 'esqueci' && (
              <div>
                <label className="mb-1.5 block text-xs text-muted">Senha</label>
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
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
            >
              {enviando
                ? 'Aguarde…'
                : modo === 'entrar'
                  ? 'Entrar'
                  : modo === 'criar'
                    ? 'Criar conta'
                    : 'Enviar link de recuperação'}
              {!enviando && <ArrowRight size={14} />}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            {modo === 'entrar' && (
              <>
                <button
                  onClick={() => setModo('esqueci')}
                  className="text-xs text-muted transition-colors hover:text-ivory"
                >
                  Esqueci minha senha
                </button>
                <button
                  onClick={() => setModo('criar')}
                  className="text-xs text-muted transition-colors hover:text-ivory"
                >
                  Ainda não tem conta? Criar agora
                </button>
              </>
            )}
            {modo !== 'entrar' && (
              <button
                onClick={() => setModo('entrar')}
                className="text-xs text-muted transition-colors hover:text-ivory"
              >
                Voltar para o login
              </button>
            )}
          </div>
        </div>

        <Link
          href="/privacidade"
          className="mt-5 block text-center text-[11px] text-muted transition-colors hover:text-ivory"
        >
          Política de Privacidade
        </Link>
      </div>
    </div>
  );
}
