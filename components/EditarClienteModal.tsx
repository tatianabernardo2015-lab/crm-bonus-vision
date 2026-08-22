'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import type { Cliente } from '@/types';

type DadosCliente = { nome: string; telefone: string; email?: string; oftalmologista_preferido: string };

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">
        {label}
        {required && <span className="text-sapphire"> *</span>}
      </span>
      <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">{children}</div>
    </label>
  );
}

function FormularioEdicao({
  cliente,
  onClose,
  onSalvar,
}: {
  cliente: Cliente;
  onClose: () => void;
  onSalvar: (id: string, dados: DadosCliente) => Promise<void> | void;
}) {
  const [nome, setNome] = useState(cliente.nome);
  const [telefone, setTelefone] = useState(cliente.telefone);
  const [email, setEmail] = useState(cliente.email ?? '');
  const [oftalmologista, setOftalmologista] = useState(cliente.oftalmologista_preferido);
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    if (!nome || !telefone || !oftalmologista) return;
    setEnviando(true);
    try {
      await onSalvar(cliente.id, { nome, telefone, email, oftalmologista_preferido: oftalmologista });
      onClose();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <GlassPanel className="bg-[#0E1424]">
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-sapphire" />
                <h3 className="text-base font-medium text-ivory">Editar cliente</h3>
              </div>
              <button onClick={onClose} className="opacity-60 transition-opacity hover:opacity-100">
                <X size={18} className="text-ivory" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Nome do cliente" required>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="WhatsApp" required>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="E-mail (opcional)">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="Oftalmologista de preferência" required>
                <input
                  value={oftalmologista}
                  onChange={(e) => setOftalmologista(e.target.value)}
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
            </div>

            <button
              onClick={submit}
              disabled={enviando}
              className="mt-6 w-full rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
            >
              {enviando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

export function EditarClienteModal({
  cliente,
  onClose,
  onSalvar,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onSalvar: (id: string, dados: DadosCliente) => Promise<void> | void;
}) {
  if (!cliente) return null;

  // key={cliente.id} força o React a remontar o formulário (e reinicializar
  // o estado) sempre que um cliente diferente é aberto para edição — sem
  // precisar sincronizar via useEffect.
  return <FormularioEdicao key={cliente.id} cliente={cliente} onClose={onClose} onSalvar={onSalvar} />;
}
