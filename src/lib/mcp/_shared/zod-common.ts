import { z } from "zod";

export const zUuid = z.string().uuid();
export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD");
export const zIsoDateTime = z.string().datetime({ offset: true });
export const zPriority = z.enum(["low", "medium", "high", "urgent"]);
export const zTeamRole = z.enum(["admin", "moderator", "member", "requester"]);
export const zBoardRole = z.enum(["admin", "moderator", "executor", "requester"]);
export const zPagination = {
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
};
export const zAeiouOrigin = z
  .object({
    pillar: z.enum(["A", "E", "I", "O", "U"]),
    source_tool: z.string().max(80).optional(),
    source_ref: z.string().max(200).optional(),
    recommendation_id: z.string().max(200).optional(),
    marketing_os_project_id: z.string().uuid().optional(),
  })
  .describe("Origem AEIOU: qual pilar do Marketing OS gerou a demanda.");
