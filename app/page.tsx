import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from '@/components/DashboardClient';
import type { MetricasDashboard, ConfiguracaoLoja } from '@/types';

export const dynamic = 'force-dynamic';

const TAMANHO_PAGINA = 30;

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: clientes, count: totalClientes },
    { data: transacoes, count: totalTransacoes },
    { data: agendamentos, count: totalAgendamentos },
    { data: metricas },
    { data: configuracao },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('arquivado', false)
      .order('criado_em', { ascending: false })
      .range(0, TAMANHO_PAGINA - 1),
    supabase
      .from('transacoes')
      .select('*, cliente:clientes!inner(id, nome, telefone, oftalmologista_preferido)', { count: 'exact' })
      .eq('cancelada', false)
      .order('data_compra', { ascending: false })
      .range(0, TAMANHO_PAGINA - 1),
    supabase
      .from('agendamentos_preventivos')
      .select('*, cliente:clientes!inner(id, nome, telefone, oftalmologista_preferido)', { count: 'exact' })
      .neq('status', 'cancelado')
      .order('data_programada', { ascending: true })
      .range(0, TAMANHO_PAGINA - 1),
    supabase.from('vw_metricas_dashboard').select('*').single(),
    supabase.from('configuracoes_loja').select('*').eq('usuario_id', user?.id ?? '').maybeSingle(),
  ]);

  const metricasFinais: MetricasDashboard = metricas ?? {
    bonus_gerado: 0,
    bonus_resgatado: 0,
    bonus_disponivel: 0,
    clientes_ativos: 0,
    taxa_retorno_percentual: 0,
  };

  const configuracaoFinal: ConfiguracaoLoja = configuracao ?? {
    usuario_id: user?.id ?? '',
    nome_loja: null,
    percentual_bonus: 20,
    dias_validade_bonus: 60,
    dias_gatilho_retorno: 365,
  };

  return (
    <DashboardClient
      clientesIniciais={clientes ?? []}
      totalClientes={totalClientes ?? 0}
      transacoesIniciais={transacoes ?? []}
      totalTransacoes={totalTransacoes ?? 0}
      agendamentosIniciais={agendamentos ?? []}
      totalAgendamentos={totalAgendamentos ?? 0}
      metricasIniciais={metricasFinais}
      configuracaoInicial={configuracaoFinal}
      emailUsuario={user?.email ?? ''}
    />
  );
}
