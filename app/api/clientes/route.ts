import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TAMANHO_PAGINA = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const offset = Number(searchParams.get('offset') ?? 0);
  const incluirArquivados = searchParams.get('incluirArquivados') === 'true';

  const supabase = await createClient();

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + TAMANHO_PAGINA - 1);

  if (!incluirArquivados) {
    query = query.eq('arquivado', false);
  }

  if (q) {
    query = query.or(`nome.ilike.%${q}%,oftalmologista_preferido.ilike.%${q}%,telefone.ilike.%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    clientes: data ?? [],
    total,
    temMais: offset + TAMANHO_PAGINA < total,
  });
}

export async function DELETE() {
  const supabase = await createClient();

  // O Supabase exige uma condicao no delete por seguranca; usamos um filtro
  // sempre verdadeiro (id diferente de um uuid que nunca existe) para apagar
  // tudo. O RLS garante que cada usuario so apaga os proprios registros.
  const idNuncaExistente = '00000000-0000-0000-0000-000000000000';

  await supabase.from('agendamentos_preventivos').delete().neq('id', idNuncaExistente);
  await supabase.from('transacoes').delete().neq('id', idNuncaExistente);
  const { error } = await supabase.from('clientes').delete().neq('id', idNuncaExistente);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true });
}
