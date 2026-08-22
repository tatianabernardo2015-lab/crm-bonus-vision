import { ResetSenhaForm } from './ResetSenhaForm';

export default async function ResetSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return <ResetSenhaForm erro={erro} />;
}
