import { vi } from 'vitest';

export interface ResultadoMock {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

function criarChain(resultado: ResultadoMock) {
  const promessa = Promise.resolve(resultado);

  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    single: vi.fn(() => promessa),
    maybeSingle: vi.fn(() => promessa),
    // Permite `await supabase.from(...).select(...)` sem terminador explícito
    then: (resolve: (value: ResultadoMock) => unknown, reject?: (reason: unknown) => unknown) =>
      promessa.then(resolve, reject),
  };

  return chain;
}

/**
 * Cria um mock do cliente Supabase para uso em testes de rotas de API.
 *
 * `respostasPorTabela` mapeia nome da tabela -> fila de respostas (uma por
 * chamada consecutiva a `.from(tabela)`). Se a fila se esgotar, retorna
 * `{ data: null, error: null }` por padrão.
 *
 * Exemplo:
 * ```ts
 * const supabase = criarSupabaseMock({
 *   clientes: [{ data: null, error: null }], // primeira chamada a .from('clientes')
 *   transacoes: [{ data: { id: 't1', valor_bonus: 100 }, error: null }],
 * });
 * ```
 */
export function criarSupabaseMock(
  respostasPorTabela: Record<string, ResultadoMock[]>,
  usuario: { id: string; email?: string } | null = { id: 'usuario-teste-1', email: 'loja@teste.com' }
) {
  const indices: Record<string, number> = {};

  const from = vi.fn((tabela: string) => {
    const fila = respostasPorTabela[tabela] ?? [];
    const idx = indices[tabela] ?? 0;
    indices[tabela] = idx + 1;
    const resultado = fila[idx] ?? { data: null, error: null };
    return criarChain(resultado);
  });

  return {
    from,
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: usuario }, error: null })),
    },
  };
}

/** Cria uma NextRequest-like mínima (só o necessário para os route handlers deste projeto). */
export function criarRequestJson(url: string, body: unknown, method: string = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
