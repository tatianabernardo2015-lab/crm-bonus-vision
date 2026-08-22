'use client';

import { useMemo, useState } from 'react';
import { Search, Phone, Stethoscope } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarMoeda } from '@/lib/utils';
import type { Cliente, Transacao } from '@/types';

interface LinhaCliente extends Cliente {
  ultimaTransacao?: Transacao;
}

export function ClientesList({ clientes }: { clientes: LinhaCliente[] }) {
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(
    () => clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())),
    [clientes, busca]
  );

  return (
    <GlassPanel className="col-span-3 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ivory">Clientes cadastrados</h2>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5">
          <Search size={13} className="text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-32 bg-transparent text-xs text-ivory outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtrados.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-line px-4 py-3 transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ivory">{c.nome}</p>
              <div className="mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Phone size={10} /> {c.telefone}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Stethoscope size={10} /> {c.oftalmologista_preferido}
                </span>
              </div>
            </div>
            {c.ultimaTransacao && (
              <div className="flex-shrink-0 pl-3 text-right">
                <p className="text-sm font-medium text-ivory">
                  {formatarMoeda(c.ultimaTransacao.valor_compra)}
                </p>
                <p className="text-[11px] text-sapphire">
                  +{formatarMoeda(c.ultimaTransacao.valor_bonus)} bônus
                </p>
              </div>
            )}
          </div>
        ))}

        {filtrados.length === 0 && (
          <p className="py-8 text-center text-xs text-muted">Nenhum cliente encontrado.</p>
        )}
      </div>
    </GlassPanel>
  );
}
