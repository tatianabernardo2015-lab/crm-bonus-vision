'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, Search, Loader2, Ban, Download, RotateCcw } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarData, formatarMoeda, cn } from '@/lib/utils';
import type { Cliente, StatusBonus, Transacao } from '@/types';

interface LinhaBonus extends Transacao {
  cliente?: Cliente;
}

type Aba = StatusBonus | 'todos' | 'canceladas';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'disponivel', label: 'Disponiveis' },
  { id: 'utilizado', label: 'Resgatados' },
  { id: 'expirado', label: 'Expirados' },
  { id: 'canceladas', label: 'Canceladas' },
];

const ROTULOS: Record<StatusBonus, { texto: string; className: string }> = {
  disponivel: { texto: 'Disponivel', className: 'bg-sapphire-soft text-sapphire' },
  utilizado: { texto: 'Resgatado', className: 'bg-emerald/15 text-emerald' },
  expirado: { texto: 'Expirado', className: 'bg-red-500/15 text-red-300' },
};

export function BonusView({
  transacoesIniciais,
  totalInicial,
  temMaisInicial,
  totais,
  onAtualizarStatus,
  onCancelar,
  onRestaurar,
}: {
  transacoesIniciais: LinhaBonus[];
  totalInicial: number;
  temMaisInicial: boolean;
  totais: { gerado: number; disponivel: number; resgatado: number };
  onAtualizarStatus: (transacaoId: string, status: StatusBonus, valorNovaCompra?: number) => Promise<void> | void;
  onCancelar: (transacao: LinhaBonus) => Promise<void> | void;
  onRestaurar: (transacao: LinhaBonus) => Promise<void> | void;
}) {
  const [aba, setAba] = useState<Aba>('todos');
  const [busca, setBusca] = useState('');
  const [transacoes, setTransacoes] = useState(transacoesIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [processando, setProcessando] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraRenderizacao = useRef(true);

  const buscar = async (termo: string, status: Aba) => {
    setBuscando(true);
    try {
      const params = new URLSearchParams();
      if (termo) params.set('q', termo);
      if (status === 'canceladas') {
        params.set('canceladas', 'true');
      } else if (status !== 'todos') {
        params.set('status', status);
      }
      const resposta = await fetch(`/api/transacoes?${params.toString()}`);
      const dados = await resposta.json();
      setTransacoes(dados.transacoes ?? []);
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
      const params = new URLSearchParams({ offset: String(transacoes.length) });
      if (busca) params.set('q', busca);
      if (aba === 'canceladas') {
        params.set('canceladas', 'true');
      } else if (aba !== 'todos') {
        params.set('status', aba);
      }
      const resposta = await fetch(`/api/transacoes?${params.toString()}`);
      const dados = await resposta.json();
      setTransacoes((prev) => [...prev, ...(dados.transacoes ?? [])]);
      setTemMais(dados.temMais ?? false);
    } finally {
      setCarregandoMais(false);
    }
  };

  const resgatar = async (t: LinhaBonus) => {
    const minimo = t.valor_bonus * 4;
    const entrada = window.prompt(
      `Para resgatar este bonus de ${formatarMoeda(t.valor_bonus)}, informe o valor da nova compra do cliente (minimo ${formatarMoeda(minimo)}, ou seja, 4x o valor do bonus):`
    );
    if (entrada === null) return;
    const valor = parseFloat(entrada.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Valor invalido.');
      return;
    }
    if (valor < minimo) {
      alert(
        `O valor informado (${formatarMoeda(valor)}) e menor que o minimo necessario de ${formatarMoeda(minimo)} (4x o valor do bonus). O resgate nao pode ser liberado.`
      );
      return;
    }
    setProcessando(t.id);
    try {
      await onAtualizarStatus(t.id, 'utilizado', valor);
      setTransacoes((prev) => prev.map((tt) => (tt.id === t.id ? { ...tt, status_bonus: 'utilizado' as StatusBonus } : tt)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao resgatar o bonus.');
    } finally {
      setProcessando(null);
    }
  };

  const cancelar = async (transacao: LinhaBonus) => {
    if (!confirm('Cancelar esta venda? O bonus gerado e o agendamento de retorno serao desfeitos.')) return;
    setProcessando(transacao.id);
    try {
      await onCancelar(transacao);
      setTransacoes((prev) => prev.filter((t) => t.id !== transacao.id));
      setTotal((prev) => prev - 1);
    } finally {
      setProcessando(null);
    }
  };

  const restaurar = async (transacao: LinhaBonus) => {
    if (
      !confirm(
        'Restaurar esta venda cancelada? Ela volta a aparecer normalmente e o agendamento de retorno associado e reativado.'
      )
    )
      return;
    setProcessando(transacao.id);
    try {
      await onRestaurar(transacao);
      setTransacoes((prev) => prev.filter((t) => t.id !== transacao.id));
      setTotal((prev) => prev - 1);
    } finally {
      setProcessando(null);
    }
  };

  const abaCancelada = aba === 'canceladas';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <GlassPanel className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total gerado</p>
          <p className="mt-1 text-2xl font-semibold text-ivory">{formatarMoeda(totais.gerado)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Disponivel</p>
          <p className="mt-1 text-2xl font-semibold text-sapphire">{formatarMoeda(totais.disponivel)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Resgatado</p>
          <p className="mt-1 text-2xl font-semibold text-emerald">{formatarMoeda(totais.resgatado)}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-sapphire" />
            <h2 className="text-sm font-medium text-ivory">
              Bonus gerados <span className="text-muted">({total})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- download de arquivo, nao navegacao */}
            <a
              href="/api/transacoes/export"
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-ivory"
            >
              <Download size={12} />
              Exportar CSV
            </a>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5">
              <Search size={13} className="text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-32 bg-transparent text-xs text-ivory outline-none"
              />
              {buscando && <Loader2 size={12} className="animate-spin text-muted" />}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
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

        <div className="space-y-2">
          {transacoes.map((t) => {
            const rotulo = ROTULOS[t.status_bonus];
            return (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ivory">{t.cliente?.nome ?? 'Cliente'}</p>
                  <p className="text-[11px] text-muted">
                    Compra em {formatarData(t.data_compra)} - valido ate {formatarData(t.data_validade_bonus)}
                    {t.sequencia_externa ? ` - Seq. ${t.sequencia_externa}` : ''}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 pl-3">
                  {!abaCancelada && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', rotulo.className)}>
                      {rotulo.texto}
                    </span>
                  )}
                  <p className="w-24 text-right text-sm font-medium text-ivory">{formatarMoeda(t.valor_bonus)}</p>
                  {abaCancelada ? (
                    <button
                      onClick={() => restaurar(t)}
                      disabled={processando === t.id}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-sapphire-soft px-2.5 py-1.5 text-[11px] font-medium text-sapphire transition-all hover:brightness-110 disabled:opacity-50"
                    >
                      <RotateCcw size={12} />
                      {processando === t.id ? 'Restaurando...' : 'Restaurar'}
                    </button>
                  ) : (
                    <>
                      {t.status_bonus === 'disponivel' && (
                        <button
                          onClick={() => resgatar(t)}
                          disabled={processando === t.id}
                          className="flex-shrink-0 rounded-lg bg-emerald/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald transition-all hover:brightness-110 disabled:opacity-50"
                        >
                          {processando === t.id ? 'Resgatando...' : 'Marcar resgatado'}
                        </button>
                      )}
                      <button
                        onClick={() => cancelar(t)}
                        disabled={processando === t.id}
                        className="flex-shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        title="Cancelar venda"
                      >
                        <Ban size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {transacoes.length === 0 && !buscando && (
            <p className="py-8 text-center text-xs text-muted">
              {abaCancelada ? 'Nenhuma venda cancelada encontrada.' : 'Nenhum bonus encontrado.'}
            </p>
          )}
        </div>

        {temMais && (
          <button
            onClick={carregarMais}
            disabled={carregandoMais}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium text-muted transition-colors hover:text-ivory disabled:opacity-60"
          >
            {carregandoMais ? <Loader2 size={13} className="animate-spin" /> : null}
            {carregandoMais ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}
      </GlassPanel>
    </div>
  );
}
