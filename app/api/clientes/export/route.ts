import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { escaparCsv, formatarData } from '@/lib/utils';

const LIMITE_EXPORTACAO = 5000;

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(LIMITE_EXPORTACAO);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const cabecalho = ['Nome', 'WhatsApp', 'E-mail', 'Oftalmologista de preferência', 'Arquivado', 'Cadastrado em'];
  const linhas = (data ?? []).map((c) =>
    [
      escaparCsv(c.nome),
      escaparCsv(c.telefone),
      escaparCsv(c.email ?? ''),
      escaparCsv(c.oftalmologista_preferido),
      escaparCsv(c.arquivado ? 'Sim' : 'Não'),
      escaparCsv(formatarData(c.criado_em)),
    ].join(';')
  );

  const csv = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-bonus-vision.csv"`,
    },
  });
}
