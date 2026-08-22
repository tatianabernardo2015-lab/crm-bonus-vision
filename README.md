# CRM Bonus Vision

CRM de cashback e retenção de pacientes para óticas e clínicas oftalmológicas, inspirado no modelo do CRM BONUS. Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Realtime) + Twilio (WhatsApp) + SendGrid (e-mail).

## Stack

- **Frontend:** Next.js 16 App Router (Turbopack), React 18, TypeScript, Tailwind CSS, Framer Motion, lucide-react
- **Backend/Nuvem:** Supabase (Postgres, Auth, Realtime), Route Handlers do Next.js
- **Mensageria:** Twilio (WhatsApp), SendGrid (e-mail transacional)
- **Agendamento:** Vercel Cron (ou Qstash/Google Cloud Tasks) disparando o endpoint `/api/cron/gatilho-anual` diariamente

## Estrutura

```
.github/workflows/
  ci.yml                             Pipeline de CI: lint + testes + build a cada push/PR
app/
  page.tsx                        Dashboard (Server Component, busca dados iniciais)
  layout.tsx
  loading.tsx                     UI de carregamento global
  error.tsx                       UI de erro global (error boundary)
  icon.tsx                        Ícone do app (gerado dinamicamente)
  globals.css
  login/
    page.tsx                       Tela de login/cadastro/recuperação de senha (Server Component)
    LoginForm.tsx                  Formulário client com 3 modos: entrar, criar conta, esqueci senha
    actions.ts                     Server actions: entrar, criarConta, sair, esqueciSenha, redefinirSenha
  reset-senha/
    page.tsx                       Tela de definição de nova senha (aberta pelo link do e-mail)
    ResetSenhaForm.tsx
  auth/
    confirm/route.ts               Troca o token do e-mail (recovery/signup) por uma sessão válida
  api/
    vendas/route.ts                POST cria cliente + venda + bônus (reativa cliente arquivado, se houver)
    vendas/route.test.ts           Testes de integração (Supabase mockado)
    clientes/route.ts              GET lista clientes paginada, com busca e filtro de arquivados
    clientes/[id]/route.ts         PATCH edita dados OU arquiva/reativa um cliente (soft delete)
    clientes/[id]/route.test.ts    Testes de integração (Supabase mockado)
    transacoes/route.ts            GET lista vendas paginada, com busca por cliente e filtro de status
    transacoes/[id]/route.ts       PATCH atualiza status do bônus OU cancela a venda (soft delete)
    transacoes/[id]/route.test.ts  Testes de integração — valida a cascata de cancelamento (Supabase mockado)
    agendamentos/[id]/route.ts     PATCH atualiza status do agendamento preventivo
    configuracoes/route.ts         GET/PATCH das configurações da loja (percentual de bônus, prazos)
    cron/gatilho-anual/route.ts    Job diário do gatilho de 365 dias
    agendamentos/route.ts          GET lista agendamentos preventivos paginada, com busca e filtro de status
    clientes/export/route.ts       GET exporta todos os clientes em CSV
    transacoes/export/route.ts     GET exporta todas as vendas/bônus em CSV
  privacidade/
    page.tsx                       Política de privacidade (modelo orientado à LGPD)
proxy.ts                           Protege rotas e renova a sessão Supabase em cada request (Next.js 16+)
components/
  DashboardClient.tsx              Orquestra estado, Supabase Realtime, sincronização visual e as 5 telas
  Sidebar.tsx
  SyncIndicator.tsx
  MetricCard.tsx
  CadastroModal.tsx
  EditarClienteModal.tsx           Modal de edição de um cliente existente
  ClientesList.tsx                 Lista compacta de clientes (usada no dashboard)
  ClientesView.tsx                 Tela completa "Clientes & Vendas": paginação, busca server-side, arquivar
  FilaRetorno.tsx                  Lista compacta da fila de retornos (usada no dashboard)
  FilaRetornoView.tsx              Tela completa "Fila de Retornos": paginação, busca, filtros por status
  BonusView.tsx                    Tela "Bônus": paginação, filtros por status, resgatar/cancelar venda
  ConfiguracoesView.tsx            Tela "Configurações": percentual de bônus e prazos configuráveis por loja
  GlassPanel.tsx
lib/
  supabase/client.ts                Cliente Supabase (browser)
  supabase/server.ts                Cliente Supabase (server + service role)
  supabase/middleware.ts            Lógica de proteção de rotas usada pelo proxy.ts
  validation.ts                     Schemas Zod compartilhados por todas as rotas de API (testados)
  validation.test.ts                Testes unitários dos schemas de validação
  utils.ts
  utils.test.ts                     Testes unitários das funções de formatação/data/gatilho
services/
  whatsapp.ts                       Integração Twilio
  email.ts                          Integração SendGrid
supabase/
  schema.sql                        Schema completo: tabelas, triggers, view, RLS, Realtime (instalação limpa)
  migration_002_multi_loja.sql      Histórico incremental (isolamento por loja)
  migration_003_configuracoes.sql   Histórico incremental (configurações por loja)
  migration_004_soft_delete.sql     Histórico incremental (arquivar/cancelar)
  migration_005_fix_trigger_fk_bug.sql  Catch-up completo + correção crítica — veja a seção acima
types/
  index.ts
test/
  supabase-mock.ts                  Mock reutilizável do cliente Supabase para os testes de integração de rotas
```

