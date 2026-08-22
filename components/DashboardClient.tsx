'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Wallet, CheckCircle2, TrendingUp } from 'lucide-react';
import { Sidebar, NAV_ITEMS, type NavId } from './Sidebar';
import { SyncIndicator, type SyncState } from './SyncIndicator';
import { MetricCard } from './MetricCard';
import { CadastroModal } from './CadastroModal';
import { EditarClienteModal } from './EditarClienteModal';
import { ClientesList } from './ClientesList';
import { ClientesView } from './ClientesView';
import { FilaRetorno } from './FilaRetorno';
import { FilaRetornoView } from './FilaRetornoView';
import { BonusView } from './BonusView';
import { ConfiguracoesView } from './ConfiguracoesView';
import { createClient } from '@/lib/supabase/client';
import { formatarMoeda } from '@/lib/utils';
import type {
  Cliente,
  Transacao,
  AgendamentoPreventivo,
  NovaVendaInput,
  MetricasDashboard,
  StatusBonus,
  StatusAgendamento,
  ConfiguracaoLoja,
} from '@/types';

interface DashboardClientProps {
  clientesIniciais: Cliente[];
  totalClientes: number;
  transacoesIniciais: Transacao[];
  totalTransacoes: number;
  agendamentosIniciais: AgendamentoPreventivo[];
  totalAgendamentos: number;
  metricasIniciais: MetricasDashboard;
  configuracaoInicial: ConfiguracaoLoja;
  emailUsuario?: string;
}

