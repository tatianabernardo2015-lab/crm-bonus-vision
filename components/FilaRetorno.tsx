'use client';

import { useMemo } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarData, statusGatilho, cn } from '@/lib/utils';
import type { AgendamentoPreventivo } from '@/types';

const ROTULOS: Record<string, { texto: string; className: string }> = {
  agendado: { texto: 'Agendado', className: 'bg-sapphire-soft text-sapphire' },
  iminente: { texto: 'Iminente', className: 'bg-amber/15 text-amber' },
  disparado: { texto: 'Disparado', className: 'bg-emerald/15 text-emerald' },
};

export function FilaRetorno({ agendamentos }: { agendamentos: AgendamentoPreventivo[] }) {
  const ordenados = useMemo(() => {
    return [...agendamentos].sort((a, b) => {
      const ga = statusGatilho(a.data_programada).diasRestantes;
      const gb = statusGatilho(b.data_programada).diasRestantes;
      return ga - gb;
    });
  }, [agendamentos]);

  return (
    <GlassPanel className="col-span-2 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={14} className="text-sapphire" />
        <h2 className="text-sm font-medium text-ivory">Fila de retornos de 1 ano</h2>
      </div>

      <div className="space-y-2.5">
        {ordenados.map((a) => {
          const gatilho = statusGatilho(a.data_programada);
          const rotulo = ROTULOS[gatilho.status];
          const cliente = a.cliente;

          return (
            <div key={a.id} className="rounded-xl border border-line bg-white/[0.015] px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-ivory">{cliente?.nome ?? 'Cliente'}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', rotulo.className)}>
                  {rotulo.texto}
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Dr(a). {a.medico_selecionado ?? cliente?.oftalmologista_preferido}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted">
                  Retorno em {formatarData(a.data_programada)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted">
                  {gatilho.diasRestantes > 0 ? `${gatilho.diasRestantes}d restantes` : 'Contatar agora'}
                  <ChevronRight size={10} />
                </span>
              </div>
            </div>
          );
        })}

        {ordenados.length === 0 && (
          <p className="py-8 text-center text-xs text-muted">Nenhum retorno agendado.</p>
        )}
      </div>
    </GlassPanel>
  );
}
