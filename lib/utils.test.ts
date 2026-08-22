import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatarMoeda, formatarData, diasDesde, statusGatilho, cn, escaparCsv } from './utils';

describe('formatarMoeda', () => {
  it('formata um valor positivo em Real brasileiro', () => {
    expect(formatarMoeda(1234.5)).toBe('R$\u00a01.234,50');
  });

  it('formata zero corretamente', () => {
    expect(formatarMoeda(0)).toBe('R$\u00a00,00');
  });

  it('formata valores com centavos truncados para duas casas', () => {
    expect(formatarMoeda(99.999)).toBe('R$\u00a0100,00');
  });
});

describe('formatarData', () => {
  it('formata uma string ISO no padrão dd mmm yyyy', () => {
    const resultado = formatarData('2026-03-15T12:00:00.000Z');
    expect(resultado).toMatch(/15/);
    expect(resultado).toMatch(/2026/);
  });

  it('aceita um objeto Date diretamente', () => {
    const resultado = formatarData(new Date('2026-01-01T00:00:00.000Z'));
    expect(resultado).toMatch(/2026/);
  });
});

describe('diasDesde', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calcula corretamente os dias passados desde uma data no passado', () => {
    expect(diasDesde('2026-06-01T12:00:00.000Z')).toBe(14);
  });

  it('retorna 0 para o dia de hoje', () => {
    expect(diasDesde('2026-06-15T12:00:00.000Z')).toBe(0);
  });

  it('retorna negativo para datas no futuro', () => {
    expect(diasDesde('2026-06-20T12:00:00.000Z')).toBe(-5);
  });
});

describe('statusGatilho', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "disparado" com diasRestantes 0 quando a data já passou', () => {
    const resultado = statusGatilho('2026-06-01T00:00:00.000Z');
    expect(resultado.status).toBe('disparado');
    expect(resultado.diasRestantes).toBe(0);
  });

  it('retorna "disparado" com diasRestantes 0 quando a data é hoje', () => {
    const resultado = statusGatilho('2026-06-15T00:00:00.000Z');
    expect(resultado.status).toBe('disparado');
    expect(resultado.diasRestantes).toBe(0);
  });

  it('retorna "iminente" quando faltam entre 1 e 30 dias', () => {
    const resultado = statusGatilho('2026-06-30T00:00:00.000Z');
    expect(resultado.status).toBe('iminente');
    expect(resultado.diasRestantes).toBe(15);
  });

  it('marca a fronteira de exatamente 30 dias como "iminente"', () => {
    const resultado = statusGatilho('2026-07-15T00:00:00.000Z');
    expect(resultado.status).toBe('iminente');
    expect(resultado.diasRestantes).toBe(30);
  });

  it('marca a fronteira de 31 dias como "agendado"', () => {
    const resultado = statusGatilho('2026-07-16T00:00:00.000Z');
    expect(resultado.status).toBe('agendado');
    expect(resultado.diasRestantes).toBe(31);
  });

  it('retorna "agendado" para datas distantes no futuro', () => {
    const resultado = statusGatilho('2027-01-01T00:00:00.000Z');
    expect(resultado.status).toBe('agendado');
  });
});

describe('cn', () => {
  it('junta classes verdadeiras com espaço', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('ignora valores falsy (false, null, undefined, string vazia)', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('retorna string vazia quando nada é passado', () => {
    expect(cn()).toBe('');
  });

  it('suporta classes condicionais no estilo comum de uso', () => {
    const ativo = true;
    const inativo = false;
    expect(cn('base', ativo && 'ativo', inativo && 'inativo')).toBe('base ativo');
  });
});

describe('escaparCsv', () => {
  it('retorna texto simples sem alterações', () => {
    expect(escaparCsv('Maria Silva')).toBe('Maria Silva');
  });

  it('envolve em aspas e escapa aspas internas quando o texto contém aspas', () => {
    expect(escaparCsv('Ótica "Visão" Clara')).toBe('"Ótica ""Visão"" Clara"');
  });

  it('envolve em aspas quando o texto contém ponto e vírgula (separador do CSV)', () => {
    expect(escaparCsv('Rua A; Bairro B')).toBe('"Rua A; Bairro B"');
  });

  it('envolve em aspas quando o texto contém quebra de linha', () => {
    expect(escaparCsv('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
  });

  it('converte null e undefined em string vazia', () => {
    expect(escaparCsv(null)).toBe('');
    expect(escaparCsv(undefined)).toBe('');
  });

  it('converte números para string', () => {
    expect(escaparCsv(42)).toBe('42');
  });
});
