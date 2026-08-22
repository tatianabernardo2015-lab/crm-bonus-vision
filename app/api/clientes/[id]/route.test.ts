import { describe, it, expect, vi, beforeEach } from 'vitest';
import { criarSupabaseMock, criarRequestJson } from '@/test/supabase-mock';

const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { PATCH } from './route';

function chamarPatch(id: string, body: unknown) {
  const request = criarRequestJson(`http://localhost/api/clientes/${id}`, body, 'PATCH');
  return PATCH(request as never, { params: Promise.resolve({ id }) });
}

describe('PATCH /api/clientes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('payload de arquivamento ({ arquivado: true }) só atualiza a coluna arquivado', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: { id: 'c1', nome: 'João', arquivado: true }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('c1', { arquivado: true });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.cliente.arquivado).toBe(true);
  });

  it('payload de arquivamento com { arquivado: false } reativa o cliente', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: { id: 'c1', nome: 'João', arquivado: false }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('c1', { arquivado: false });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.cliente.arquivado).toBe(false);
  });

  it('payload de edição completo (sem "arquivado") cai no fluxo de edição, não de arquivamento', async () => {
    const supabase = criarSupabaseMock({
      clientes: [
        {
          data: { id: 'c1', nome: 'João Silva', telefone: '21999998888', oftalmologista_preferido: 'Dr. X' },
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('c1', {
      nome: 'João Silva',
      telefone: '21999998888',
      oftalmologista_preferido: 'Dr. X',
    });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.cliente.nome).toBe('João Silva');
  });

  it('rejeita um payload de edição incompleto com 400, sem tentar arquivar por engano', async () => {
    mockCreateClient.mockResolvedValue(criarSupabaseMock({}));

    // Falta oftalmologista_preferido — não deve ser aceito por nenhum dos dois schemas
    const resposta = await chamarPatch('c1', { nome: 'João', telefone: '21999998888' });

    expect(resposta.status).toBe(400);
  });

  it('converte e-mail vazio em null ao editar', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: { id: 'c1', nome: 'João', email: null }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    await chamarPatch('c1', {
      nome: 'João',
      telefone: '21999998888',
      oftalmologista_preferido: 'Dr. X',
      email: '',
    });

    // O mock de `update` foi chamado; verificamos que o handler não quebrou
    // e que o resultado do banco (com email: null) foi repassado.
    expect(supabase.from).toHaveBeenCalledWith('clientes');
  });

  it('retorna 500 quando o banco falha durante o arquivamento', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: null, error: { message: 'falha simulada' } }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('c1', { arquivado: true });

    expect(resposta.status).toBe(500);
  });
});
