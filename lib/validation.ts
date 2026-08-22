import { z } from 'zod';

export const vendaSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  oftalmologista_preferido: z.string().min(2),
  valor_compra: z.number().positive(),
  cliente_id: z.string().uuid().optional(),
});

export const clienteEditarSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  oftalmologista_preferido: z.string().min(2),
});

export const clienteArquivarSchema = z.object({
  arquivado: z.boolean(),
});

export const transacaoStatusSchema = z.object({
  status_bonus: z.enum(['disponivel', 'utilizado', 'expirado']),
});

export const transacaoCancelarSchema = z.object({
  cancelada: z.boolean(),
});

export const agendamentoStatusSchema = z.object({
  status: z.enum(['pendente', 'notificado', 'agendado', 'cancelado']),
});

export const configuracoesSchema = z.object({
  nome_loja: z.string().min(1).optional(),
  percentual_bonus: z.number().positive().max(100),
  dias_validade_bonus: z.number().int().positive(),
  dias_gatilho_retorno: z.number().int().positive(),
});
