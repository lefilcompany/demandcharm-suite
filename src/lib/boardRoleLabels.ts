// Labels legíveis para os cargos de quadro (board_members.role).
// Centralizado para uso em UI, notificações e e-mails.

export type BoardRoleKey = "admin" | "moderator" | "executor" | "requester";

export const BOARD_ROLE_LABELS: Record<BoardRoleKey, string> = {
  admin: "Administrador",
  moderator: "Coordenador",
  executor: "Agente",
  requester: "Solicitante",
};

export function getBoardRoleLabel(role: string | null | undefined): string {
  if (!role) return "Membro";
  return BOARD_ROLE_LABELS[role as BoardRoleKey] ?? "Membro";
}
