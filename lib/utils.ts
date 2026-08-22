export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function diasDesde(data: string | Date): number {
  const d = typeof data === 'string' ? new Date(data) : data;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export type StatusGatilho = 'agendado' | 'iminente' | 'disparado';

export function statusGatilho(dataProgramada: string | Date): {
  status: StatusGatilho;
  diasRestantes: number;
} {
  const alvo = typeof dataProgramada === 'string' ? new Date(dataProgramada) : dataProgramada;
  const diasRestantes = Math.ceil((alvo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) return { status: 'disparado', diasRestantes: 0 };
  if (diasRestantes <= 30) return { status: 'iminente', diasRestantes };
  return { status: 'agendado', diasRestantes };
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function escaparCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? '');
  if (/[",\n;]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}
