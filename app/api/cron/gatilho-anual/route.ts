import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage, montarMensagemRetornoPreventivo } from '@/services/whatsapp';

// Endpoint chamado diariamente por um agendador externo (Qstash, Vercel Cron
// ou Google Cloud Tasks). Busca todos os agendamentos preventivos cuja
// data_programada é hoje e ainda estão pendentes, dispara a notificação
// e atualiza o status em tempo real na nuvem.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const hoje = new Date().toISOString().split('T')[0];

  const { data: agendamentos, error } = await supabase
    .from('agendamentos_preventivos')
    .select('*, clientes ( nome, telefone, oftalmologista_preferido )')
    .eq('data_programada', hoje)
    .eq('status', 'pendente');

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const resultados = [];

  for (const agendamento of agendamentos ?? []) {
    const cliente = agendamento.clientes;
    if (!cliente) continue;

    try {
      await sendWhatsAppMessage(
        cliente.telefone,
        montarMensagemRetornoPreventivo(
          cliente.nome,
          agendamento.medico_selecionado ?? cliente.oftalmologista_preferido
        )
      );

      await supabase
        .from('agendamentos_preventivos')
        .update({ status: 'notificado', atualizado_em: new Date().toISOString() })
        .eq('id', agendamento.id);

      resultados.push({ cliente_id: cliente.id, status: 'notificado' });
    } catch (err) {
      resultados.push({ cliente_id: cliente.id, status: 'erro', detalhe: String(err) });
    }
  }

  return NextResponse.json({ processados: resultados.length, resultados });
}
