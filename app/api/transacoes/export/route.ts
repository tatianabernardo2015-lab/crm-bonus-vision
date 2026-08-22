import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { escaparCsv, formatarData, formatarMoeda } from '@/lib/utils';

const LIMITE_EXPORTACAO = 5000;

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transacoes')
    .select('*, cliente:clientes(nome, telefone)')
    .eq('cancelada', false)
    .order('data_compra', { ascending: false })
    .limit(LIMITE_EXPORTACAO);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const cabecalho = [
    'Cliente',
    'WhatsApp',
    'Valor da compra',
    'Valor do bônus',
    'Status do bônus',
    'Data da compra',
    'Validade do bônus',
  ];
  const linhas = (data ?? []).map((t) =>
    [
      escaparCsv(t.cliente?.nome ?? ''),
      escaparCsv(t.cliente?.telefone ?? ''),
      escaparCsv(formatarMoeda(t.valor_compra)),
      escaparCsv(formatarMoeda(t.valor_bonus)),
      escaparCsv(t.status_bonus),
      escaparCsv(formatarData(t.data_compra)),
      escaparCsv(formatarData(t.data_validade_bonus)),
    ].join(';')
  );

  const csv = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bonus-vision-vendas.csv"`,
    },
  });
}
