'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, Store, ShieldCheck } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import type { ConfiguracaoLoja } from '@/types';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">{children}</div>
      {hint && <span className="mt-1.5 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function ConfiguracoesView({
  configuracao,
  onSalvar,
}: {
  configuracao: ConfiguracaoLoja;
  onSalvar: (dados: {
    nome_loja?: string;
    percentual_bonus: number;
    dias_validade_bonus: number;
    dias_gatilho_retorno: number;
  }) => Promise<void> | void;
}) {
  const [nomeLoja, setNomeLoja] = useState(configuracao.nome_loja ?? '');
  const [percentual, setPercentual] = useState(String(configuracao.percentual_bonus));
  const [diasValidade, setDiasValidade] = useState(String(configuracao.dias_validade_bonus));
  const [diasGatilho, setDiasGatilho] = useState(String(configuracao.dias_gatilho_retorno));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    setSalvo(false);
    try {
      await onSalvar({
        nome_loja: nomeLoja || undefined,
        percentual_bonus: parseFloat(percentual) || 20,
        dias_validade_bonus: parseInt(diasValidade, 10) || 60,
        dias_gatilho_retorno: parseInt(diasGatilho, 10) || 365,
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <GlassPanel className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Store size={14} className="text-sapphire" />
          <h2 className="text-sm font-medium text-ivory">Identidade da loja</h2>
        </div>
        <Field label="Nome da loja/clínica">
          <input
            value={nomeLoja}
            onChange={(e) => setNomeLoja(e.target.value)}
            placeholder="Ótica Visão Clara"
            className="w-full bg-transparent text-sm text-ivory outline-none"
          />
        </Field>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings size={14} className="text-sapphire" />
          <h2 className="text-sm font-medium text-ivory">Regras de cashback e retorno</h2>
        </div>

        <div className="space-y-4">
          <Field label="Percentual de bônus por venda" hint="Aplicado sobre o valor de cada compra registrada">
            <div className="flex items-center gap-2">
              <input
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                type="number"
                step="0.5"
                min="0"
                max="100"
                className="w-full bg-transparent text-sm text-ivory outline-none"
              />
              <span className="text-sm text-muted">%</span>
            </div>
          </Field>

          <Field label="Validade do bônus" hint="Dias até o cashback expirar após a compra">
            <div className="flex items-center gap-2">
              <input
                value={diasValidade}
                onChange={(e) => setDiasValidade(e.target.value)}
                type="number"
                min="1"
                className="w-full bg-transparent text-sm text-ivory outline-none"
              />
              <span className="text-sm text-muted">dias</span>
            </div>
          </Field>

          <Field
            label="Gatilho de retorno preventivo"
            hint="Dias após a compra para disparar o lembrete de novo exame"
          >
            <div className="flex items-center gap-2">
              <input
                value={diasGatilho}
                onChange={(e) => setDiasGatilho(e.target.value)}
                type="number"
                min="1"
                className="w-full bg-transparent text-sm text-ivory outline-none"
              />
              <span className="text-sm text-muted">dias</span>
            </div>
          </Field>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Essas configurações valem para vendas registradas a partir de agora — bônus e agendamentos já
          criados não são alterados retroativamente.
        </p>

        <button
          onClick={salvar}
          disabled={salvando}
          className="mt-5 w-full rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Salvar configurações'}
        </button>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={14} className="text-sapphire" />
          <h2 className="text-sm font-medium text-ivory">Privacidade e dados</h2>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Clientes arquivados e vendas canceladas continuam armazenados para fins de auditoria, mas saem das
          listas ativas. Consulte a{' '}
          <Link href="/privacidade" className="text-sapphire hover:underline">
            política de privacidade
          </Link>{' '}
          para detalhes sobre como os dados dos seus clientes são tratados.
        </p>
      </GlassPanel>
    </div>
  );
}
