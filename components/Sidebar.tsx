'use client';

import { Eye, LayoutDashboard, Users, Clock, Wallet, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassPanel } from './GlassPanel';
import { sair } from '@/app/login/actions';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes & Vendas', icon: Users },
  { id: 'fila', label: 'Fila de Retornos', icon: Clock },
  { id: 'bonus', label: 'Bônus', icon: Wallet },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]['id'];

export function Sidebar({
  active,
  onChange,
  emailUsuario,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
  emailUsuario?: string;
}) {
  return (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r border-line bg-bg-elevated px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sapphire-soft">
          <Eye size={16} className="text-sapphire" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ivory">Bonus Vision</p>
          <p className="text-[10px] text-muted">CRM · Saúde Visual</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive ? 'bg-sapphire-soft text-[#93B4FA]' : 'text-muted hover:text-ivory'
              )}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <GlassPanel className="mb-3 p-3">
        <p className="text-[11px] leading-relaxed text-muted">
          Sincronização automática ativa. Toda alteração é persistida em tempo real via Supabase Realtime.
        </p>
      </GlassPanel>

      {emailUsuario && (
        <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
          <span className="truncate text-[11px] text-muted">{emailUsuario}</span>
          <form action={sair}>
            <button
              type="submit"
              className="flex-shrink-0 text-muted transition-colors hover:text-ivory"
              title="Sair"
            >
              <LogOut size={13} />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

export { NAV_ITEMS };
