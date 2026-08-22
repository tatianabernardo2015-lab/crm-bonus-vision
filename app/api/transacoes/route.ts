import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TAMANHO_PAGINA = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const clienteId = searchParams.get('clienteId') ?? '';
  const offset = Number(searchParams.get('offset') ?? 0);
  const limite = clienteId ? 200 : TAMANHO_PAGINA;

  const supabase = await createClient();

  let query = supabase
    .from('transacoes')
    .select('*, cliente:clientes!inner(id, nome, telefone, oftalmologista_preferido)', { count: 'exact' })
    .eq('cancelada', false)
    .order('data_compra', { ascending: false })
    .range(offset, offset + limite - 1);

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }

  if (status) {
    query = query.eq('status_bonus', status);
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
    transacoes: data ?? [],
    total,
    temMais: offset + limite < total,
  });
}
