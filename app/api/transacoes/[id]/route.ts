import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transacaoStatusSchema, transacaoCancelarSchema } from '@/lib/validation';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  const parsedCancelar = transacaoCancelarSchema.safeParse(body);
  if (parsedCancelar.success) {
    const { data, error } = await supabase
      .from('transacoes')
      .update({ cancelada: parsedCancelar.data.cancelada })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    // Cancelar a venda também cancela o agendamento preventivo que ela gerou —
    // não faz sentido lembrar o cliente de retornar por causa de uma venda desfeita.
    if (parsedCancelar.data.cancelada) {
      await supabase
        .from('agendamentos_preventivos')
        .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
        .eq('transacao_id', id);
    }

    return NextResponse.json({ transacao: data });
  }

  const parsed = transacaoStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('transacoes')
    .update({ status_bonus: parsed.data.status_bonus })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ transacao: data });
}
