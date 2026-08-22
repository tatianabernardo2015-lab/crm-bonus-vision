'use client';

import { CloudUpload, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncState = 'saving' | 'saved';

export function SyncIndicator({ state }: { state: SyncState }) {
  const isSaving = state === 'saving';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-500',
        isSaving
          ? 'border-sapphire/30 bg-sapphire-soft text-[#93B4FA]'
          : 'border-emerald/25 bg-emerald/10 text-[#6EE7B7]'
      )}
    >
      {isSaving ? (
        <>
          <CloudUpload size={14} className="animate-pulse" />
          <span>Salvando na nuvem…</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={14} />
          <span>Alterações salvas com sucesso</span>
        </>
      )}
    </div>
  );
}
