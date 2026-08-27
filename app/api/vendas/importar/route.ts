import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importarVendasSchema, type LinhaImportacao } from '@/lib/validation';

interface ResultadoLinha {
  linha: number;
  nome: string;
  status: 'sucesso' | 'erro';
  mensagem?: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = importarVendasSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const linhas = parsed.data.linhas;

  const clienteIdPorIndice = new Map<number, string>();
  const errosPorIndice = new Map<number, string>();

  // 1) Busca em UMA consulta todos os clientes existentes com telefone informado
  const telefones = Array.from(new Set(linhas.map((l) => l.telefone).filter((t): t is string => !!t)));
  const existentesMap = new Map<string, { id: string; arquivado: boolean }>();

  if (telefones.length > 0) {
    const { data: existentes, error: erroBusca } = await supabase
      .from('clientes')
      .select('id, telefone, arquivado')
      .in('telefone', telefones);

    if (erroBusca) {
      return NextResponse.json({ erro: erroBusca.message }, { status: 500 });
    }
    (existentes ?? []).forEach((c) => existentesMap.set(c.telefone as string, c));
  }

  // 2) Separa linhas: as que ja tem cliente cadastrado (por telefone) vao para update,
  //    as demais vao para um unico insert em lote
  const paraAtualizar: { linha: LinhaImportacao; indice: number }[] = [];
  const paraCriar: { linha: LinhaImportacao; indice: number }[] = [];

  linhas.forEach((linha, indice) => {
    if (linha.telefone && existentesMap.has(linha.telefone)) {
      paraAtualizar.push({ linha, indice });
    } else {
      paraCriar.push({ linha, indice });
    }
  });

  // 3) Atualiza clientes ja existentes (geralmente poucos, um a um)
  for (const { linha, indice } of paraAtualizar) {
    const existente = existentesMap.get(linha.telefone)!;
    const { error } = await supabase
      .from('clientes')
      .update({
        ...(linha.oftalmologista_preferido ? { oftalmologista_preferido: linha.oftalmologista_preferido } : {}),
        ...(linha.oftalmologista_telefone ? { oftalmologista_telefone: linha.oftalmologista_telefone } : {}),
        ...(existente.arquivado ? { arquivado: false } : {}),
      })
      .eq('id', existente.id);

    if (error) {
      errosPorIndice.set(indice, error.message);
    } else {
      clienteIdPorIndice.set(indice, existente.id);
    }
  }

  // 4) Cria todos os clientes novos em UM UNICO insert em lote
  if (paraCriar.length > 0) {
    const { data: novos, error } = await supabase
      .from('clientes')
      .insert(
        paraCriar.map(({ linha }) => ({
          nome: linha.nome || 'Cliente sem nome',
          telefone: linha.telefone || '',
          email: linha.email || null,
          oftalmologista_preferido: linha.oftalmologista_preferido || '',
          oftalmologista_telefone: linha.oftalmologista_telefone || null,
        }))
      )
      .select('id');

    if (error || !novos) {
      paraCriar.forEach(({ indice }) => errosPorIndice.set(indice, error?.message || 'Falha ao criar cliente'));
    } else {
      novos.forEach((novo, i) => clienteIdPorIndice.set(paraCriar[i].indice, novo.id));
    }
  }

  // 5) Insere todas as transacoes (vendas com valor) em UM UNICO insert em lote
  const transacoesParaInserir: {
    cliente_id: string;
    valor_compra: number;
    data_compra: string;
    data_validade_bonus: string;
  }[] = [];
  const indicesComTransacao: number[] = [];

  linhas.forEach((linha, indice) => {
    if (errosPorIndice.has(indice)) return;
    if (linha.valor_compra && linha.valor_compra > 0) {
      const clienteId = clienteIdPorIndice.get(indice);
      if (clienteId) {
        transacoesParaInserir.push({
          cliente_id: clienteId,
          valor_compra: linha.valor_compra,
          data_compra: linha.data_compra || new Date().toISOString(),
          data_validade_bonus: linha.data_compra || new Date().toISOString(),
        });
        indicesComTransacao.push(indice);
      }
    }
  });

  if (transacoesParaInserir.length > 0) {
    const { error: erroTransacoes } = await supabase.from('transacoes').insert(transacoesParaInserir);
    if (erroTransacoes) {
      indicesComTransacao.forEach((indice) => errosPorIndice.set(indice, erroTransacoes.message));
    }
  }

  // 6) Monta o resultado final, linha por linha
  const resultados: ResultadoLinha[] = linhas.map((linha, indice) => {
    const nomeExibicao = linha.nome || '(sem nome)';
    if (errosPorIndice.has(indice)) {
      return { linha: indice + 1, nome: nomeExibicao, status: 'erro', mensagem: errosPorIndice.get(indice) };
    }
    const temValor = !!(linha.valor_compra && linha.valor_compra > 0);
    return {
      linha: indice + 1,
      nome: nomeExibicao,
      status: 'sucesso',
      ...(temValor ? {} : { mensagem: 'Cliente cadastrado com dados incompletos - preencha manualmente depois.' }),
    };
  });

  const sucesso = resultados.filter((r) => r.status === 'sucesso').length;
  const erros = resultados.filter((r) => r.status === 'erro');

  return NextResponse.json({ total: resultados.length, sucesso, erros });
}