## ⚠️ Correção crítica: bug de foreign key no trigger de vendas

Esta seção existe para chamar atenção a um problema sério que foi encontrado e corrigido — leia mesmo que você já tenha rodado os scripts anteriores.

**O que estava quebrado:** desde a primeira versão deste projeto, o trigger que roda ao registrar uma venda (`fn_criar_agendamento_preventivo`) tentava, num único trigger `BEFORE INSERT`, calcular os valores da própria venda **e** inserir o agendamento de retorno preventivo referenciando o `id` da venda como chave estrangeira. Isso falha sempre com `violates foreign key constraint`, porque num trigger `BEFORE INSERT` a linha ainda não foi de fato gravada na tabela — o `id` não existe ainda do ponto de vista do banco. **Na prática, toda venda registrada pelo aplicativo teria falhado.**

Esse tipo de erro não aparece em `npm run build`, `npm run lint`, nem em revisão de código — só é visível testando os triggers contra um Postgres real com foreign keys de verdade sendo aplicadas. Foi encontrado rodando o `schema.sql` deste projeto contra uma instância local de teste (Postgres 16, com um stub do schema `auth` do Supabase e uma role sem privilégio de dono da tabela, para reproduzir fielmente as condições de RLS do Supabase hospedado).

**A correção:** a lógica foi dividida em dois triggers — um `BEFORE INSERT` (`fn_calcular_bonus_transacao`, só calcula `percentual_bonus` e `data_validade_bonus`, mutando a própria linha) e um `AFTER INSERT` (`fn_criar_agendamento_preventivo`, só então insere o agendamento, quando a linha de `transacoes` já existe de fato na tabela).

**O que fazer:**
- **Instalação nova:** `schema.sql` já vem corrigido, não precisa fazer nada além do setup normal.
- **Já rodou schema.sql e/ou alguma migration anterior:** rode `supabase/migration_005_fix_trigger_fk_bug.sql` no SQL Editor do Supabase. Ela é **autocontida e idempotente** — cobre tudo que as migrations 002, 003 e 004 fazem juntas, então funciona independentemente de quais delas você já aplicou, e é segura de rodar mais de uma vez.

Depois de corrigido, o comportamento foi validado ponta a ponta contra um Postgres real: trigger calculando os valores corretamente, agendamento sendo criado sem violar a FK, isolamento RLS entre duas lojas diferentes (uma não vê os dados da outra, inclusive na view de métricas), e os fluxos de soft delete (cancelar venda / arquivar cliente).

**Validação adicional — o caminho real de upgrade:** para ter certeza de que `migration_005` realmente resolve o problema de quem já usa o sistema (não só em uma instalação limpa), reconstruí o `schema.sql` original (v1, com o bug) e simulei o cenário completo: uma loja cadastra clientes normalmente e tenta registrar uma venda — que falha 100% das vezes, confirmando o bug na prática (e revelando um segundo problema relacionado: a v1 também nunca teve uma *policy* de `INSERT` em `agendamentos_preventivos`, então mesmo corrigindo só a foreign key, o RLS ainda bloquearia). Depois apliquei `migration_005` sobre esse mesmo banco, com os clientes já cadastrados, e confirmei: os clientes existentes sobreviveram intactos, a configuração da loja foi criada via backfill, e a mesma venda que antes falhava agora é registrada com sucesso, com o agendamento preventivo criado corretamente pelo trigger.

Esse teste também pegou um terceiro bug, desta vez na própria `migration_005`: o Postgres não permite que `CREATE OR REPLACE VIEW` insira uma coluna no meio de uma lista de colunas já existente (só no final) — a view `vw_metricas_dashboard` tentava inserir `bonus_disponivel` entre `bonus_resgatado` e `clientes_ativos`, o que quebra ao evoluir a partir de uma view mais antiga sem essa coluna. Corrigido movendo `bonus_disponivel` para o final da lista (em `migration_004` e `migration_005`; não afeta o `schema.sql` de instalação limpa, já que ali não há view anterior para entrar em conflito).

