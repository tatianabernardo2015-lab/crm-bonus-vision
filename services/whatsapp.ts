import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendWhatsAppMessage(telefone: string, mensagem: string) {
  if (!client || !from) {
    console.warn('[whatsapp] Twilio não configurado — mensagem simulada:', { telefone, mensagem });
    return { simulado: true };
  }

  const numeroFormatado = telefone.startsWith('whatsapp:') ? telefone : `whatsapp:+55${telefone.replace(/\D/g, '')}`;

  return client.messages.create({
    from,
    to: numeroFormatado,
    body: mensagem,
  });
}

export function montarMensagemBonus(nome: string, valorBonus: string): string {
  return `Olá, ${nome}! 🎉 Sua compra gerou ${valorBonus} em bônus, válido por 60 dias. Use no seu próximo par de óculos ou lentes!`;
}

export function montarMensagemRetornoPreventivo(nome: string, medico: string, linkAgendamento = '[LINK]'): string {
  return `Olá, ${nome}! Faz 1 ano desde a sua última avaliação visual com a gente. Que tal renovar seu exame preventivo com o(a) Dr(a). ${medico}? Toque para agendar em 1 clique: ${linkAgendamento}`;
}
