import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeamCreateSchema, AccessCodeSchema, validateData } from "@/lib/validations";

export function useTeams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["teams", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select(`
          *,
          team_members!inner(user_id),
          profiles!teams_created_by_fkey(full_name, avatar_url)
        `)
        .eq("team_members.user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function generateAccessCode(): string {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

export async function checkAccessCodeAvailable(code: string): Promise<boolean> {
  const normalizedCode = code.toUpperCase().trim();
  
  if (normalizedCode.length < 6) {
    return true; // Too short to check, will be validated on submit
  }
  
  const { data, error } = await supabase
    .rpc("check_access_code_exists", { code: normalizedCode });
  
  if (error) {
    console.error("Error checking access code:", error);
    throw new Error("Erro ao verificar disponibilidade do código");
  }
  
  // RPC returns true if code EXISTS, so we return the opposite (available if NOT exists)
  return data === false;
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; accessCode?: string }) => {
      // Validate input data before database operation
      const validatedData = validateData(TeamCreateSchema, data);
      const accessCode = validatedData.accessCode || generateAccessCode();
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error("Você precisa estar logado para criar uma equipe");
      }
      const userId = authData.user.id;
      const userFullName = authData.user.user_metadata?.full_name || "Usuário";

      // Ensure profile exists (handles race condition with auth trigger)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            full_name: userFullName,
            avatar_url: authData.user.user_metadata?.avatar_url || null,
          });
        if (profileError && profileError.code !== "23505") {
          throw profileError;
        }
      }

      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: validatedData.name,
          description: validatedData.description,
          access_code: accessCode,
          created_by: userId,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as team member with owner role
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: team.id,
          user_id: userId,
          role: "admin" as const,
        });

      if (memberError) throw memberError;

      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useJoinTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accessCode: string) => {
      // Validate access code format
      const validatedCode = validateData(AccessCodeSchema, accessCode.toUpperCase());
      
      // Use secure RPC that validates access code server-side
      const { data: teamId, error } = await supabase
        .rpc("join_team_with_code", { p_code: validatedCode });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Você já é membro desta equipe");
        }
        if (error.message?.includes("Invalid access code")) {
          throw new Error("Código de acesso inválido");
        }
        throw new Error("Erro ao entrar na equipe");
      }

      return { id: teamId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
