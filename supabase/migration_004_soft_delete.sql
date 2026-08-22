-- ============================================================
-- CRM Bonus Vision · Migração 004: arquivar clientes / cancelar vendas
-- ============================================================
-- Rode este script se você já aplicou schema.sql + migrations 002 e 003.
-- Adiciona soft delete: clientes podem ser arquivados (saem das listas
-- ativas sem perder o histórico) e vendas podem ser canceladas (saem
-- das métricas e da fila de retorno sem apagar o registro).
-- ============================================================

alter table clientes add column if not exists arquivado boolean not null default false;
create index if not exists idx_clientes_arquivado on clientes (arquivado);

alter table transacoes add column if not exists cancelada boolean not null default false;
create index if not exists idx_transacoes_cancelada on transacoes (cancelada);

-- Atualiza a view de métricas para ignorar vendas canceladas
create or replace view vw_metricas_dashboard
with (security_invoker = true) as
select
  coalesce(sum(t.valor_bonus), 0) as bonus_gerado,
  coalesce(sum(t.valor_bonus) filter (where t.status_bonus = 'utilizado'), 0) as bonus_resgatado,
  count(distinct t.cliente_id) as clientes_ativos,
  (
    select round(
      100.0 * count(*) filter (where status = 'agendado')
      / nullif(count(*) filter (where data_programada <= current_date), 0),
      1
    )
    from agendamentos_preventivos
  ) as taxa_retorno_percentual,
  coalesce(sum(t.valor_bonus) filter (where t.status_bonus = 'disponivel'), 0) as bonus_disponivel
from transacoes t
where t.cancelada = false;
