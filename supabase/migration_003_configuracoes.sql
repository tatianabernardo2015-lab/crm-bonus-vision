-- ============================================================
-- CRM Bonus Vision · Migração 003: configurações por loja
-- ============================================================
-- Rode este script se você já aplicou schema.sql + migration_002.
-- Cria a tabela configuracoes_loja (percentual de bônus e prazos
-- configuráveis, hoje fixos no código), o trigger que cria uma
-- linha padrão para cada novo cadastro, e faz backfill dos
-- usuários que já existem.
-- ============================================================

create table if not exists configuracoes_loja (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome_loja varchar(255),
  percentual_bonus numeric(5, 2) not null default 20.00 check (percentual_bonus > 0 and percentual_bonus <= 100),
  dias_validade_bonus integer not null default 60 check (dias_validade_bonus > 0),
  dias_gatilho_retorno integer not null default 365 check (dias_gatilho_retorno > 0),
  atualizado_em timestamptz not null default now()
);

-- Backfill: cria a configuração padrão para todo usuário já cadastrado
insert into configuracoes_loja (usuario_id, nome_loja)
select id, raw_user_meta_data->>'nome_loja' from auth.users
on conflict (usuario_id) do nothing;

-- Trigger: cria a configuração padrão automaticamente em todo novo cadastro
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

-- Atualiza o trigger de vendas para ler o percentual/prazos configurados
-- em vez dos valores fixos (20% / 60 dias / 365 dias).
-- IMPORTANTE: dividido em dois triggers (BEFORE para calcular valores da
-- própria linha, AFTER para inserir o agendamento) — um único trigger BEFORE
-- tentando inserir em agendamentos_preventivos referenciando new.id como FK
-- falha, porque a linha de transacoes ainda não existe de fato na tabela
-- nesse momento.
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

alter table configuracoes_loja enable row level security;
drop policy if exists "Lojista lê sua própria configuração" on configuracoes_loja;
create policy "Lojista lê sua própria configuração"
  on configuracoes_loja for select using (usuario_id = auth.uid());
drop policy if exists "Lojista atualiza sua própria configuração" on configuracoes_loja;
create policy "Lojista atualiza sua própria configuração"
  on configuracoes_loja for update using (usuario_id = auth.uid());
drop policy if exists "Lojista cria sua própria configuração" on configuracoes_loja;
create policy "Lojista cria sua própria configuração"
  on configuracoes_loja for insert with check (usuario_id = auth.uid());
