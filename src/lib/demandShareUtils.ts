import { supabase } from "@/integrations/supabase/client";

// Generate a cryptographically secure random token
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Gets or creates a public share token for a demand.
 * Only returns tokens that are active AND not expired.
 */
export async function getOrCreateShareToken(demandId: string, userId: string): Promise<string | null> {
  try {
    // Fetch active token, filtering expiration in JS since RLS already filters on DB side
    const { data: existingToken, error: fetchError } = await supabase
      .from("demand_share_tokens" as any)
      .select("id, token, expires_at")
      .eq("demand_id", demandId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching existing share token:", fetchError);
      return null;
    }

    const tokenData = existingToken as unknown as { id: string; token: string; expires_at: string | null } | null;
    
    if (tokenData) {
      // Check if token is still valid (not expired)
      const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) <= new Date();
      
      if (!isExpired) {
        return tokenData.token;
      }
      
      // Token is expired — deactivate it
      await supabase
        .from("demand_share_tokens" as any)
        .update({ is_active: false })
        .eq("id", tokenData.id);
    }

    // No valid token exists, create a new one
    const newToken = generateToken();
    const { error: insertError } = await supabase
      .from("demand_share_tokens" as any)
      .insert({
        demand_id: demandId,
        token: newToken,
        created_by: userId,
        expires_at: null,
      });

    if (insertError) {
      console.error("Error creating share token:", insertError);
      return null;
    }

    return newToken;
  } catch (error) {
    console.error("Error in getOrCreateShareToken:", error);
    return null;
  }
}

/**
 * Builds a public share URL for a demand.
 * Returns null if token creation fails (caller should handle).
 */
export async function buildPublicDemandUrl(
  demandId: string, 
  userId: string, 
  baseUrl?: string
): Promise<string | null> {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://pla.soma.lefil.com.br');
  
  try {
    const token = await getOrCreateShareToken(demandId, userId);
    if (token) {
      return `${origin}/shared/${token}`;
    }
  } catch (error) {
    console.error("Error building public demand URL:", error);
  }
  
  return null;
}
