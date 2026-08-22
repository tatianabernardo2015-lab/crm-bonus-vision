import Link from 'next/link';
import { Eye, ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Política de Privacidade' };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium text-ivory">{titulo}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sapphire-soft">
            <Eye size={16} className="text-sapphire" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ivory">Bonus Vision</p>
            <p className="text-[11px] text-muted">Política de Privacidade</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white/[0.02] p-6">
          <p className="mb-6 text-xs text-muted">
            Este documento é um modelo de referência e não substitui orientação jurídica. Antes de publicar,
            revise com um advogado ou DPO os pontos específicos do seu negócio (base legal exata para cada
            tratamento, prazos de retenção definidos pelo seu setor, contratos com os fornecedores citados
            abaixo, etc.).
          </p>

          <Secao titulo="1. Quem trata os dados">
            <p>
              Esta aplicação (CRM Bonus Vision) é operada pela loja/clínica que a contratou, que atua como
              controladora dos dados de seus próprios clientes/pacientes, nos termos da Lei Geral de Proteção
              de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </Secao>

          <Secao titulo="2. Quais dados são coletados">
            <p>Sobre os clientes/pacientes da loja: nome, telefone (WhatsApp), e-mail (opcional), nome do oftalmologista de preferência, histórico de compras e valores de cashback gerados/resgatados.</p>
            <p>Sobre o usuário do sistema (o lojista): e-mail e senha de acesso, usados exclusivamente para autenticação.</p>
          </Secao>

          <Secao titulo="3. Finalidade e base legal">
            <p>
              Os dados de clientes são tratados para viabilizar o programa de cashback, o envio de lembretes
              de retorno para exames preventivos e a comunicação via WhatsApp/e-mail sobre essas duas coisas —
              com base no legítimo interesse do controlador (art. 7º, IX da LGPD) e, quando aplicável, no
              consentimento do titular para o recebimento de mensagens.
            </p>
          </Secao>

          <Secao titulo="4. Compartilhamento com terceiros">
            <p>Os dados podem ser processados pelos seguintes operadores, estritamente para viabilizar o serviço:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Supabase (armazenamento do banco de dados e autenticação)</li>
              <li>Twilio (envio de mensagens de WhatsApp)</li>
              <li>SendGrid (envio de e-mails transacionais)</li>
              <li>Vercel (hospedagem da aplicação)</li>
            </ul>
            <p>Nenhum dado é vendido ou compartilhado para fins publicitários de terceiros.</p>
          </Secao>

          <Secao titulo="5. Retenção e exclusão">
            <p>
              Clientes podem ser <strong className="text-ivory">arquivados</strong> pela loja quando não há
              mais relacionamento ativo — isso os remove das listas e comunicações, mas preserva o histórico
              para fins de auditoria financeira. A exclusão definitiva de dados pessoais pode ser solicitada
              diretamente à loja/clínica que você é cliente, que deve atendê-la conforme os prazos legais de
              guarda contábil e fiscal aplicáveis ao seu setor.
            </p>
          </Secao>

          <Secao titulo="6. Direitos do titular">
            <p>
              Nos termos do art. 18 da LGPD, o titular dos dados pode solicitar à loja/clínica: confirmação da
              existência de tratamento, acesso aos dados, correção de dados incompletos ou desatualizados,
              anonimização ou eliminação de dados desnecessários, e revogação do consentimento a qualquer
              momento.
            </p>
          </Secao>

          <Secao titulo="7. Segurança">
            <p>
              O acesso aos dados é protegido por autenticação e por políticas de segurança em nível de linha
              (Row Level Security) no banco de dados, que garantem que cada loja só acesse os próprios
              registros. A comunicação com o servidor é sempre criptografada (HTTPS).
            </p>
          </Secao>

          <Secao titulo="8. Contato">
            <p>
              Para exercer os direitos listados acima ou tirar dúvidas sobre o tratamento dos seus dados,
              entre em contato diretamente com a loja/clínica onde você é cliente.
            </p>
          </Secao>
        </div>

        <Link
          href="/login"
          className="mt-6 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ivory"
        >
          <ArrowLeft size={13} />
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
