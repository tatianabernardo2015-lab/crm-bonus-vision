-- ============================================================
-- CRM Bonus Vision · Migração 005: catch-up completo + correção crítica
-- ============================================================
-- Esta migração é AUTOCONTIDA e IDEMPOTENTE: pode ser rodada com segurança
-- a partir de QUALQUER estado anterior do banco — mesmo que você nunca
-- tenha rodado nenhuma das migrations 002/003/004, ou tenha rodado só
-- algumas delas. Ela cobre tudo que elas fazem, então você pode rodar só
-- esta em vez de aplicar as quatro em sequência.
--
-- BUG CRÍTICO CORRIGIDO: em todas as versões anteriores deste projeto, o
-- trigger que roda ao registrar uma venda tentava, num único trigger BEFORE
-- INSERT, calcular os valores da própria venda E inserir o agendamento de
-- retorno preventivo referenciando o id da venda como chave estrangeira.
-- Isso falha sempre com "violates foreign key constraint", porque num
-- trigger BEFORE INSERT a linha ainda não foi de fato gravada na tabela —
-- o id não existe ainda do ponto de vista do banco. Na prática, TODA venda
-- registrada pelo aplicativo falhava. Esse erro só aparece testando contra
-- um Postgres real (não é pego por lint, build, nem revisão de código) —
-- foi encontrado rodando os triggers deste projeto contra uma instância
-- local de teste.
-- ============================================================

-- 1) usuario_id em clientes/transacoes/agendamentos_preventivos (isolamento multi-loja)
alter table clientes add column if not exists usuario_id uuid references auth.users (id) on delete cascade;
alter table transacoes add column if not exists usuario_id uuid references auth.users (id) on delete cascade;
alter table agendamentos_preventivos add column if not exists usuario_id uuid references auth.users (id) on delete cascade;

update clientes set usuario_id = (select id from auth.users order by created_at asc limit 1)
  where usuario_id is null;
update transacoes t set usuario_id = c.usuario_id
  from clientes c where t.cliente_id = c.id and t.usuario_id is null;
update agendamentos_preventivos a set usuario_id = c.usuario_id
  from clientes c where a.cliente_id = c.id and a.usuario_id is null;

alter table clientes alter column usuario_id set not null;
alter table clientes alter column usuario_id set default auth.uid();
alter table transacoes alter column usuario_id set not null;
alter table transacoes alter column usuario_id set default auth.uid();
alter table agendamentos_preventivos alter column usuario_id set not null;
alter table agendamentos_preventivos alter column usuario_id set default auth.uid();

create index if not exists idx_clientes_usuario on clientes (usuario_id);
create index if not exists idx_transacoes_usuario on transacoes (usuario_id);
create index if not exists idx_agendamentos_usuario on agendamentos_preventivos (usuario_id);

-- 2) configuracoes_loja (percentual de bônus e prazos configuráveis por loja)
create table if not exists configuracoes_loja (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome_loja varchar(255),
  percentual_bonus numeric(5, 2) not null default 20.00 check (percentual_bonus > 0 and percentual_bonus <= 100),
  dias_validade_bonus integer not null default 60 check (dias_validade_bonus > 0),
  dias_gatilho_retorno integer not null default 365 check (dias_gatilho_retorno > 0),
  atualizado_em timestamptz not null default now()
);

insert into configuracoes_loja (usuario_id, nome_loja)
select id, raw_user_meta_data->>'nome_loja' from auth.users
on conflict (usuario_id) do nothing;

create or replace function fn_criar_configuracoes_padrao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.configuracoes_loja (usuario_id, nome_loja)
  values (new.id, new.raw_user_meta_data->>'nome_loja')
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_criar_configuracoes_padrao on auth.users;
create trigger trg_criar_configuracoes_padrao
  after insert on auth.users
  for each row
  execute function fn_criar_configuracoes_padrao();

-- 3) soft delete: arquivar clientes / cancelar vendas
alter table clientes add column if not exists arquivado boolean not null default false;
create index if not exists idx_clientes_arquivado on clientes (arquivado);

alter table transacoes add column if not exists cancelada boolean not null default false;
create index if not exists idx_transacoes_cancelada on transacoes (cancelada);

-- 4) O TRIGGER CORRIGIDO — dividido em BEFORE (calcula valores da própria
--    linha) e AFTER (insere o agendamento, quando transacoes.id já existe
--    de fato na tabela)
drop trigger if exists trg_criar_agendamento_preventivo on transacoes;
drop trigger if exists trg_calcular_bonus_transacao on transacoes;

create or replace function fn_calcular_bonus_transacao()
returns trigger as $$
declare
  v_config record;
begin
  select percentual_bonus, dias_validade_bonus
    into v_config
    from configuracoes_loja
    where usuario_id = new.usuario_id;

  if v_config.percentual_bonus is not null then
    new.percentual_bonus := v_config.percentual_bonus;
  end if;

  new.data_validade_bonus :=
    new.data_compra + (coalesce(v_config.dias_validade_bonus, 60) || ' days')::interval;

  return new;
end;
$$ language plpgsql;

create trigger trg_calcular_bonus_transacao
  before insert on transacoes
  for each row
  execute function fn_calcular_bonus_transacao();

create or replace function fn_criar_agendamento_preventivo()
returns trigger as $$
declare
  v_dias_gatilho integer;
begin
  select dias_gatilho_retorno
    into v_dias_gatilho
    from configuracoes_loja
    where usuario_id = new.usuario_id;

  insert into agendamentos_preventivos (usuario_id, cliente_id, transacao_id, data_programada, medico_selecionado)
  values (
    new.usuario_id,
    new.cliente_id,
    new.id,
    (new.data_compra + (coalesce(v_dias_gatilho, 365) || ' days')::interval)::date,
    (select oftalmologista_preferido from clientes where id = new.cliente_id)
  );

  return new;
end;
$$ language plpgsql;

create trigger trg_criar_agendamento_preventivo
  after insert on transacoes
  for each row
  execute function fn_criar_agendamento_preventivo();

-- 5) View de métricas — com security_invoker (senão ignora RLS e vaza
--    dados entre lojas) e ignorando vendas canceladas
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

-- 6) RLS: remove policies antigas de qualquer versão anterior e recria
--    todas, isoladas por usuario_id = auth.uid() (idempotente)
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

alter table clientes enable row level security;
alter table transacoes enable row level security;
alter table agendamentos_preventivos enable row level security;
alter table configuracoes_loja enable row level security;

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

drop policy if exists "Lojista lê sua própria configuração" on configuracoes_loja;
create policy "Lojista lê sua própria configuração"
  on configuracoes_loja for select using (usuario_id = auth.uid());
drop policy if exists "Lojista atualiza sua própria configuração" on configuracoes_loja;
create policy "Lojista atualiza sua própria configuração"
  on configuracoes_loja for update using (usuario_id = auth.uid());
drop policy if exists "Lojista cria sua própria configuração" on configuracoes_loja;
create policy "Lojista cria sua própria configuração"
  on configuracoes_loja for insert with check (usuario_id = auth.uid());

-- 7) Realtime (idempotente — não falha se a tabela já estiver na publicação)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'clientes') then
    alter publication supabase_realtime add table clientes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transacoes') then
    alter publication supabase_realtime add table transacoes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'agendamentos_preventivos') then
    alter publication supabase_realtime add table agendamentos_preventivos;
  end if;
end $$;
