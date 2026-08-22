import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; mensagem?: string }>;
}) {
  const { erro, mensagem } = await searchParams;
  return <LoginForm erro={erro} mensagem={mensagem} />;
}
