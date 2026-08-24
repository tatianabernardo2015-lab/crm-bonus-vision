'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

// -------------------------- Deteccao de colunas --------------------------

type CampoAlvo =
  | 'nome'
  | 'telefone'
  | 'email'
  | 'oftalmologista_preferido'
  | 'oftalmologista_telefone'
  | 'valor_compra'
  | 'data_compra';

const CAMPOS: { id: CampoAlvo; label: string; obrigatorio: boolean; sinonimos: string[] }[] = [
  { id: 'nome', label: 'Nome do cliente', obrigatorio: false, sinonimos: ['nome', 'cliente', 'nome do cliente', 'nome cliente', 'paciente'] },
  { id: 'telefone', label: 'WhatsApp / telefone', obrigatorio: false, sinonimos: ['telefone', 'whatsapp', 'celular', 'fone', 'contato', 'tel'] },
  { id: 'oftalmologista_preferido', label: 'Oftalmologista', obrigatorio: false, sinonimos: ['oftalmologista', 'medico', 'médico', 'doutor', 'dr', 'oftalmologista preferido', 'profissional'] },
  { id: 'oftalmologista_telefone', label: 'Telefone do oftalmologista', obrigatorio: false, sinonimos: ['telefone oftalmologista', 'telefone medico', 'celular medico', 'whatsapp medico', 'contato medico', 'fone medico'] },
  { id: 'valor_compra', label: 'Valor da compra', obrigatorio: false, sinonimos: ['valor', 'valor da compra', 'total', 'valor compra', 'preco', 'preço', 'valor total'] },
  { id: 'email', label: 'E-mail (opcional)', obrigatorio: false, sinonimos: ['email', 'e-mail'] },
  { id: 'data_compra', label: 'Data da compra (opcional)', obrigatorio: false, sinonimos: ['data', 'data da compra', 'data compra', 'dt compra'] },
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectarMapeamento(headers: string[]): Record<CampoAlvo, string | null> {
  const normalizados = headers.map((h) => ({ original: h, norm: normalizar(h) }));
  const mapa = {} as Record<CampoAlvo, string | null>;

  for (const campo of CAMPOS) {
    const encontrado = normalizados.find((h) => campo.sinonimos.includes(h.norm));
    mapa[campo.id] = encontrado?.original ?? null;
  }
  return mapa;
}

function parseValor(bruto: string): number | undefined {
  if (!bruto) return undefined;
  const limpo = bruto
    .replace(/[Rr]\$/g, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) || numero <= 0 ? undefined : numero;
}

function parseData(bruto: string): string | undefined {
  if (!bruto) return undefined;
  const ddmmyyyy = bruto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
  }
  const data = new Date(bruto);
  return isNaN(data.getTime()) ? undefined : data.toISOString();
}

// ------------------------------- Componente -------------------------------

interface ResultadoImportacao {
  total: number;
  sucesso: number;
  erros: { linha: number; nome: string; mensagem?: string }[];
}

