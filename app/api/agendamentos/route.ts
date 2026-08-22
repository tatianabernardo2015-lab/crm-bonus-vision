import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TAMANHO_PAGINA = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const offset = Number(searchParams.get('offset') ?? 0);

  const supabase = await createClient();

  let query = supabase
    .from('agendamentos_preventivos')
    .select('*, cliente:clientes!inner(id, nome, telefone, oftalmologista_preferido)', { count: 'exact' })
    .neq('status', 'cancelado')
    .order('data_programada', { ascending: true })
    .range(offset, offset + TAMANHO_PAGINA - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (q) {
    query = query.ilike('clientes.nome', `%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    agendamentos: data ?? [],
    total,
    temMais: offset + TAMANHO_PAGINA < total,
  });
}
