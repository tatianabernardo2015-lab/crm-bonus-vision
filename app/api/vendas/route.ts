import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage, montarMensagemBonus } from '@/services/whatsapp';
import { formatarMoeda } from '@/lib/utils';
import { vendaSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = vendaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const { nome, telefone, email, oftalmologista_preferido, valor_compra, cliente_id } = parsed.data;
  const supabase = await createClient();

  let clienteIdFinal = cliente_id;

  if (!clienteIdFinal) {
    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('id, arquivado')
      .eq('telefone', telefone)
      .maybeSingle();

    if (clienteExistente) {
      clienteIdFinal = clienteExistente.id;
      await supabase
        .from('clientes')
        .update({ oftalmologista_preferido, ...(clienteExistente.arquivado ? { arquivado: false } : {}) })
        .eq('id', clienteIdFinal);
    } else {
      const { data: novoCliente, error: erroCliente } = await supabase
        .from('clientes')
        .insert({ nome, telefone, email: email || null, oftalmologista_preferido })
        .select('id')
        .single();

      if (erroCliente || !novoCliente) {
        return NextResponse.json({ erro: 'Falha ao criar cliente', detalhes: erroCliente?.message }, { status: 500 });
      }
      clienteIdFinal = novoCliente.id;
    }
  }

  const { data: transacao, error: erroTransacao } = await supabase
    .from('transacoes')
    .insert({
      cliente_id: clienteIdFinal,
      valor_compra,
      data_compra: new Date().toISOString(),
      // data_validade_bonus é preenchida pelo trigger fn_criar_agendamento_preventivo
      data_validade_bonus: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (erroTransacao || !transacao) {
    return NextResponse.json({ erro: 'Falha ao registrar venda', detalhes: erroTransacao?.message }, { status: 500 });
  }

  try {
    await sendWhatsAppMessage(telefone, montarMensagemBonus(nome, formatarMoeda(transacao.valor_bonus)));
  } catch (err) {
    console.error('[api/vendas] falha ao notificar cliente:', err);
  }

  return NextResponse.json({ transacao, cliente_id: clienteIdFinal }, { status: 201 });
}
