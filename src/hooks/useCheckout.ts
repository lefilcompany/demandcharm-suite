import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateCheckoutParams {
  planSlug: string;
  teamId: string;
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async ({ planSlug, teamId }: CreateCheckoutParams) => {
      console.log("[useCheckout] Starting checkout", { planSlug, teamId });

      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session?.access_token) {
        throw new Error("Você precisa estar logado para assinar um plano");
      }

      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/get-started`;

      console.log("[useCheckout] Invoking create-checkout function");

      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          planSlug,
          teamId,
          successUrl,
          cancelUrl,
        },
      });

      console.log("[useCheckout] Raw response", { 
        data: response.data, 
        error: response.error?.message,
        status: response.error ? "error" : "ok"
      });

      // Handle function invocation error
      if (response.error) {
        let message = "Falha ao criar sessão de pagamento";
        
        // Try to extract error from response body
        if (response.error.message) {
          message = response.error.message;
        }

        // If the error contains JSON with an error field, extract it
        try {
          const errorBody = typeof response.error.message === "string" 
            ? JSON.parse(response.error.message) 
            : null;
          if (errorBody?.error) {
            message = errorBody.error;
          }
        } catch {
          // Not JSON, use as-is
        }

        console.error("[useCheckout] Function error:", message);
        throw new Error(message);
      }

      // Handle case where data might be a string (edge function returned non-JSON)
      let parsedData = response.data;
      if (typeof response.data === "string") {
        try {
          parsedData = JSON.parse(response.data);
        } catch {
          console.error("[useCheckout] Failed to parse response as JSON:", response.data);
          throw new Error("Resposta inválida do servidor");
        }
      }

      // Check for error in response data
      if (parsedData?.error) {
        console.error("[useCheckout] Error in response data:", parsedData.error);
        throw new Error(parsedData.error);
      }

      const url = parsedData?.url;
      
      if (!url) {
        console.error("[useCheckout] No checkout URL in response:", parsedData);
        throw new Error("URL de pagamento não retornada pelo servidor");
      }

      console.log("[useCheckout] Checkout URL received successfully");
      return url as string;
    },
  });
}
