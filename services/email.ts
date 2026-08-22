const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

export async function sendTransactionalEmail(destinatario: string, assunto: string, html: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn('[email] SendGrid não configurado — e-mail simulado:', { destinatario, assunto });
    return { simulado: true };
  }

  const resposta = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: destinatario }] }],
      from: { email: from, name: 'CRM Bonus Vision' },
      subject: assunto,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar e-mail: ${resposta.status} ${await resposta.text()}`);
  }

  return { simulado: false };
}