## Validado contra um projeto Supabase hospedado real (não só localmente)

Além dos testes locais contra Postgres, o `schema.sql` foi aplicado de verdade num projeto Supabase novo, e o **Security Advisor** e o **Performance Advisor** nativos do Supabase (Project Settings → Advisors) encontraram mais 6 problemas reais, todos corrigidos e incorporados ao `schema.sql` (e disponíveis como `supabase/migration_006_advisor_fixes.sql` para quem já tem um banco em uso):

- **`function_search_path_mutable`** — `fn_calcular_bonus_transacao` e `fn_criar_agendamento_preventivo` não tinham `search_path` fixado, uma brecha para ataques de *search_path hijacking*. Corrigido com `set search_path = public` nas duas.
- **`SECURITY DEFINER` exposta publicamente** — `fn_criar_configuracoes_padrao` podia ser chamada diretamente por qualquer usuário anônimo via `/rest/v1/rpc/fn_criar_configuracoes_padrao` (ela roda com privilégio elevado). Corrigido revogando `EXECUTE` de `public`/`anon`/`authenticated` — a execução via trigger continua normal.
- **`unindexed_foreign_keys`** — `agendamentos_preventivos.cliente_id` e `.transacao_id` (usadas pesadamente em joins e no cancelamento em cascata) não tinham índice cobrindo.
- **`auth_rls_initplan`** — todas as 12 policies de RLS foram reescritas trocando `auth.uid()` por `(select auth.uid())`, para o Postgres avaliar a função uma vez por *query* em vez de uma vez por *linha* (recomendação oficial do Supabase para escala).

Depois dessas correções, o fluxo completo foi testado no projeto real: criação de usuário → `configuracoes_loja` gerada automaticamente pelo trigger → cadastro de cliente → **venda de R$800 registrada com sucesso, gerando R$160 de bônus** → agendamento de retorno criado com +365 dias exatos → view de métricas correta. Advisors zerados (só restam avisos `unused_index`, esperados e sem ação necessária num banco recém-criado sem tráfego).

## Como rodar localmente

