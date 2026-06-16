/**
 * Centralized Zod validation schemas for all user inputs
 * Provides server-side validation before database operations
 */

import { z } from "zod";

// Common string validation patterns
const trimmedString = z.string().trim();
const nonEmptyString = trimmedString.min(1, "Este campo é obrigatório");

// Priority values allowed in the system
const priorityValues = ["baixa", "média", "alta", "urgente"] as const;

// ==================== DEMAND SCHEMAS ====================

export const DemandCreateSchema = z.object({
  title: nonEmptyString
    .max(500, "Título deve ter no máximo 500 caracteres"),
  description: trimmedString
    .max(50000, "Descrição deve ter no máximo 50000 caracteres")
    .optional()
    .nullable(),
  team_id: z.string().uuid("ID da equipe inválido"),
  board_id: z.string().uuid("ID do quadro inválido"),
  status_id: z.string().uuid("ID do status inválido"),
  priority: z.enum(priorityValues).optional().default("média"),
  assigned_to: z.string().uuid("ID do responsável inválido").optional().nullable(),
  due_date: z.string().optional().nullable(),
  service_id: z.string().uuid("ID do serviço inválido").optional().nullable(),
});

export const DemandUpdateSchema = z.object({
  id: z.string().uuid("ID da demanda inválido"),
  title: nonEmptyString
    .max(500, "Título deve ter no máximo 500 caracteres")
    .optional(),
  description: trimmedString
    .max(50000, "Descrição deve ter no máximo 50000 caracteres")
    .optional()
    .nullable(),
  status_id: z.string().uuid("ID do status inválido").optional(),
  priority: z.enum(priorityValues).optional(),
  assigned_to: z.string().uuid("ID do responsável inválido").optional().nullable(),
  due_date: z.string().optional().nullable(),
  archived: z.boolean().optional(),
  archived_at: z.string().optional().nullable(),
  service_id: z.string().uuid("ID do serviço inválido").optional().nullable(),
  board_id: z.string().uuid("ID do quadro inválido").optional(),
  status_changed_by: z.string().uuid("ID do usuário inválido").optional().nullable(),
  status_changed_at: z.string().optional().nullable(),
});

// ==================== INTERACTION SCHEMAS ====================
// Content limit raised to 50000 to support inline images with storage URLs

export const InteractionCreateSchema = z.object({
  demand_id: z.string().uuid("ID da demanda inválido"),
  interaction_type: nonEmptyString.max(50, "Tipo de interação muito longo"),
  content: trimmedString
    .max(50000, "Conteúdo excede o limite permitido")
    .optional()
    .nullable(),
  metadata: z.any().optional().nullable(),
});

// ==================== TEAM SCHEMAS ====================

export const TeamCreateSchema = z.object({
  name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  description: trimmedString
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional()
    .nullable(),
  accessCode: z.string()
    .regex(/^[A-Z0-9]{6,20}$/, "Código deve ter 6-20 caracteres alfanuméricos")
    .optional(),
});

export const AccessCodeSchema = z.string()
  .min(6, "Código deve ter pelo menos 6 caracteres")
  .max(20, "Código deve ter no máximo 20 caracteres")
  .regex(/^[A-Z0-9]+$/i, "Código deve conter apenas letras e números");

// ==================== SERVICE SCHEMAS ====================

export const ServiceCreateSchema = z.object({
  name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  description: trimmedString
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional()
    .nullable(),
  team_id: z.string().uuid("ID da equipe inválido"),
  estimated_hours: z.number()
    .int("Horas estimadas deve ser um número inteiro")
    .min(1, "Horas estimadas deve ser pelo menos 1")
    .max(8760, "Horas estimadas deve ser no máximo 8760 (1 ano)"),
  price_cents: z.number()
    .int("Preço deve ser um número inteiro")
    .min(0, "Preço não pode ser negativo")
    .default(0),
});

export const ServiceUpdateSchema = z.object({
  id: z.string().uuid("ID do serviço inválido"),
  team_id: z.string().uuid("ID da equipe inválido"),
  name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  description: trimmedString
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional()
    .nullable(),
  estimated_hours: z.number()
    .int("Horas estimadas deve ser um número inteiro")
    .min(1, "Horas estimadas deve ser pelo menos 1")
    .max(8760, "Horas estimadas deve ser no máximo 8760 (1 ano)")
    .optional(),
  price_cents: z.number()
    .int("Preço deve ser um número inteiro")
    .min(0, "Preço não pode ser negativo")
    .optional(),
});

// ==================== SUBTASK SCHEMAS ====================

export const SubtaskCreateSchema = z.object({
  demandId: z.string().uuid("ID da demanda inválido"),
  title: nonEmptyString
    .max(200, "Título deve ter no máximo 200 caracteres"),
});

export const SubtaskUpdateSchema = z.object({
  id: z.string().uuid("ID da subtarefa inválido"),
  completed: z.boolean().optional(),
  title: trimmedString
    .max(200, "Título deve ter no máximo 200 caracteres")
    .optional(),
});

// ==================== TEMPLATE SCHEMAS ====================

export const TemplateCreateSchema = z.object({
  team_id: z.string().uuid("ID da equipe inválido"),
  name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  title_template: trimmedString
    .max(200, "Título template deve ter no máximo 200 caracteres")
    .optional()
    .nullable(),
  description_template: trimmedString
    .max(5000, "Descrição template deve ter no máximo 5000 caracteres")
    .optional()
    .nullable(),
  priority: z.enum(priorityValues).optional(),
  service_id: z.string().uuid("ID do serviço inválido").optional().nullable(),
});

export const TemplateUpdateSchema = z.object({
  id: z.string().uuid("ID do template inválido"),
  name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  title_template: trimmedString
    .max(200, "Título template deve ter no máximo 200 caracteres")
    .optional()
    .nullable(),
  description_template: trimmedString
    .max(5000, "Descrição template deve ter no máximo 5000 caracteres")
    .optional()
    .nullable(),
  priority: z.enum(priorityValues).optional(),
  service_id: z.string().uuid("ID do serviço inválido").optional().nullable(),
});

// ==================== PROFILE SCHEMAS ====================

export const ProfileUpdateSchema = z.object({
  full_name: nonEmptyString
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  avatar_url: z.string().url("URL do avatar inválida").optional().nullable(),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Safely parse data with a Zod schema, throwing a user-friendly error
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError?.message || "Dados inválidos");
  }
  return result.data;
}

/**
 * Type exports for use in components
 */
export type DemandCreateInput = z.infer<typeof DemandCreateSchema>;
export type DemandUpdateInput = z.infer<typeof DemandUpdateSchema>;
export type InteractionCreateInput = z.infer<typeof InteractionCreateSchema>;
export type TeamCreateInput = z.infer<typeof TeamCreateSchema>;
export type ServiceCreateInput = z.infer<typeof ServiceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateSchema>;
export type SubtaskCreateInput = z.infer<typeof SubtaskCreateSchema>;
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateSchema>;
export type TemplateCreateInput = z.infer<typeof TemplateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof TemplateUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
