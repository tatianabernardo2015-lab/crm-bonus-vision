import { describe, it, expect } from 'vitest';
import {
  vendaSchema,
  clienteEditarSchema,
  clienteArquivarSchema,
  transacaoStatusSchema,
  transacaoCancelarSchema,
  agendamentoStatusSchema,
  configuracoesSchema,
  importarVendasSchema,
} from './validation';

describe('vendaSchema', () => {
  const vendaValida = {
    nome: 'Camila Rangel',
    telefone: '21999990000',
    oftalmologista_preferido: 'Dra. Fernanda Reis',
    valor_compra: 250.5,
  };

  it('aceita uma venda válida com os campos obrigatórios', () => {
    expect(vendaSchema.safeParse(vendaValida).success).toBe(true);
  });

  it('aceita e-mail vazio (campo opcional)', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, email: '' }).success).toBe(true);
  });

  it('aceita um e-mail válido', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, email: 'cliente@exemplo.com' }).success).toBe(true);
  });

  it('rejeita um e-mail malformado', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, email: 'não-é-email' }).success).toBe(false);
  });

  it('rejeita nome com menos de 2 caracteres', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, nome: 'A' }).success).toBe(false);
  });

  it('rejeita telefone com menos de 8 caracteres', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, telefone: '123' }).success).toBe(false);
  });

  it('rejeita valor_compra zero ou negativo', () => {
    expect(vendaSchema.safeParse({ ...vendaValida, valor_compra: 0 }).success).toBe(false);
    expect(vendaSchema.safeParse({ ...vendaValida, valor_compra: -50 }).success).toBe(false);
  });

  it('rejeita quando falta um campo obrigatório', () => {
    const { oftalmologista_preferido, ...semOftalmo } = vendaValida;
    void oftalmologista_preferido;
    expect(vendaSchema.safeParse(semOftalmo).success).toBe(false);
  });

  it('aceita cliente_id como uuid válido e rejeita string não-uuid', () => {
    expect(
      vendaSchema.safeParse({ ...vendaValida, cliente_id: '123e4567-e89b-12d3-a456-426614174000' }).success
    ).toBe(true);
    expect(vendaSchema.safeParse({ ...vendaValida, cliente_id: 'não-é-uuid' }).success).toBe(false);
  });
});

describe('clienteEditarSchema', () => {
  it('aceita dados válidos', () => {
    expect(
      clienteEditarSchema.safeParse({
        nome: 'João',
        telefone: '21988887777',
        oftalmologista_preferido: 'Dr. Caio',
      }).success
    ).toBe(true);
  });

  it('rejeita oftalmologista_preferido vazio', () => {
    expect(
      clienteEditarSchema.safeParse({
        nome: 'João',
        telefone: '21988887777',
        oftalmologista_preferido: '',
      }).success
    ).toBe(false);
  });
});

describe('clienteArquivarSchema', () => {
  it('aceita { arquivado: true } e { arquivado: false }', () => {
    expect(clienteArquivarSchema.safeParse({ arquivado: true }).success).toBe(true);
    expect(clienteArquivarSchema.safeParse({ arquivado: false }).success).toBe(true);
  });

  it('rejeita valores não-booleanos', () => {
    expect(clienteArquivarSchema.safeParse({ arquivado: 'sim' }).success).toBe(false);
    expect(clienteArquivarSchema.safeParse({ arquivado: 1 }).success).toBe(false);
  });

  it('não é confundido com o schema de edição (chaves diferentes)', () => {
    // Garante que um payload de edição não passa acidentalmente como um payload de arquivamento,
    // já que as rotas usam safeParse em cascata para diferenciar a intenção da requisição.
    const payloadEdicao = { nome: 'João', telefone: '219999', oftalmologista_preferido: 'Dr. X' };
    expect(clienteArquivarSchema.safeParse(payloadEdicao).success).toBe(false);
  });
});

