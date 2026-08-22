'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Search, Loader2 } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarData, statusGatilho, cn } from '@/lib/utils';
import type { AgendamentoPreventivo, StatusAgendamento } from '@/types';

const ABAS: { id: StatusAgendamento | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'notificado', label: 'Notificados' },
  { id: 'agendado', label: 'Agendados' },
];

const ROTULOS_GATILHO: Record<string, { texto: string; className: string }> = {
  agendado: { texto: 'Agendado', className: 'bg-sapphire-soft text-sapphire' },
  iminente: { texto: 'Iminente', className: 'bg-amber/15 text-amber' },
  disparado: { texto: 'Disparado', className: 'bg-emerald/15 text-emerald' },
};

const ROTULOS_STATUS: Record<StatusAgendamento, { texto: string; className: string }> = {
  pendente: { texto: 'Pendente', className: 'bg-white/[0.06] text-muted' },
  notificado: { texto: 'Notificado', className: 'bg-sapphire-soft text-sapphire' },
  agendado: { texto: 'Agendado', className: 'bg-emerald/15 text-emerald' },
  cancelado: { texto: 'Cancelado', className: 'bg-red-500/15 text-red-300' },
};

export function FilaRetornoView({
  agendamentosIniciais,
  totalInicial,
  temMaisInicial,
  onAtualizarStatus,
}: {
  agendamentosIniciais: AgendamentoPreventivo[];
  totalInicial: number;
  temMaisInicial: boolean;
  onAtualizarStatus: (agendamentoId: string, status: StatusAgendamento) => Promise<void> | void;
}) {
  const [aba, setAba] = useState<StatusAgendamento | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [agendamentos, setAgendamentos] = useState(agendamentosIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [processando, setProcessando] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraRenderizacao = useRef(true);

  const buscar = async (termo: string, status: StatusAgendamento | 'todos') => {
    setBuscando(true);
    try {
      const params = new URLSearchParams();
      if (termo) params.set('q', termo);
      if (status !== 'todos') params.set('status', status);
      const resposta = await fetch(`/api/agendamentos?${params.toString()}`);
      const dados = await resposta.json();
      setAgendamentos(dados.agendamentos ?? []);
      setTotal(dados.total ?? 0);
      setTemMais(dados.temMais ?? false);
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(busca, aba), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca, aba]);

  const carregarMais = async () => {
    setCarregandoMais(true);
    try {
      const params = new URLSearchParams({ offset: String(agendamentos.length) });
      if (busca) params.set('q', busca);
      if (aba !== 'todos') params.set('status', aba);
      const resposta = await fetch(`/api/agendamentos?${params.toString()}`);
      const dados = await resposta.json();
      setAgendamentos((prev) => [...prev, ...(dados.agendamentos ?? [])]);
      setTemMais(dados.temMais ?? false);
    } finally {
      setCarregandoMais(false);
    }
  };

  const marcarAgendado = async (id: string) => {
    setProcessando(id);
    try {
      await onAtualizarStatus(id, 'agendado');
      setAgendamentos((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'agendado' } : a)));
    } finally {
      setProcessando(null);
    }
  };

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-sapphire" />
          <h2 className="text-sm font-medium text-ivory">
            Fila de retornos de 1 ano <span className="text-muted">({total})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5">
          <Search size={13} className="text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-40 bg-transparent text-xs text-ivory outline-none"
          />
          {buscando && <Loader2 size={12} className="animate-spin text-muted" />}
        </div>
      </div>

      <div className="mb-4 flex gap-1.5">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
              aba === a.id ? 'bg-sapphire text-white' : 'bg-white/[0.03] text-muted hover:text-ivory'
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {agendamentos.map((a) => {
          const gatilho = statusGatilho(a.data_programada);
          const rotuloGatilho = ROTULOS_GATILHO[gatilho.status];
          const rotuloStatus = ROTULOS_STATUS[a.status];
          const cliente = a.cliente;

          return (
            <div key={a.id} className="rounded-xl border border-line bg-white/[0.015] px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-ivory">{cliente?.nome ?? 'Cliente'}</p>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', rotuloGatilho.className)}>
                    {rotuloGatilho.texto}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', rotuloStatus.className)}>
                    {rotuloStatus.texto}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted">
                Dr(a). {a.medico_selecionado ?? cliente?.oftalmologista_preferido}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted">Retorno em {formatarData(a.data_programada)}</span>
                {a.status !== 'agendado' && a.status !== 'cancelado' && (
                  <button
                    onClick={() => marcarAgendado(a.id)}
                    disabled={processando === a.id}
                    className="rounded-lg bg-emerald/15 px-2 py-1 text-[10px] font-medium text-emerald transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {processando === a.id ? 'Salvando…' : 'Marcar agendado'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {agendamentos.length === 0 && !buscando && (
          <p className="col-span-2 py-8 text-center text-xs text-muted">Nenhum retorno nesta categoria.</p>
        )}
      </div>

      {temMais && (
        <button
          onClick={carregarMais}
          disabled={carregandoMais}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium text-muted transition-colors hover:text-ivory disabled:opacity-60"
        >
          {carregandoMais ? <Loader2 size={13} className="animate-spin" /> : null}
          {carregandoMais ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </GlassPanel>
  );
}