export function DashboardClient({
  clientesIniciais,
  totalClientes,
  transacoesIniciais,
  totalTransacoes,
  agendamentosIniciais,
  totalAgendamentos,
  metricasIniciais,
  configuracaoInicial,
  emailUsuario,
}: DashboardClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('saved');

  const [clientes, setClientes] = useState(clientesIniciais);
  const [transacoes, setTransacoes] = useState(transacoesIniciais);
  const [agendamentos, setAgendamentos] = useState(agendamentosIniciais);
  const [metricas, setMetricas] = useState(metricasIniciais);
  const [configuracao, setConfiguracao] = useState(configuracaoInicial);

  const anunciarSync = useCallback(() => {
    setSyncState('saving');
    const timeout = setTimeout(() => setSyncState('saved'), 900);
    return () => clearTimeout(timeout);
  }, []);

  // Escuta mudanças em tempo real nas 3 tabelas via Supabase Realtime
  useEffect(() => {
    const canal = supabase
      .channel('crm-bonus-vision-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (payload) => {
        anunciarSync();
        if (payload.eventType === 'INSERT') {
          setClientes((prev) => [payload.new as Cliente, ...prev]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes' }, (payload) => {
        anunciarSync();
        if (payload.eventType === 'INSERT') {
          setTransacoes((prev) => [payload.new as Transacao, ...prev]);
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos_preventivos' },
        () => {
          anunciarSync();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, anunciarSync]);

  const handleNovaVenda = async (venda: NovaVendaInput) => {
    anunciarSync();
    const resposta = await fetch('/api/vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(venda),
    });

    if (!resposta.ok) {
      console.error('Falha ao registrar venda');
      return;
    }

    const { transacao } = await resposta.json();
    setTransacoes((prev) => [transacao, ...prev]);
    setMetricas((prev) => ({
      ...prev,
      bonus_gerado: prev.bonus_gerado + transacao.valor_bonus,
      bonus_disponivel: prev.bonus_disponivel + transacao.valor_bonus,
      clientes_ativos: prev.clientes_ativos + 1,
    }));
  };

  const handleAtualizarStatusBonus = async (transacaoId: string, status: StatusBonus) => {
    anunciarSync();
    const resposta = await fetch(`/api/transacoes/${transacaoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_bonus: status }),
    });

    if (!resposta.ok) {
      console.error('Falha ao atualizar status do bônus');
      return;
    }

    setTransacoes((prev) => prev.map((t) => (t.id === transacaoId ? { ...t, status_bonus: status } : t)));

    if (status === 'utilizado') {
      const transacao = transacoes.find((t) => t.id === transacaoId);
      if (transacao) {
        setMetricas((prev) => ({
          ...prev,
          bonus_resgatado: prev.bonus_resgatado + transacao.valor_bonus,
          bonus_disponivel: Math.max(0, prev.bonus_disponivel - transacao.valor_bonus),
        }));
      }
    }
  };

  const handleCancelarVenda = async (transacao: Transacao) => {
    anunciarSync();
    const resposta = await fetch(`/api/transacoes/${transacao.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelada: true }),
    });

    if (!resposta.ok) {
      console.error('Falha ao cancelar venda');
      throw new Error('Falha ao cancelar venda');
    }

    setTransacoes((prev) => prev.filter((t) => t.id !== transacao.id));
    setAgendamentos((prev) => prev.filter((a) => a.transacao_id !== transacao.id));
    setMetricas((prev) => ({
      ...prev,
      bonus_gerado: Math.max(0, prev.bonus_gerado - transacao.valor_bonus),
      bonus_disponivel:
        transacao.status_bonus === 'disponivel'
          ? Math.max(0, prev.bonus_disponivel - transacao.valor_bonus)
          : prev.bonus_disponivel,
      bonus_resgatado:
        transacao.status_bonus === 'utilizado'
          ? Math.max(0, prev.bonus_resgatado - transacao.valor_bonus)
          : prev.bonus_resgatado,
    }));
  };

  const handleAtualizarStatusAgendamento = async (agendamentoId: string, status: StatusAgendamento) => {
    anunciarSync();
    const resposta = await fetch(`/api/agendamentos/${agendamentoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!resposta.ok) {
      console.error('Falha ao atualizar status do agendamento');
      return;
    }

    setAgendamentos((prev) => prev.map((a) => (a.id === agendamentoId ? { ...a, status } : a)));
  };

  const handleEditarCliente = async (
    id: string,
    dados: { nome: string; telefone: string; email?: string; oftalmologista_preferido: string }
  ) => {
    anunciarSync();
    const resposta = await fetch(`/api/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });

    if (!resposta.ok) {
      console.error('Falha ao editar cliente');
      return;
    }

    const { cliente } = await resposta.json();
    setClientes((prev) => prev.map((c) => (c.id === id ? cliente : c)));
  };

  const handleArquivarCliente = async (cliente: Cliente, arquivado: boolean) => {
    anunciarSync();
    const resposta = await fetch(`/api/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivado }),
    });

    if (!resposta.ok) {
      console.error('Falha ao arquivar/reativar cliente');
      throw new Error('Falha ao arquivar/reativar cliente');
    }

    setClientes((prev) =>
      arquivado ? prev.filter((c) => c.id !== cliente.id) : prev.map((c) => (c.id === cliente.id ? { ...c, arquivado } : c))
    );
  };

  const handleSalvarConfiguracoes = async (dados: {
    nome_loja?: string;
    percentual_bonus: number;
    dias_validade_bonus: number;
    dias_gatilho_retorno: number;
  }) => {
    anunciarSync();
    const resposta = await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });

    if (!resposta.ok) {
      console.error('Falha ao salvar configurações');
      return;
    }

    const { configuracao: novaConfiguracao } = await resposta.json();
    setConfiguracao(novaConfiguracao);
  };

  const clientesComTransacao = useMemo(
    () =>
      clientes.map((cliente) => ({
        ...cliente,
        ultimaTransacao: transacoes.find((t) => t.cliente_id === cliente.id),
      })),
    [clientes, transacoes]
  );

  const agendamentosComCliente = useMemo(
    () =>
      agendamentos.map((a) => ({
        ...a,
        cliente: a.cliente ?? clientes.find((c) => c.id === a.cliente_id),
      })),
    [agendamentos, clientes]
  );

  return (
    <div className="flex min-h-[720px] w-full bg-bg">
      <CadastroModal open={modalOpen} onClose={() => setModalOpen(false)} onSalvar={handleNovaVenda} />
      <EditarClienteModal
        cliente={clienteEditando}
        onClose={() => setClienteEditando(null)}
        onSalvar={handleEditarCliente}
      />

      <Sidebar active={activeNav} onChange={setActiveNav} emailUsuario={emailUsuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-8 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ivory">
              {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
            </h1>
            <p className="text-xs text-muted">Painel de controle · sincronizado com Supabase</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator state={syncState} />
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-sapphire px-3.5 py-2 text-xs font-medium text-white transition-all hover:brightness-110"
            >
              <Plus size={14} />
              Nova venda
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeNav === 'dashboard' && (
            <>
              <div className="mb-6 grid grid-cols-3 gap-4">
                <MetricCard
                  label="Bônus gerados"
                  value={formatarMoeda(metricas.bonus_gerado)}
                  sub={`${totalClientes} clientes ativos`}
                  icon={Wallet}
                  accentClass="bg-sapphire-soft text-sapphire"
                  accentHex="#2563EB"
                />
                <MetricCard
                  label="Bônus resgatados"
                  value={formatarMoeda(metricas.bonus_resgatado)}
                  sub="Total utilizado em lojas"
                  icon={CheckCircle2}
                  accentClass="bg-emerald/15 text-emerald"
                  accentHex="#10B981"
                />
                <MetricCard
                  label="Taxa de retorno (1 ano)"
                  value={metricas.taxa_retorno_percentual ? `${metricas.taxa_retorno_percentual}%` : '—'}
                  sub="Clientes que reagendaram exame"
                  icon={TrendingUp}
                  accentClass="bg-amber/15 text-amber"
                  accentHex="#F59E0B"
                />
              </div>

              <div className="grid grid-cols-5 gap-5">
                <ClientesList clientes={clientesComTransacao} />
                <FilaRetorno agendamentos={agendamentosComCliente} />
              </div>
            </>
          )}

          {activeNav === 'clientes' && (
            <ClientesView
              clientesIniciais={clientesIniciais}
              totalInicial={totalClientes}
              temMaisInicial={totalClientes > clientesIniciais.length}
              onEditar={(cliente) => setClienteEditando(cliente)}
              onArquivar={handleArquivarCliente}
            />
          )}

          {activeNav === 'fila' && (
            <FilaRetornoView
              agendamentosIniciais={agendamentosComCliente}
              totalInicial={totalAgendamentos}
              temMaisInicial={totalAgendamentos > agendamentosIniciais.length}
              onAtualizarStatus={handleAtualizarStatusAgendamento}
            />
          )}

          {activeNav === 'bonus' && (
            <BonusView
              transacoesIniciais={transacoesIniciais}
              totalInicial={totalTransacoes}
              temMaisInicial={totalTransacoes > transacoesIniciais.length}
              totais={{
                gerado: metricas.bonus_gerado,
                disponivel: metricas.bonus_disponivel,
                resgatado: metricas.bonus_resgatado,
              }}
              onAtualizarStatus={handleAtualizarStatusBonus}
              onCancelar={handleCancelarVenda}
            />
          )}

          {activeNav === 'configuracoes' && (
            <ConfiguracoesView configuracao={configuracao} onSalvar={handleSalvarConfiguracoes} />
          )}
        </div>
      </main>
    </div>
  );
}
