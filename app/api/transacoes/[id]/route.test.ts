import { describe, it, expect, vi, beforeEach } from 'vitest';
import { criarSupabaseMock, criarRequestJson } from '@/test/supabase-mock';

const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { PATCH } from './route';

function chamarPatch(id: string, body: unknown) {
  const request = criarRequestJson(`http://localhost/api/transacoes/${id}`, body, 'PATCH');
  return PATCH(request as never, { params: Promise.resolve({ id }) });
}

describe('PATCH /api/transacoes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atualiza apenas status_bonus quando o payload é { status_bonus }', async () => {
    const supabase = criarSupabaseMock({
      transacoes: [{ data: { id: 't1', status_bonus: 'utilizado', cancelada: false }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('t1', { status_bonus: 'utilizado' });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.transacao.status_bonus).toBe('utilizado');
    // Não deve ter tocado em agendamentos_preventivos neste fluxo
    expect(supabase.from).not.toHaveBeenCalledWith('agendamentos_preventivos');
  });

  it('CRÍTICO: cancelar uma venda ({ cancelada: true }) também cancela o agendamento vinculado', async () => {
    const supabase = criarSupabaseMock({
      transacoes: [{ data: { id: 't1', cancelada: true, status_bonus: 'disponivel' }, error: null }],
      agendamentos_preventivos: [{ data: null, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('t1', { cancelada: true });

    expect(resposta.status).toBe(200);
    // A parte mais importante deste teste: confirma que a rota realmente
    // tocou a tabela de agendamentos ao cancelar a venda — é o comportamento
    // em cascata que documentamos no README e que não pode regredir.
    expect(supabase.from).toHaveBeenCalledWith('agendamentos_preventivos');
  });

  it('reativar uma venda ({ cancelada: false }) NÃO mexe no agendamento', async () => {
    const supabase = criarSupabaseMock({
      transacoes: [{ data: { id: 't1', cancelada: false }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('t1', { cancelada: false });

    expect(resposta.status).toBe(200);
    expect(supabase.from).not.toHaveBeenCalledWith('agendamentos_preventivos');
  });

  it('rejeita um status_bonus fora do enum com 400', async () => {
    mockCreateClient.mockResolvedValue(criarSupabaseMock({}));

    const resposta = await chamarPatch('t1', { status_bonus: 'reembolsado' });

    expect(resposta.status).toBe(400);
  });

  it('retorna 500 quando o update da venda falha, sem tentar cancelar o agendamento', async () => {
    const supabase = criarSupabaseMock({
      transacoes: [{ data: null, error: { message: 'falha simulada' } }],
    });
    mockCreateClient.mockResolvedValue(supabase);

    const resposta = await chamarPatch('t1', { cancelada: true });

    expect(resposta.status).toBe(500);
    expect(supabase.from).not.toHaveBeenCalledWith('agendamentos_preventivos');
  });
});
