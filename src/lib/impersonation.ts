import { supabase } from "@/integrations/supabase/client";

const KEY = "soma.impersonation";

export interface ImpersonationState {
  adminRefreshToken: string;
  adminEmail: string;
  targetName: string;
  targetEmail: string;
}

export function getImpersonation(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

/** Admin entra na conta do usuário. O acesso é registrado no servidor. */
export async function startImpersonation(targetUserId: string, targetName: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão de administrador não encontrada");

  const { data, error } = await supabase.functions.invoke("admin-impersonate", {
    body: { target_user_id: targetUserId },
  });
  if (error || !data?.token_hash) {
    let msg = data?.error || "Não foi possível acessar a conta";
    try { msg = (await (error as any)?.context?.json())?.error || msg; } catch { /* noop */ }
    throw new Error(msg);
  }

  localStorage.setItem(KEY, JSON.stringify({
    adminRefreshToken: session.refresh_token,
    adminEmail: session.user.email ?? "",
    targetName,
    targetEmail: data.email,
  } satisfies ImpersonationState));

  await supabase.auth.signOut({ scope: "local" });
  const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
  if (otpErr) {
    await stopImpersonation();
    throw new Error("Falha ao entrar na conta do usuário");
  }
  window.location.assign("/app");
}

/** Volta para a conta do administrador. */
export async function stopImpersonation() {
  const state = getImpersonation();
  localStorage.removeItem(KEY);
  await supabase.auth.signOut({ scope: "local" });
  if (state?.adminRefreshToken) {
    const { error } = await supabase.auth.refreshSession({ refresh_token: state.adminRefreshToken });
    if (!error) {
      window.location.assign("/admin/users");
      return;
    }
  }
  window.location.assign("/auth");
}
