'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Phone, Stethoscope, ChevronDown, Mail, Pencil, Archive, ArchiveRestore, Loader2, Download } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { formatarData, formatarMoeda, cn } from '@/lib/utils';
import type { Cliente, Transacao } from '@/types';

function LinhaCliente({
  cliente,
  onEditar,
  onArquivar,
}: {
  cliente: Cliente;
  onEditar: (cliente: Cliente) => void;
  onArquivar: (cliente: Cliente) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState<Transacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  const totalGasto = useMemo(
    () => (historico ?? []).reduce((acc, t) => acc + t.valor_compra, 0),
    [historico]
  );

  const alternarExpansao = async () => {
    const proximoAberto = !aberto;
    setAberto(proximoAberto);

    if (proximoAberto && historico === null) {
      setCarregando(true);
      try {
        const resposta = await fetch(`/api/transacoes?clienteId=${cliente.id}`);
        const dados = await resposta.json();
        setHistorico(dados.transacoes ?? []);
      } catch {
        setHistorico([]);
      } finally {
        setCarregando(false);
      }
    }
  };

  return (
    <div className={cn('rounded-xl border border-line', cliente.arquivado && 'opacity-60')}>
      <button
        onClick={alternarExpansao}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium text-ivory">
            {cliente.nome}
            {cliente.arquivado && (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-muted">
                Arquivado
              </span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Phone size={10} /> {cliente.telefone}
            </span>
            {cliente.email && (
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Mail size={10} /> {cliente.email}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Stethoscope size={10} /> {cliente.oftalmologista_preferido}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 pl-3">
          {aberto && historico !== null && (
            <div className="text-right">
              <p className="text-sm font-medium text-ivory">{formatarMoeda(totalGasto)}</p>
              <p className="text-[11px] text-muted">
                {historico.length} compra{historico.length === 1 ? '' : 's'}
              </p>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditar(cliente);
            }}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.05] hover:text-ivory"
            title="Editar cliente"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArquivar(cliente);
            }}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.05] hover:text-ivory"
            title={cliente.arquivado ? 'Reativar cliente' : 'Arquivar cliente'}
          >
            {cliente.arquivado ? <ArchiveRestore size={13} /> : <Archive size={13} />}
          </button>
          <ChevronDown size={15} className={cn('text-muted transition-transform', aberto && 'rotate-180')} />
        </div>
      </button>

      {aberto && (
        <div className="space-y-1.5 border-t border-line px-4 py-3">
          {carregando && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" /> Carregando histórico…
            </div>
          )}
          {!carregando && historico?.length === 0 && (
            <p className="text-xs text-muted">Nenhuma compra registrada ainda.</p>
          )}
          {!carregando &&
            historico?.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                <span className="text-xs text-muted">{formatarData(t.data_compra)}</span>
                <span className="text-xs text-ivory">{formatarMoeda(t.valor_compra)}</span>
                <span className="text-xs text-sapphire">+{formatarMoeda(t.valor_bonus)} bônus</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    t.status_bonus === 'disponivel' && 'bg-sapphire-soft text-sapphire',
                    t.status_bonus === 'utilizado' && 'bg-emerald/15 text-emerald',
                    t.status_bonus === 'expirado' && 'bg-red-500/15 text-red-300'
                  )}
                >
                  {t.status_bonus}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function ClientesView({
  clientesIniciais,
  totalInicial,
  temMaisInicial,
  onEditar,
  onArquivar,
}: {
  clientesIniciais: Cliente[];
  totalInicial: number;
  temMaisInicial: boolean;
  onEditar: (cliente: Cliente) => void;
  onArquivar: (cliente: Cliente, arquivado: boolean) => Promise<void> | void;
}) {
  const [busca, setBusca] = useState('');
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  const [clientes, setClientes] = useState(clientesIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraRenderizacao = useRef(true);

  const buscar = async (termo: string, arquivados: boolean) => {
    setBuscando(true);
    try {
      const params = new URLSearchParams();
      if (termo) params.set('q', termo);
      if (arquivados) params.set('incluirArquivados', 'true');
      const resposta = await fetch(`/api/clientes?${params.toString()}`);
      const dados = await resposta.json();
      setClientes(dados.clientes ?? []);
      setTotal(dados.total ?? 0);
      setTemMais(dados.temMais ?? false);
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(busca, incluirArquivados), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca, incluirArquivados]);

  const carregarMais = async () => {
    setCarregandoMais(true);
    try {
      const params = new URLSearchParams({ offset: String(clientes.length) });
      if (busca) params.set('q', busca);
      if (incluirArquivados) params.set('incluirArquivados', 'true');
      const resposta = await fetch(`/api/clientes?${params.toString()}`);
      const dados = await resposta.json();
      setClientes((prev) => [...prev, ...(dados.clientes ?? [])]);
      setTemMais(dados.temMais ?? false);
    } finally {
      setCarregandoMais(false);
    }
  };

  const handleArquivar = async (cliente: Cliente) => {
    await onArquivar(cliente, !cliente.arquivado);
    setClientes((prev) =>
      incluirArquivados
        ? prev.map((c) => (c.id === cliente.id ? { ...c, arquivado: !cliente.arquivado } : c))
        : prev.filter((c) => c.id !== cliente.id)
    );
  };

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ivory">
          Clientes cadastrados <span className="text-muted">({total})</span>
        </h2>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- download de arquivo, não navegação */}
          <a
            href="/api/clientes/export"
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-ivory"
          >
            <Download size={12} />
            Exportar CSV
          </a>
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={incluirArquivados}
              onChange={(e) => setIncluirArquivados(e.target.checked)}
              className="accent-sapphire"
            />
            Mostrar arquivados
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5">
            <Search size={13} className="text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, médico ou telefone…"
              className="w-48 bg-transparent text-xs text-ivory outline-none"
            />
            {buscando && <Loader2 size={12} className="animate-spin text-muted" />}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {clientes.map((c) => (
          <LinhaCliente key={c.id} cliente={c} onEditar={onEditar} onArquivar={handleArquivar} />
        ))}

        {clientes.length === 0 && !buscando && (
          <p className="py-8 text-center text-xs text-muted">Nenhum cliente encontrado.</p>
        )}
      </div>

      {temMais && (
        <button
          onClick={carregarMais}
          disabled={carregandoMais}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium text-muted transition-colors hover:text-ivory disabled:opacity-60"
        >
          {carregandoMais ? <Loader2 size={13} className="animate-spin" /> : null}
          {carregandoMais ? 'Carregando…' : 'Carregar mais clientes'}
        </button>
      )}
    </GlassPanel>
  );
}
