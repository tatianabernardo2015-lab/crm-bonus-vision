import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clienteEditarSchema, clienteArquivarSchema } from '@/lib/validation';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const parsedArquivar = clienteArquivarSchema.safeParse(body);
  if (parsedArquivar.success) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('clientes')
      .update({ arquivado: parsedArquivar.data.arquivado })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }
    return NextResponse.json({ cliente: data });
  }

  const parsed = clienteEditarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { email, ...resto } = parsed.data;
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...resto, email: email || null })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ cliente: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Nao ha delecao em cascata configurada no banco, entao apagamos primeiro
  // os registros que dependem do cliente (agendamentos e vendas), e so
  // depois o cliente em si.
  await supabase.from('agendamentos_preventivos').delete().eq('cliente_id', id);
  await supabase.from('transacoes').delete().eq('cliente_id', id);

  const { error } = await supabase.from('clientes').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true });
}
