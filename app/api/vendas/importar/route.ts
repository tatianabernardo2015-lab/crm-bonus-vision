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
  const resultados: ResultadoLinha[] = [];

  for (let i = 0; i < parsed.data.linhas.length; i++) {
    const linha: LinhaImportacao = parsed.data.linhas[i];
    const nomeExibicao = linha.nome || '(sem nome)';
    try {
      const clienteId = await encontrarOuCriarCliente(supabase, linha);

      if (linha.valor_compra && linha.valor_compra > 0) {
        const { error: erroTransacao } = await supabase.from('transacoes').insert({
          cliente_id: clienteId,
          valor_compra: linha.valor_compra,
          data_compra: linha.data_compra || new Date().toISOString(),
          data_validade_bonus: linha.data_compra || new Date().toISOString(),
        });

        if (erroTransacao) throw new Error(erroTransacao.message);

        resultados.push({ linha: i + 1, nome: nomeExibicao, status: 'sucesso' });
      } else {
        resultados.push({
          linha: i + 1,
          nome: nomeExibicao,
          status: 'sucesso',
          mensagem: 'Cliente cadastrado com dados incompletos - preencha manualmente depois.',
        });
      }
    } catch (err) {
      resultados.push({
        linha: i + 1,
        nome: nomeExibicao,
        status: 'erro',
        mensagem: err instanceof Error ? err.message : 'Falha desconhecida',
      });
    }
  }

  const sucesso = resultados.filter((r) => r.status === 'sucesso').length;
  const erros = resultados.filter((r) => r.status === 'erro');

  return NextResponse.json({ total: resultados.length, sucesso, erros });
}

async function encontrarOuCriarCliente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  linha: LinhaImportacao
): Promise<string> {
  if (linha.telefone) {
    const { data: existente } = await supabase
      .from('clientes')
      .select('id, arquivado')
      .eq('telefone', linha.telefone)
      .maybeSingle();

    if (existente) {
      await supabase
        .from('clientes')
        .update({
          ...(linha.oftalmologista_preferido ? { oftalmologista_preferido: linha.oftalmologista_preferido } : {}),
          ...(linha.oftalmologista_telefone ? { oftalmologista_telefone: linha.oftalmologista_telefone } : {}),
          ...(existente.arquivado ? { arquivado: false } : {}),
        })
        .eq('id', existente.id);
      return existente.id;
    }
  }

  const { data: novo, error } = await supabase
    .from('clientes')
    .insert({
      nome: linha.nome || 'Cliente sem nome',
      telefone: linha.telefone || '',
      email: linha.email || null,
      oftalmologista_preferido: linha.oftalmologista_preferido || '',
      oftalmologista_telefone: linha.oftalmologista_telefone || null,
    })
    .select('id')
    .single();

  if (error || !novo) throw new Error(error?.message || 'Falha ao criar cliente');
  return novo.id;
}