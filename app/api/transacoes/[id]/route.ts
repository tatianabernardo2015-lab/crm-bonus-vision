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

    if (parsedCancelar.data.cancelada) {
      await supabase
        .from('agendamentos_preventivos')
        .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
        .eq('transacao_id', id);
    } else {
      await supabase
        .from('agendamentos_preventivos')
        .update({ status: 'pendente', atualizado_em: new Date().toISOString() })
        .eq('transacao_id', id)
        .eq('status', 'cancelado');
    }

    return NextResponse.json({ transacao: data });
  }

  const parsed = transacaoStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.status_bonus === 'utilizado') {
    const { data: transacaoAtual, error: erroBusca } = await supabase
      .from('transacoes')
      .select('valor_bonus, status_bonus')
      .eq('id', id)
      .single();

    if (erroBusca || !transacaoAtual) {
      return NextResponse.json({ erro: 'Venda nao encontrada.' }, { status: 404 });
    }

    if (transacaoAtual.status_bonus === 'utilizado') {
      return NextResponse.json({ erro: 'Este bonus ja foi resgatado.' }, { status: 400 });
    }

    const valorMinimoNecessario = transacaoAtual.valor_bonus * 4;
    const valorInformado = parsed.data.valor_nova_compra ?? 0;

    if (valorInformado < valorMinimoNecessario) {
      return NextResponse.json(
        {
          erro: `Para resgatar este bonus, a nova compra precisa ser de pelo menos 4x o valor do bonus (minimo de R$ ${valorMinimoNecessario.toFixed(2)}). Valor informado: R$ ${valorInformado.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }
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