describe('transacaoStatusSchema', () => {
  it('aceita os três status válidos', () => {
    for (const status of ['disponivel', 'utilizado', 'expirado']) {
      expect(transacaoStatusSchema.safeParse({ status_bonus: status }).success).toBe(true);
    }
  });

  it('rejeita um status fora do enum', () => {
    expect(transacaoStatusSchema.safeParse({ status_bonus: 'cancelado' }).success).toBe(false);
  });
});

describe('transacaoCancelarSchema', () => {
  it('aceita { cancelada: true }', () => {
    expect(transacaoCancelarSchema.safeParse({ cancelada: true }).success).toBe(true);
  });

  it('não é confundido com o schema de status', () => {
    expect(transacaoCancelarSchema.safeParse({ status_bonus: 'disponivel' }).success).toBe(false);
  });
});

describe('agendamentoStatusSchema', () => {
  it('aceita os quatro status válidos', () => {
    for (const status of ['pendente', 'notificado', 'agendado', 'cancelado']) {
      expect(agendamentoStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejeita um status inválido', () => {
    expect(agendamentoStatusSchema.safeParse({ status: 'concluido' }).success).toBe(false);
  });
});

describe('configuracoesSchema', () => {
  const configValida = {
    percentual_bonus: 20,
    dias_validade_bonus: 60,
    dias_gatilho_retorno: 365,
  };

  it('aceita uma configuração válida sem nome_loja (opcional)', () => {
    expect(configuracoesSchema.safeParse(configValida).success).toBe(true);
  });

  it('aceita percentual_bonus no limite máximo de 100', () => {
    expect(configuracoesSchema.safeParse({ ...configValida, percentual_bonus: 100 }).success).toBe(true);
  });

  it('rejeita percentual_bonus acima de 100', () => {
    expect(configuracoesSchema.safeParse({ ...configValida, percentual_bonus: 101 }).success).toBe(false);
  });

  it('rejeita percentual_bonus zero ou negativo', () => {
    expect(configuracoesSchema.safeParse({ ...configValida, percentual_bonus: 0 }).success).toBe(false);
    expect(configuracoesSchema.safeParse({ ...configValida, percentual_bonus: -5 }).success).toBe(false);
  });

  it('rejeita dias_validade_bonus fracionário (deve ser inteiro)', () => {
    expect(configuracoesSchema.safeParse({ ...configValida, dias_validade_bonus: 60.5 }).success).toBe(false);
  });

  it('rejeita dias_gatilho_retorno zero ou negativo', () => {
    expect(configuracoesSchema.safeParse({ ...configValida, dias_gatilho_retorno: 0 }).success).toBe(false);
  });
});

describe('importarVendasSchema', () => {
  const linhaValida = {
    nome: 'Camila Rangel',
    telefone: '21999990000',
    oftalmologista_preferido: 'Dra. Fernanda Reis',
    valor_compra: 250,
  };

  it('aceita um lote com uma linha válida', () => {
    expect(importarVendasSchema.safeParse({ linhas: [linhaValida] }).success).toBe(true);
  });

  it('aceita várias linhas válidas', () => {
    expect(
      importarVendasSchema.safeParse({ linhas: [linhaValida, { ...linhaValida, telefone: '21988887777' }] }).success
    ).toBe(true);
  });

  it('rejeita um lote vazio', () => {
    expect(importarVendasSchema.safeParse({ linhas: [] }).success).toBe(false);
  });

  it('rejeita mais de 1000 linhas', () => {
    const linhas = Array.from({ length: 1001 }, () => linhaValida);
    expect(importarVendasSchema.safeParse({ linhas }).success).toBe(false);
  });

  it('aceita data_compra opcional em formato ISO', () => {
    expect(
      importarVendasSchema.safeParse({ linhas: [{ ...linhaValida, data_compra: '2026-05-10T00:00:00.000Z' }] })
        .success
    ).toBe(true);
  });

  it('rejeita uma linha com valor_compra inválido dentro do lote', () => {
    expect(
      importarVendasSchema.safeParse({ linhas: [linhaValida, { ...linhaValida, valor_compra: -10 }] }).success
    ).toBe(false);
  });
});
