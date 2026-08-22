-- ============================================================
-- CRM Bonus Vision · Migração 002: isolamento multi-loja (usuario_id)
-- ============================================================
-- Rode este script se você já executou o schema.sql original
-- (sem a coluna usuario_id). Se está fazendo uma instalação nova,
-- ignore este arquivo — o schema.sql já vem com tudo incluído.
-- ============================================================

-- 1) Adiciona as colunas como nullable primeiro
alter table clientes add column if not exists usuario_id uuid references auth.users (id) on delete cascade;
alter table transacoes add column if not exists usuario_id uuid references auth.users (id) on delete cascade;
alter table agendamentos_preventivos add column if not exists usuario_id uuid references auth.users (id) on delete cascade;

-- 2) Backfill: atribui todos os registros existentes ao primeiro usuário
--    cadastrado (ambiente de testes com um único lojista). Se você já tem
--    mais de um usuário e dados de mais de uma loja, ajuste manualmente
--    antes de continuar — troque a subquery abaixo por um mapeamento real.
update clientes set usuario_id = (select id from auth.users order by created_at asc limit 1)
  where usuario_id is null;
update transacoes t set usuario_id = c.usuario_id
  from clientes c where t.cliente_id = c.id and t.usuario_id is null;
update agendamentos_preventivos a set usuario_id = c.usuario_id
  from clientes c where a.cliente_id = c.id and a.usuario_id is null;

-- 3) Agora que todo registro tem dono, torna a coluna obrigatória
alter table clientes alter column usuario_id set not null;
alter table clientes alter column usuario_id set default auth.uid();

alter table transacoes alter column usuario_id set not null;
alter table transacoes alter column usuario_id set default auth.uid();

alter table agendamentos_preventivos alter column usuario_id set not null;
alter table agendamentos_preventivos alter column usuario_id set default auth.uid();

create index if not exists idx_clientes_usuario on clientes (usuario_id);
create index if not exists idx_transacoes_usuario on transacoes (usuario_id);
create index if not exists idx_agendamentos_usuario on agendamentos_preventivos (usuario_id);

-- 4) Atualiza o trigger para propagar usuario_id ao agendamento gerado automaticamente.
--    IMPORTANTE: dividido em dois triggers (BEFORE para calcular valores da própria
--    linha, AFTER para inserir o agendamento) — um único trigger BEFORE tentando
--    inserir em agendamentos_preventivos referenciando new.id como FK falha, porque
--    a linha de transacoes ainda não existe de fato na tabela nesse momento.
drop trigger if exists trg_criar_agendamento_preventivo on transacoes;

create or replace function fn_calcular_bonus_transacao()
returns trigger as $$
begin
  new.data_validade_bonus := new.data_compra + interval '60 days';
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calcular_bonus_transacao on transacoes;
create trigger trg_calcular_bonus_transacao
  before insert on transacoes
  for each row
  execute function fn_calcular_bonus_transacao();

create or replace function fn_criar_agendamento_preventivo()
returns trigger as $$
begin
  insert into agendamentos_preventivos (usuario_id, cliente_id, transacao_id, data_programada, medico_selecionado)
  values (
    new.usuario_id,
    new.cliente_id,
    new.id,
    (new.data_compra + interval '365 days')::date,
    (select oftalmologista_preferido from clientes where id = new.cliente_id)
  );

  return new;
end;
$$ language plpgsql;

create trigger trg_criar_agendamento_preventivo
  after insert on transacoes
  for each row
  execute function fn_criar_agendamento_preventivo();

-- 5) Recria a view com security_invoker — sem isso, ela roda com o
--    privilégio do dono da view (geralmente "postgres") e IGNORA o RLS,
--    vazando métricas entre lojas diferentes.
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
  ) as taxa_retorno_percentual
from transacoes t;

-- 6) Substitui as policies antigas ("qualquer autenticado vê tudo")
--    pelas novas, isoladas por usuario_id = auth.uid()
drop policy if exists "Usuários autenticados leem clientes" on clientes;
drop policy if exists "Usuários autenticados criam clientes" on clientes;
drop policy if exists "Usuários autenticados escrevem clientes" on clientes;
drop policy if exists "Usuários autenticados atualizam clientes" on clientes;
drop policy if exists "Usuários autenticados leem transacoes" on transacoes;
drop policy if exists "Usuários autenticados criam transacoes" on transacoes;
drop policy if exists "Usuários autenticados escrevem transacoes" on transacoes;
drop policy if exists "Usuários autenticados atualizam transacoes" on transacoes;
drop policy if exists "Usuários autenticados leem agendamentos" on agendamentos_preventivos;
drop policy if exists "Usuários autenticados atualizam agendamentos" on agendamentos_preventivos;

drop policy if exists "Lojista lê seus próprios clientes" on clientes;
create policy "Lojista lê seus próprios clientes"
  on clientes for select using (usuario_id = auth.uid());
drop policy if exists "Lojista cria seus próprios clientes" on clientes;
create policy "Lojista cria seus próprios clientes"
  on clientes for insert with check (usuario_id = auth.uid());
drop policy if exists "Lojista atualiza seus próprios clientes" on clientes;
create policy "Lojista atualiza seus próprios clientes"
  on clientes for update using (usuario_id = auth.uid());

drop policy if exists "Lojista lê suas próprias transacoes" on transacoes;
create policy "Lojista lê suas próprias transacoes"
  on transacoes for select using (usuario_id = auth.uid());
drop policy if exists "Lojista cria suas próprias transacoes" on transacoes;
create policy "Lojista cria suas próprias transacoes"
  on transacoes for insert with check (usuario_id = auth.uid());
drop policy if exists "Lojista atualiza suas próprias transacoes" on transacoes;
create policy "Lojista atualiza suas próprias transacoes"
  on transacoes for update using (usuario_id = auth.uid());

drop policy if exists "Lojista lê seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista lê seus próprios agendamentos"
  on agendamentos_preventivos for select using (usuario_id = auth.uid());
drop policy if exists "Lojista cria seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista cria seus próprios agendamentos"
  on agendamentos_preventivos for insert with check (usuario_id = auth.uid());
drop policy if exists "Lojista atualiza seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista atualiza seus próprios agendamentos"
  on agendamentos_preventivos for update using (usuario_id = auth.uid());

-- Pronto. A partir daqui, cada usuário (loja) só enxerga e altera os
-- próprios clientes, vendas e agendamentos.
