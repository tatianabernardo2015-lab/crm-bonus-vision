export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sapphire-soft border-t-sapphire" />
        <p className="text-xs text-muted">Carregando…</p>
      </div>
    </div>
  );
}