1. **Crie um projeto no [Supabase](https://supabase.com)** e rode o conteúdo de `supabase/schema.sql` no SQL Editor. Isso cria as tabelas `clientes`, `transacoes`, `agendamentos_preventivos`, o trigger que gera automaticamente a validade do bônus (60 dias) e o agendamento preventivo (365 dias), a view de métricas e habilita Realtime.

2. **Copie as variáveis de ambiente:**
   ```bash
   cp .env.example .env.local
   ```
   Preencha com as chaves do Supabase (Project Settings → API), Twilio e SendGrid. Sem Twilio/SendGrid configurados, os envios são simulados (logados no console) — útil para testar sem custos.

3. **Instale as dependências e rode:**
   ```bash
   npm install
   npm run dev
   ```
   Acesse `http://localhost:3000`.

## Autenticação e isolamento por loja

O sistema usa **Supabase Auth** (e-mail/senha). O `middleware.ts` intercepta toda requisição, renova a sessão e redireciona para `/login` quem não está autenticado — as rotas `/api/*` ficam de fora desse redirecionamento (protegidas pelo `CRON_SECRET` ou pelas próprias RLS policies).

- **Cada conta de usuário representa uma loja/clínica.** As tabelas `clientes`, `transacoes` e `agendamentos_preventivos` têm uma coluna `usuario_id` (preenchida automaticamente com `auth.uid()` na criação) e as RLS policies restringem cada usuário a enxergar e alterar apenas os próprios registros — duas lojas usando o mesmo sistema não veem os dados uma da outra.
- A view `vw_metricas_dashboard` é criada com `security_invoker = true`: sem isso, ela rodaria com o privilégio do dono da view (geralmente `postgres`) e ignoraria o RLS, vazando métricas entre lojas diferentes.
- Em produção, o mais comum é **desativar o autocadastro** (tela de "Criar conta") e convidar cada usuário da loja pelo painel do Supabase (Authentication → Users → Invite). A tela de login já vem com um toggle "Criar conta", útil em desenvolvimento — remova-o ou restrinja por domínio de e-mail antes de publicar.
- **Se você já rodou o `schema.sql` original e ainda não aplicou nenhuma correção**, o caminho mais simples é rodar direto `supabase/migration_005_fix_trigger_fk_bug.sql` (veja a seção "⚠️ Correção crítica" acima) — ela sozinha cobre tudo que as migrations 002, 003 e 004 fazem, incluindo a correção do bug de foreign key. As migrations 002/003/004 continuam no repositório como registro histórico incremental, mas não é necessário rodá-las uma por uma.
- **Recuperação de senha:** o link do e-mail de "esqueci minha senha" aponta para `/auth/confirm`, que troca o token por uma sessão válida antes de redirecionar para `/reset-senha`. Isso depende da variável `NEXT_PUBLIC_SITE_URL` estar configurada corretamente (a URL pública do seu site em produção) — veja `.env.example`.

## Soft delete: arquivar clientes e cancelar vendas

Nada é apagado de verdade — clientes "arquivados" e vendas "canceladas" continuam no banco (auditoria, LGPD, histórico financeiro), só saem das listas ativas e das métricas:

- **Arquivar cliente** (botão na tela "Clientes & Vendas"): o cliente some da lista padrão, mas pode ser visto marcando "Mostrar arquivados". Se ele fizer uma nova compra depois, `/api/vendas` reativa automaticamente o cadastro.
- **Cancelar venda** (botão na tela "Bônus"): desfaz o bônus gerado e cancela em cascata o agendamento de retorno preventivo criado por aquela venda — pensado para corrigir lançamentos errados sem sujar as métricas de faturamento.
- **Se você já rodou os scripts anteriores** e só precisa das colunas `arquivado`/`cancelada` isoladamente, `supabase/migration_004_soft_delete.sql` também está disponível — mas se você ainda não aplicou nenhuma correção, prefira rodar só a `migration_005`, que já inclui isso.

## Paginação

As telas "Clientes & Vendas", "Bônus" e "Fila de Retornos" carregam 30 registros por vez (`GET /api/clientes`, `GET /api/transacoes`, `GET /api/agendamentos`, todas com busca e filtros aplicados no banco, não no navegador) com um botão "Carregar mais" — a carga inicial da página (`app/page.tsx`) também busca só a primeira página de cada uma, então o dashboard continua rápido independentemente de quantos clientes/vendas a loja acumular. O histórico de compras de cada cliente (ao expandir a linha) é buscado sob demanda, não faz parte da carga inicial.

## Exportação de dados (CSV)

As telas "Clientes & Vendas" e "Bônus" têm um botão "Exportar CSV" que baixa até 5.000 registros (`GET /api/clientes/export` e `GET /api/transacoes/export`), incluindo BOM UTF-8 para abrir corretamente acentuação no Excel. Útil para backups manuais, contabilidade ou migração de dados.

## LGPD e privacidade

`app/privacidade/page.tsx` é um **modelo de política de privacidade**, não uma peça jurídica pronta — revise com um advogado ou DPO antes de publicar (a página já avisa isso no topo). Ela cobre: quais dados são coletados, finalidade e base legal, quais operadores terceiros têm acesso (Supabase, Twilio, SendGrid, Vercel), retenção via arquivamento/cancelamento (soft delete), e os direitos do titular previstos no art. 18 da LGPD. A página é pública (não exige login) e está linkada no rodapé do login e na tela de Configurações.

## Testes automatizados

O projeto usa **Vitest** para testar a lógica de negócio pura e, agora, também as rotas de API mais críticas com o Supabase mockado:

- `lib/utils.test.ts` — formatação de moeda/data, cálculo de dias e do status do gatilho de retorno (`agendado` / `iminente` / `disparado`), incluindo os casos de fronteira (exatamente 30 dias, exatamente 0 dias), e o escape de campos CSV.
- `lib/validation.test.ts` — os schemas Zod usados por todas as rotas de API (`lib/validation.ts`), incluindo os casos onde duas rotas usam `safeParse` em cascata para diferenciar a intenção da requisição (ex: `PATCH /api/clientes/[id]` aceita tanto "editar dados" quanto "arquivar/reativar" no mesmo endpoint, e os testes garantem que um payload não é confundido com o outro).
- `app/api/vendas/route.test.ts`, `app/api/clientes/[id]/route.test.ts`, `app/api/transacoes/[id]/route.test.ts` — testes de integração das três rotas de API mais críticas, com o cliente Supabase mockado via `test/supabase-mock.ts` (uma query builder falsa que simula `.from().select().eq().single()` etc). O teste mais importante desse grupo confirma que **cancelar uma venda cancela em cascata o agendamento de retorno vinculado** — validei que esse teste realmente pega uma regressão comentando a linha de cascata no código de propósito e confirmando que o teste falha, antes de restaurar o código.

Rodar os testes:
```bash
npm test        # roda uma vez e sai (usado em CI)
npm run test:watch  # modo watch, para desenvolvimento
```

**O que não está coberto:** os testes de rota usam um mock manual do Supabase (não um banco real), então não pegam problemas de RLS, triggers ou constraints do Postgres — para isso, veja a seção "⚠️ Correção crítica" acima, que descreve testes feitos diretamente contra uma instância real de Postgres. Também não há testes de componentes React. Se o projeto crescer, os próximos candidatos naturais seriam testes de schema com pgTAP (ou um script CI que sobe Postgres em Docker) e testes de componente com Testing Library.

## Fluxo de negócio

1. **Venda:** o formulário "Nova venda" chama `POST /api/vendas`, que cria (ou reutiliza) o cliente, insere a transação e dispara o WhatsApp com o bônus (20% do valor, válido por 60 dias).
2. **Trigger no banco:** ao inserir a transação, o trigger `fn_criar_agendamento_preventivo` calcula `data_validade_bonus` (+60 dias) e insere automaticamente um registro em `agendamentos_preventivos` com `data_programada` = data da compra + 365 dias, já vinculado ao oftalmologista de preferência do cliente.
3. **Cron diário:** `GET /api/cron/gatilho-anual` (protegido por `CRON_SECRET`) busca os agendamentos cuja `data_programada` é hoje e status `pendente`, envia a mensagem personalizada de retorno preventivo e atualiza o status para `notificado`.
4. **Tempo real:** o dashboard assina mudanças via Supabase Realtime (`postgres_changes`) nas três tabelas, então qualquer inserção — feita pelo próprio usuário ou por outro terminal — aparece instantaneamente, com o indicador "Salvando na nuvem…" / "Alterações salvas com sucesso" no topo.

## CI (integração contínua)

`.github/workflows/ci.yml` roda automaticamente em todo push e pull request para a branch `main`: instala as dependências (`npm ci`), roda `npm run lint`, `npm test` e `npm run build`, nessa ordem — qualquer um falhando quebra o pipeline. O build usa variáveis de ambiente fictícias (só o suficiente para o `next build` compilar; o Supabase não é contatado de verdade durante o build, já que `app/page.tsx` está marcado como `dynamic = 'force-dynamic'` e não tenta pré-renderizar). Configure os *secrets* reais do Supabase/Twilio/SendGrid apenas no ambiente de deploy (Vercel), não no CI.

## Deploy

- **Vercel:** conecte o repositório, configure as variáveis de ambiente e defina `CRON_SECRET`. O arquivo `vercel.json` já agenda o job diário às 9h (`/api/cron/gatilho-anual`).
- Alternativamente, use **Qstash (Upstash)** ou **Google Cloud Tasks** para chamar o mesmo endpoint diariamente, enviando o header `Authorization: Bearer <CRON_SECRET>`.

## Notas da migração para Next.js 16

O projeto já está atualizado para o Next.js 16 (Turbopack como bundler padrão), o que resolveu as duas vulnerabilidades *high* que o `npm audit` apontava na linha 14.2.x (exposição de Server Functions e a dependência transitiva do PostCSS) — `npm audit` agora reporta **0 vulnerabilidades**. Principais mudanças aplicadas:

- `middleware.ts` → **`proxy.ts`** (nova convenção obrigatória do Next 16; o nome antigo é silenciosamente ignorado, sem erro de build, então é fácil não perceber que a proteção de rotas parou de funcionar).
- `cookies()`, `params` e `searchParams` agora são **assíncronos** — `createClient()` em `lib/supabase/server.ts` virou `async`, e as rotas dinâmicas (`/api/transacoes/[id]`, `/api/agendamentos/[id]`) e `app/login/page.tsx` fazem `await` desses valores.
- O `@import` da fonte no `globals.css` precisou vir **antes** das diretivas `@tailwind` — o Turbopack passou a validar essa regra do CSS de forma estrita (o Webpack deixava passar).
- React permanece na versão 18 (o Next 16 aceita `^18.2.0 || ^19.0.0` como peer dependency), para reduzir a superfície de mudança nesta migração.
- **`next lint` foi removido do core do Next.js na v16** — o comando `npm run lint` agora chama o `eslint` diretamente, com uma config flat própria (`eslint.config.mjs`) usando os exports nativos do `eslint-config-next` 16.3.1. Rodar o lint pegou (e eu corrigi) um `require()` dinâmico em `lib/supabase/server.ts` que virou `import` estático no topo do arquivo.
