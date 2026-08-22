-- ============================================================
-- CRM Bonus Vision · Schema PostgreSQL (Supabase)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome varchar(255) not null,
  telefone varchar(20) not null,
  email varchar(255),
  oftalmologista_preferido varchar(255) not null,
  arquivado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists idx_clientes_usuario on clientes (usuario_id);
create index if not exists idx_clientes_nome on clientes (nome);
create index if not exists idx_clientes_arquivado on clientes (arquivado);

-- ------------------------------------------------------------
-- Transações (vendas + bônus)
-- ------------------------------------------------------------
create table if not exists transacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  valor_compra numeric(10, 2) not null check (valor_compra > 0),
  percentual_bonus numeric(5, 2) not null default 20.00,
  valor_bonus numeric(10, 2) generated always as (round(valor_compra * percentual_bonus / 100, 2)) stored,
  status_bonus varchar(20) not null default 'disponivel'
    check (status_bonus in ('disponivel', 'utilizado', 'expirado')),
  cancelada boolean not null default false,
  data_compra timestamptz not null default now(),
  data_validade_bonus timestamptz not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_transacoes_usuario on transacoes (usuario_id);
create index if not exists idx_transacoes_cliente on transacoes (cliente_id);
create index if not exists idx_transacoes_status on transacoes (status_bonus);
create index if not exists idx_transacoes_cancelada on transacoes (cancelada);

-- ------------------------------------------------------------
-- Agendamentos preventivos (gatilho de 365 dias)
-- ------------------------------------------------------------
create table if not exists agendamentos_preventivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  transacao_id uuid references transacoes (id) on delete set null,
  data_programada date not null,
  status varchar(20) not null default 'pendente'
    check (status in ('pendente', 'notificado', 'agendado', 'cancelado')),
  medico_selecionado varchar(255),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index if not exists idx_agendamentos_usuario on agendamentos_preventivos (usuario_id);
create index if not exists idx_agendamentos_cliente on agendamentos_preventivos (cliente_id);
create index if not exists idx_agendamentos_transacao on agendamentos_preventivos (transacao_id);
create index if not exists idx_agendamentos_data on agendamentos_preventivos (data_programada);
create index if not exists idx_agendamentos_status on agendamentos_preventivos (status);

-- ------------------------------------------------------------
-- Configurações por loja (percentual de bônus, prazos)
-- ------------------------------------------------------------
create table if not exists configuracoes_loja (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome_loja varchar(255),
  percentual_bonus numeric(5, 2) not null default 20.00 check (percentual_bonus > 0 and percentual_bonus <= 100),
  dias_validade_bonus integer not null default 60 check (dias_validade_bonus > 0),
  dias_gatilho_retorno integer not null default 365 check (dias_gatilho_retorno > 0),
  atualizado_em timestamptz not null default now()
);

-- Cria automaticamente uma linha de configuração (com os valores padrão)
-- assim que um novo usuário se cadastra
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

-- Sem isso, qualquer usuário anônimo consegue chamar essa função
-- diretamente via /rest/v1/rpc/fn_criar_configuracoes_padrao (ela é
-- SECURITY DEFINER, roda com privilégio elevado). A execução via trigger
-- continua funcionando normalmente mesmo com o EXECUTE revogado.
revoke execute on function fn_criar_configuracoes_padrao() from public;
revoke execute on function fn_criar_configuracoes_padrao() from anon;
revoke execute on function fn_criar_configuracoes_padrao() from authenticated;

-- ------------------------------------------------------------
-- Trigger: ao inserir uma transação, gera automaticamente
-- a validade do bônus (60 dias) e o agendamento preventivo (365 dias)
-- ------------------------------------------------------------
-- IMPORTANTE: esta lógica é dividida em DOIS triggers.
--
-- fn_calcular_bonus_transacao roda BEFORE INSERT porque precisa
-- modificar a própria linha (percentual_bonus, data_validade_bonus)
-- antes dela ser gravada.
--
-- fn_criar_agendamento_preventivo roda AFTER INSERT porque insere
-- um registro em agendamentos_preventivos referenciando transacoes.id
-- como chave estrangeira — e essa linha só existe de fato na tabela
-- depois que o INSERT em transacoes é concluído. Um único trigger
-- BEFORE INSERT tentando fazer as duas coisas falha com violação de
-- foreign key, porque new.id ainda não está persistido no momento em
-- que o trigger BEFORE roda.
-- ------------------------------------------------------------
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
$$ language plpgsql set search_path = public;

