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

  // Regra de resgate Giftback: o desconto liberado por resgate e o MENOR valor entre
  // o saldo de bonus ainda disponivel e 25% do valor da nova compra. Isso cobre os
  // dois criterios ao mesmo tempo: se a compra for >= 4x o bonus, 25% dela ja cobre
  // o bonus inteiro (resgate total); se for menor, libera so a fracao proporcional,
  // e o restante do bonus continua disponivel para uso futuro.
  if (parsed.data.status_bonus === 'utilizado') {
    const { data: transacaoAtual, error: erroBusca } = await supabase
      .from('transacoes')
      .select('valor_bonus, valor_bonus_resgatado, status_bonus')
      .eq('id', id)
      .single();

    if (erroBusca || !transacaoAtual) {
      return NextResponse.json({ erro: 'Venda nao encontrada.' }, { status: 404 });
    }

    if (transacaoAtual.status_bonus === 'utilizado') {
      return NextResponse.json({ erro: 'Este bonus ja foi totalmente resgatado.' }, { status: 400 });
    }

    const saldoDisponivel = transacaoAtual.valor_bonus - (transacaoAtual.valor_bonus_resgatado ?? 0);
    const valorNovaCompra = parsed.data.valor_nova_compra ?? 0;

    if (valorNovaCompra <= 0) {
      return NextResponse.json(
        { erro: 'Informe o valor da nova compra do cliente para calcular o desconto liberado.' },
        { status: 400 }
      );
    }

    const descontoLiberado = Math.min(saldoDisponivel, valorNovaCompra * 0.25);

    if (descontoLiberado <= 0) {
      return NextResponse.json(
        { erro: 'O valor de compra informado nao gera nenhum desconto (25% da compra e zero ou o bonus ja esta zerado).' },
        { status: 400 }
      );
    }

    const novoValorResgatado = (transacaoAtual.valor_bonus_resgatado ?? 0) + descontoLiberado;
    const novoStatus: 'disponivel' | 'utilizado' =
      novoValorResgatado >= transacaoAtual.valor_bonus ? 'utilizado' : 'disponivel';

    const { data, error } = await supabase
      .from('transacoes')
      .update({ valor_bonus_resgatado: novoValorResgatado, status_bonus: novoStatus })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ transacao: data, valor_descontado: descontoLiberado });
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
