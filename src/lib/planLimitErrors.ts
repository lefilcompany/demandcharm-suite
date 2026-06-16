import { toast } from "sonner";

export type PlanLimitResource = "BOARDS" | "MEMBERS" | "DEMANDS" | "SERVICES" | "NOTES";

const PREFIX_RE = /PLAN_LIMIT_(BOARDS|MEMBERS|DEMANDS|SERVICES|NOTES)\s*:\s*([\s\S]*)$/;

export interface PlanLimitInfo {
  resource: PlanLimitResource;
  message: string;
}

export function parsePlanLimitError(err: unknown): PlanLimitInfo | null {
  if (!err) return null;
  const raw =
    (err as { message?: string })?.message ??
    (typeof err === "string" ? err : "");
  if (!raw) return null;
  const match = raw.match(PREFIX_RE);
  if (!match) return null;
  return {
    resource: match[1] as PlanLimitResource,
    message: match[2].trim(),
  };
}

export function isPlanLimitError(err: unknown): boolean {
  return parsePlanLimitError(err) !== null;
}

/**
 * Show a rich toast with an action button to open the plans modal.
 * Returns true if the error was a plan-limit error and was handled.
 */
export function showPlanLimitToast(err: unknown, openPlans: () => void): boolean {
  const info = parsePlanLimitError(err);
  if (!info) return false;
  toast.error(info.message, {
    duration: 8000,
    action: {
      label: "Ver planos",
      onClick: () => openPlans(),
    },
  });
  return true;
}
