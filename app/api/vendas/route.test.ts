import { describe, it, expect, vi, beforeEach } from 'vitest';
import { criarSupabaseMock, criarRequestJson } from '@/test/supabase-mock';

const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

// Sem variáveis de ambiente do Twilio configuradas, sendWhatsAppMessage já
// retorna { simulado: true } sem tentar rede nenhuma — não precisa de mock.

import { POST } from './route';

describe('POST /api/vendas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const payloadValido = {
    nome: 'Camila Rangel',
    telefone: '21999990000',
    oftalmologista_preferido: 'Dra. Fernanda Reis',
    valor_compra: 250,
  };

  it('retorna 400 quando o payload é inválido', async () => {
    mockCreateClient.mockResolvedValue(criarSupabaseMock({}));

    const request = criarRequestJson('http://localhost/api/vendas', { nome: 'A' });
    const resposta = await POST(request as never);

    expect(resposta.status).toBe(400);
    const corpo = await resposta.json();
    expect(corpo.erro).toBe('Dados inválidos');
  });

  it('cria um cliente novo quando o telefone não existe ainda, e registra a venda', async () => {
    const supabase = criarSupabaseMock({
      clientes: [
        { data: null, error: null }, // busca por telefone: não encontrou
        { data: { id: 'cliente-novo-1' }, error: null }, // insert do novo cliente
      ],
      transacoes: [{ data: { id: 'transacao-1', valor_bonus: 50, cliente_id: 'cliente-novo-1' }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const request = criarRequestJson('http://localhost/api/vendas', payloadValido);
    const resposta = await POST(request as never);

    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.cliente_id).toBe('cliente-novo-1');
    expect(corpo.transacao.id).toBe('transacao-1');
  });

  it('reutiliza um cliente existente com o mesmo telefone em vez de duplicar', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: { id: 'cliente-existente-1', arquivado: false }, error: null }],
      transacoes: [{ data: { id: 'transacao-2', valor_bonus: 50, cliente_id: 'cliente-existente-1' }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const request = criarRequestJson('http://localhost/api/vendas', payloadValido);
    const resposta = await POST(request as never);

    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.cliente_id).toBe('cliente-existente-1');
    // Não deve ter tentado inserir um cliente novo — só update no existente
    expect(supabase.from).toHaveBeenCalledWith('clientes');
  });

  it('retorna 500 quando a inserção da venda falha no banco', async () => {
    const supabase = criarSupabaseMock({
      clientes: [{ data: { id: 'cliente-existente-1', arquivado: false }, error: null }],
      transacoes: [{ data: null, error: { message: 'erro simulado de banco' } }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const request = criarRequestJson('http://localhost/api/vendas', payloadValido);
    const resposta = await POST(request as never);

    expect(resposta.status).toBe(500);
    const corpo = await resposta.json();
    expect(corpo.erro).toBe('Falha ao registrar venda');
  });

  it('rejeita valor_compra negativo antes mesmo de tocar o banco', async () => {
    mockCreateClient.mockResolvedValue(criarSupabaseMock({}));

    const request = criarRequestJson('http://localhost/api/vendas', { ...payloadValido, valor_compra: -10 });
    const resposta = await POST(request as never);

    expect(resposta.status).toBe(400);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
