'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarMoeda } from '@/lib/utils';
import type { NovaVendaInput } from '@/types';

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

export function CadastroModal({
  open,
  onClose,
  onSalvar,
}: {
  open: boolean;
  onClose: () => void;
  onSalvar: (venda: NovaVendaInput) => Promise<void> | void;
}) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [valorCompra, setValorCompra] = useState('');
  const [oftalmologista, setOftalmologista] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!open) return null;

  const valorNumerico = parseFloat(valorCompra) || 0;
  const bonusPreview = valorNumerico * 0.2;

  const limpar = () => {
    setNome('');
    setTelefone('');
    setValorCompra('');
    setOftalmologista('');
  };

  const submit = async () => {
    if (!nome || !telefone || !valorCompra || !oftalmologista) return;
    setEnviando(true);
    try {
      await onSalvar({
        nome,
        telefone,
        oftalmologista_preferido: oftalmologista,
        valor_compra: valorNumerico,
      });
      limpar();
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
                <Sparkles size={16} className="text-sapphire" />
                <h3 className="text-base font-medium text-ivory">Nova venda</h3>
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
                  placeholder="Ex: Camila Rangel"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="WhatsApp" required>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(21) 99999-0000"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="Valor da compra" required>
                <input
                  value={valorCompra}
                  onChange={(e) => setValorCompra(e.target.value)}
                  placeholder="0,00"
                  type="number"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>
              <Field label="Oftalmologista de preferência" required>
                <input
                  value={oftalmologista}
                  onChange={(e) => setOftalmologista(e.target.value)}
                  placeholder="Ex: Dra. Fernanda Reis"
                  className="w-full bg-transparent text-sm text-ivory outline-none"
                />
              </Field>

              {bonusPreview > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-sapphire-soft px-3 py-2.5 text-xs text-[#93B4FA]">
                  <span>Bônus gerado (20%) · válido por 60 dias</span>
                  <span className="font-semibold">{formatarMoeda(bonusPreview)}</span>
                </div>
              )}
            </div>

            <button
              onClick={submit}
              disabled={enviando}
              className="mt-6 w-full rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
            >
              {enviando ? 'Salvando…' : 'Confirmar venda e gerar bônus'}
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