export function ImportarVendasModal({
  onClose,
  onImportado,
}: {
  onClose: () => void;
  onImportado: () => void;
}) {
  const [etapa, setEtapa] = useState<'upload' | 'conferir' | 'enviando' | 'resultado'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<CampoAlvo, string | null>>({} as Record<CampoAlvo, string | null>);
  const [erroArquivo, setErroArquivo] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processarArquivo = async (arquivo: File) => {
    setErroArquivo('');
    const extensao = arquivo.name.split('.').pop()?.toLowerCase();

    try {
      let cabecalhos: string[] = [];
      let dados: Record<string, string>[] = [];

      if (extensao === 'csv') {
        const Papa = (await import('papaparse')).default;
        const texto = await arquivo.text();
        const resultado = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: true });
        dados = resultado.data;
        cabecalhos = resultado.meta.fields ?? [];
      } else {
        setErroArquivo(
          'Por enquanto so aceito arquivos .csv. Se o seu arquivo e .xlsx ou .xls, abra ele no Excel e use "Arquivo -> Salvar como -> CSV (separado por virgulas)", depois envie o CSV gerado.'
        );
        return;
      }

      if (dados.length === 0) {
        setErroArquivo('O arquivo nao tem nenhuma linha de dados.');
        return;
      }

      setHeaders(cabecalhos);
      setLinhas(dados);
      setMapeamento(detectarMapeamento(cabecalhos));
      setEtapa('conferir');
    } catch {
      setErroArquivo('Nao consegui ler esse arquivo. Confira se ele nao esta corrompido ou aberto em outro programa.');
    }
  };

  const camposFaltando = CAMPOS.filter((c) => c.obrigatorio && !mapeamento[c.id]);

  const confirmarImportacao = async () => {
    setEtapa('enviando');

    const linhasFormatadas = linhas
      .map((linha) => ({
        nome: mapeamento.nome ? String(linha[mapeamento.nome] ?? '').trim() : '',
        telefone: mapeamento.telefone ? String(linha[mapeamento.telefone] ?? '').replace(/\D/g, '') : '',
        email: mapeamento.email ? String(linha[mapeamento.email] ?? '').trim() : '',
        oftalmologista_preferido: mapeamento.oftalmologista_preferido
          ? String(linha[mapeamento.oftalmologista_preferido] ?? '').trim()
          : '',
        oftalmologista_telefone: mapeamento.oftalmologista_telefone
          ? String(linha[mapeamento.oftalmologista_telefone] ?? '').replace(/\D/g, '')
          : '',
        valor_compra: mapeamento.valor_compra ? parseValor(String(linha[mapeamento.valor_compra] ?? '')) : undefined,
        data_compra: mapeamento.data_compra ? parseData(String(linha[mapeamento.data_compra] ?? '')) : undefined,
      }))
      .filter(
        (l) =>
          l.nome ||
          l.telefone ||
          l.email ||
          l.oftalmologista_preferido ||
          l.oftalmologista_telefone ||
          l.valor_compra
      );

    try {
      const resposta = await fetch('/api/vendas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas: linhasFormatadas }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErroArquivo(dados.erro || 'Falha ao importar. Confira os valores e tente novamente.');
        setEtapa('conferir');
        return;
      }

      setResultado(dados);
      setEtapa('resultado');
      onImportado();
    } catch {
      setErroArquivo('Falha de conexao ao enviar os dados. Tente novamente.');
      setEtapa('conferir');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,6,12,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={etapa === 'enviando' ? undefined : onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <GlassPanel className="bg-[#0E1424]">
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-sapphire" />
                <h3 className="text-base font-medium text-ivory">Importar vendas (CSV)</h3>
              </div>
              {etapa !== 'enviando' && (
                <button onClick={onClose} className="opacity-60 transition-opacity hover:opacity-100">
                  <X size={18} className="text-ivory" />
                </button>
              )}
            </div>

            {etapa === 'upload' && (
              <div>
                <p className="mb-4 text-xs text-muted">
                  Exporte a lista de vendas do Shop9 em CSV e envie aqui. O sistema tenta identificar as colunas
                  automaticamente - voce confirma tudo antes de qualquer coisa ser salva. Se seu arquivo for
                  Excel (.xlsx), abra no Excel e salve como CSV primeiro.
                </p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-10 transition-colors hover:border-sapphire/40"
                >
                  <Upload size={22} className="text-muted" />
                  <span className="text-sm text-ivory">Clique para escolher o arquivo</span>
                  <span className="text-[11px] text-muted">.csv</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])}
                />
                {erroArquivo && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <AlertTriangle size={13} /> {erroArquivo}
                  </div>
                )}
              </div>
            )}

            {etapa === 'conferir' && (
              <div>
                <p className="mb-3 text-xs text-muted">
                  {linhas.length} linha{linhas.length === 1 ? '' : 's'} encontrada{linhas.length === 1 ? '' : 's'}.
                  Confira se cada campo esta mapeado para a coluna certa do seu arquivo. Nenhum campo e obrigatorio
                  - o que ficar em branco pode ser preenchido manualmente depois.
                </p>

                <div className="mb-4 space-y-2">
                  {CAMPOS.map((campo) => (
                    <div key={campo.id} className="flex items-center gap-3">
                      <span className="w-44 flex-shrink-0 text-xs text-ivory">
                        {campo.label}
                        {campo.obrigatorio && <span className="text-sapphire"> *</span>}
                      </span>
                      <select
                        value={mapeamento[campo.id] ?? ''}
                        onChange={(e) =>
                          setMapeamento((prev) => ({ ...prev, [campo.id]: e.target.value || null }))
                        }
                        className="flex-1 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-xs text-ivory outline-none"
                      >
                        <option value="" style={{ color: '#000' }}>
                          - nenhuma -
                        </option>
                        {headers.map((h) => (
                          <option key={h} value={h} style={{ color: '#000' }}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {camposFaltando.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
                    <AlertTriangle size={13} />
                    Falta mapear: {camposFaltando.map((c) => c.label).join(', ')}
                  </div>
                )}

                <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0E1424]">
                      <tr className="text-muted">
                        {CAMPOS.filter((c) => mapeamento[c.id]).map((c) => (
                          <th key={c.id} className="px-2 py-1.5 font-normal">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.slice(0, 5).map((linha, i) => (
                        <tr key={i} className="border-t border-line text-ivory">
                          {CAMPOS.filter((c) => mapeamento[c.id]).map((c) => (
                            <td key={c.id} className="truncate px-2 py-1.5">
                              {String(linha[mapeamento[c.id]!] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {linhas.length > 5 && (
                    <p className="px-2 py-1.5 text-[10px] text-muted">
                      + {linhas.length - 5} linha{linhas.length - 5 === 1 ? '' : 's'} nao mostrada
                      {linhas.length - 5 === 1 ? '' : 's'} aqui (mas serao todas importadas)
                    </p>
                  )}
                </div>

                {erroArquivo && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <AlertTriangle size={13} /> {erroArquivo}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setEtapa('upload')}
                    className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:text-ivory"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={confirmarImportacao}
                    disabled={camposFaltando.length > 0}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    Importar {linhas.length} venda{linhas.length === 1 ? '' : 's'} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {etapa === 'enviando' && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 size={24} className="animate-spin text-sapphire" />
                <p className="text-sm text-muted">Importando {linhas.length} vendas, aguarde...</p>
              </div>
            )}

            {etapa === 'resultado' && resultado && (
              <div>
                <div className="mb-4 flex items-center gap-3 rounded-lg bg-emerald/10 px-4 py-3">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <p className="text-sm text-ivory">
                    <strong>{resultado.sucesso}</strong> de <strong>{resultado.total}</strong> vendas importadas com
                    sucesso.
                  </p>
                </div>

                {resultado.erros.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-amber">
                      <AlertTriangle size={13} /> {resultado.erros.length} linha
                      {resultado.erros.length === 1 ? '' : 's'} com problema:
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                      {resultado.erros.map((e, i) => (
                        <p key={i} className="text-[11px] text-muted">
                          Linha {e.linha} ({e.nome || 'sem nome'}): {e.mensagem}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full rounded-lg bg-sapphire py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
                >
                  Concluir
                </button>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}