import { cn } from '@/lib/utils';

export function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-white/[0.025] backdrop-blur-md',
        className
      )}
    >
      {children}
    </div>
  );
}