drop trigger if exists trg_calcular_bonus_transacao on transacoes;
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
$$ language plpgsql set search_path = public;

drop trigger if exists trg_criar_agendamento_preventivo on transacoes;
create trigger trg_criar_agendamento_preventivo
  after insert on transacoes
  for each row
  execute function fn_criar_agendamento_preventivo();

-- ------------------------------------------------------------
-- View de métricas para o dashboard
-- ------------------------------------------------------------
create or replace view vw_metricas_dashboard
with (security_invoker = true) as
select
  coalesce(sum(t.valor_bonus), 0) as bonus_gerado,
  coalesce(sum(t.valor_bonus) filter (where t.status_bonus = 'utilizado'), 0) as bonus_resgatado,
  coalesce(sum(t.valor_bonus) filter (where t.status_bonus = 'disponivel'), 0) as bonus_disponivel,
  count(distinct t.cliente_id) as clientes_ativos,
  (
    select round(
      100.0 * count(*) filter (where status = 'agendado')
      / nullif(count(*) filter (where data_programada <= current_date), 0),
      1
    )
    from agendamentos_preventivos
  ) as taxa_retorno_percentual
from transacoes t
where t.cancelada = false;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table clientes enable row level security;
alter table transacoes enable row level security;
alter table agendamentos_preventivos enable row level security;

drop policy if exists "Lojista lê seus próprios clientes" on clientes;
create policy "Lojista lê seus próprios clientes"
  on clientes for select using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista cria seus próprios clientes" on clientes;
create policy "Lojista cria seus próprios clientes"
  on clientes for insert with check (usuario_id = (select auth.uid()));
drop policy if exists "Lojista atualiza seus próprios clientes" on clientes;
create policy "Lojista atualiza seus próprios clientes"
  on clientes for update using (usuario_id = (select auth.uid()));

drop policy if exists "Lojista lê suas próprias transacoes" on transacoes;
create policy "Lojista lê suas próprias transacoes"
  on transacoes for select using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista cria suas próprias transacoes" on transacoes;
create policy "Lojista cria suas próprias transacoes"
  on transacoes for insert with check (usuario_id = (select auth.uid()));
drop policy if exists "Lojista atualiza suas próprias transacoes" on transacoes;
create policy "Lojista atualiza suas próprias transacoes"
  on transacoes for update using (usuario_id = (select auth.uid()));

drop policy if exists "Lojista lê seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista lê seus próprios agendamentos"
  on agendamentos_preventivos for select using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista cria seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista cria seus próprios agendamentos"
  on agendamentos_preventivos for insert with check (usuario_id = (select auth.uid()));
drop policy if exists "Lojista atualiza seus próprios agendamentos" on agendamentos_preventivos;
create policy "Lojista atualiza seus próprios agendamentos"
  on agendamentos_preventivos for update using (usuario_id = (select auth.uid()));

alter table configuracoes_loja enable row level security;
drop policy if exists "Lojista lê sua própria configuração" on configuracoes_loja;
create policy "Lojista lê sua própria configuração"
  on configuracoes_loja for select using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista atualiza sua própria configuração" on configuracoes_loja;
create policy "Lojista atualiza sua própria configuração"
  on configuracoes_loja for update using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista cria sua própria configuração" on configuracoes_loja;
create policy "Lojista cria sua própria configuração"
  on configuracoes_loja for insert with check (usuario_id = (select auth.uid()));

-- Observação: as rotas /api/cron/* usam a Service Role Key (createServiceRoleClient),
-- que ignora RLS por padrão — por isso o job diário enxerga e atualiza os agendamentos
-- de todas as lojas, o que é o comportamento correto para um job agendado.

-- ------------------------------------------------------------
-- Realtime: habilita sincronização em tempo real nas 3 tabelas
-- ------------------------------------------------------------
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
