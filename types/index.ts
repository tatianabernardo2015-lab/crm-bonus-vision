export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  oftalmologista_preferido: string;
  arquivado: boolean;
  criado_em: string;
}

export type StatusBonus = 'disponivel' | 'utilizado' | 'expirado';

export interface Transacao {
  id: string;
  cliente_id: string;
  valor_compra: number;
  percentual_bonus: number;
  valor_bonus: number;
  status_bonus: StatusBonus;
  cancelada: boolean;
  data_compra: string;
  data_validade_bonus: string;
  sequencia_externa?: string | null;
}

export type StatusAgendamento = 'pendente' | 'notificado' | 'agendado' | 'cancelado';

export interface AgendamentoPreventivo {
  id: string;
  cliente_id: string;
  transacao_id: string | null;
  data_programada: string;
  status: StatusAgendamento;
  medico_selecionado: string | null;
  cliente?: Cliente;
}

export interface MetricasDashboard {
  bonus_gerado: number;
  bonus_resgatado: number;
  bonus_disponivel: number;
  clientes_ativos: number;
  taxa_retorno_percentual: number | null;
}

export interface NovaVendaInput {
  nome: string;
  telefone: string;
  email?: string;
  oftalmologista_preferido: string;
  valor_compra: number;
}

export interface ConfiguracaoLoja {
  usuario_id: string;
  nome_loja: string | null;
  percentual_bonus: number;
  dias_validade_bonus: number;
  dias_gatilho_retorno: number;
}