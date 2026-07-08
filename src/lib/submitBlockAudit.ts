import { supabase } from "@/integrations/supabase/client";

export interface LogBlockedSubmitInput {
  formId: string;
  boardId?: string | null;
  teamId?: string | null;
  failedValidations: string[];
  draftSnapshot?: Record<string, unknown>;
}

/**
 * Records a client-side blocked submit attempt for later diagnosis.
 * Fails silently — logging must never disrupt the user flow.
 */
export async function logBlockedSubmit(input: LogBlockedSubmitInput): Promise<void> {
  try {
    if (!input.failedValidations.length) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Redact potentially long values but keep enough for diagnosis.
    const snapshot = input.draftSnapshot
      ? Object.fromEntries(
          Object.entries(input.draftSnapshot).map(([k, v]) => {
            if (typeof v === "string") return [k, v.slice(0, 500)];
            return [k, v];
          }),
        )
      : undefined;

    await supabase.from("demand_request_submit_blocks").insert([
      {
        user_id: user.id,
        form_id: input.formId,
        board_id: input.boardId ?? undefined,
        team_id: input.teamId ?? undefined,
        failed_validations: input.failedValidations,
        draft_snapshot: (snapshot ?? null) as never,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    ]);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[submit-block]", input.formId, input.failedValidations);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to log blocked submit", err);
  }
}
