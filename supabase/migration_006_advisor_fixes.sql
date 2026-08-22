-- ============================================================
-- CRM Bonus Vision · Migração 006: correções do Advisor do Supabase
-- ============================================================
-- Rode este script se você já aplicou o schema.sql (ou migration_005)
-- antes desta correção. Resolve 4 avisos de segurança e 2 de performance
-- encontrados pelo Security/Performance Advisor nativo do Supabase ao
-- testar este projeto contra uma instância real (Project Settings →
-- Database → Advisors, ou aba "Advisors" no painel).
-- ============================================================

-- 1) SEGURANÇA — function_search_path_mutable: fixa o search_path das
--    duas funções de trigger de vendas, prevenindo ataques de
--    search_path hijacking (alguém criar um objeto com o mesmo nome
--    num schema anterior no path e sequestrar a função).
alter function fn_calcular_bonus_transacao() set search_path = public;
alter function fn_criar_agendamento_preventivo() set search_path = public;

-- 2) SEGURANÇA — anon/authenticated_security_definer_function_executable:
--    fn_criar_configuracoes_padrao só deve ser invocada pelo trigger em
--    auth.users, nunca chamada diretamente via RPC por um usuário anônimo
--    ou autenticado (ela é SECURITY DEFINER, roda com privilégio elevado,
--    e por padrão o Postgres concede EXECUTE a PUBLIC em toda função nova).
--    A execução via trigger continua funcionando normalmente mesmo com o
--    EXECUTE revogado.
revoke execute on function fn_criar_configuracoes_padrao() from public;
revoke execute on function fn_criar_configuracoes_padrao() from anon;
revoke execute on function fn_criar_configuracoes_padrao() from authenticated;

-- 3) PERFORMANCE — unindexed_foreign_keys: agendamentos_preventivos tinha
--    duas foreign keys (cliente_id, transacao_id) sem índice cobrindo,
--    usadas pesadamente em joins e no cancelamento em cascata de vendas.
create index if not exists idx_agendamentos_cliente on agendamentos_preventivos (cliente_id);
create index if not exists idx_agendamentos_transacao on agendamentos_preventivos (transacao_id);

-- 4) PERFORMANCE — auth_rls_initplan: recria todas as policies de RLS
--    envolvendo auth.uid() em (select ...) — isso faz o Postgres avaliar
--    a função uma vez por QUERY em vez de uma vez por LINHA, importante
--    conforme a base de clientes cresce.
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

drop policy if exists "Lojista lê sua própria configuração" on configuracoes_loja;
create policy "Lojista lê sua própria configuração"
  on configuracoes_loja for select using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista atualiza sua própria configuração" on configuracoes_loja;
create policy "Lojista atualiza sua própria configuração"
  on configuracoes_loja for update using (usuario_id = (select auth.uid()));
drop policy if exists "Lojista cria sua própria configuração" on configuracoes_loja;
create policy "Lojista cria sua própria configuração"
  on configuracoes_loja for insert with check (usuario_id = (select auth.uid()));

-- Depois de rodar, confira em Project Settings → Advisors que os avisos
-- de segurança sumiram (alguns "unused_index" de performance podem
-- continuar aparecendo até o banco acumular tráfego real — são apenas
-- informativos, não indicam problema).
