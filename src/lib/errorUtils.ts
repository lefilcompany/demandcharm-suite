/**
 * Centralized error handling utility
 * Maps database and API errors to user-friendly messages
 */

interface ErrorMapping {
  pattern: RegExp | string;
  message: string;
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  // Zod validation errors (show original message)
  { pattern: /deve ter no máximo/i, message: "__PASS_THROUGH__" },
  { pattern: /Este campo é obrigatório/i, message: "__PASS_THROUGH__" },
  { pattern: /inválido/i, message: "__PASS_THROUGH__" },
  
  // Authentication errors
  { pattern: /user already registered/i, message: "Este e-mail já está cadastrado." },
  { pattern: /already been registered/i, message: "Este e-mail já está cadastrado." },
  { pattern: /invalid login credentials/i, message: "E-mail ou senha incorretos." },
  { pattern: /invalid credentials/i, message: "E-mail ou senha incorretos." },
  { pattern: /email not confirmed/i, message: "E-mail não confirmado. Verifique sua caixa de entrada." },
  { pattern: /weak.*password/i, message: "Senha muito fraca. Use pelo menos 6 caracteres." },
  { pattern: /invalid email/i, message: "E-mail inválido. Verifique o formato." },
  { pattern: /too many requests/i, message: "Muitas tentativas. Aguarde alguns minutos." },
  { pattern: /rate limit/i, message: "Muitas tentativas. Aguarde alguns minutos." },
  
  // Database constraint errors
  { pattern: "23505", message: "Este registro já existe." }, // Unique violation
  { pattern: "23503", message: "Não é possível realizar esta ação. Existem dados relacionados." }, // Foreign key violation
  { pattern: "23502", message: "Informações obrigatórias não foram preenchidas." }, // Not null violation
  { pattern: "23514", message: "Os dados informados não são válidos." }, // Check violation
  
  // RLS errors
  { pattern: /row-level security/i, message: "Você não tem permissão para realizar esta ação." },
  { pattern: /violates.*policy/i, message: "Você não tem permissão para realizar esta ação." },
  { pattern: /permission denied/i, message: "Você não tem permissão para realizar esta ação." },
  
  // Network errors
  { pattern: /network/i, message: "Erro de conexão. Verifique sua internet." },
  { pattern: /fetch failed/i, message: "Erro de conexão. Verifique sua internet." },
  { pattern: /timeout/i, message: "A operação demorou muito. Tente novamente." },
  
  // Storage errors
  { pattern: /bucket not found/i, message: "Erro ao acessar arquivos. Tente novamente." },
  { pattern: /object not found/i, message: "Arquivo não encontrado." },
  { pattern: /payload too large/i, message: "Arquivo muito grande." },
  
  // API errors
  { pattern: "400", message: "Erro na requisição. Verifique os dados e tente novamente." },
  { pattern: /bad request/i, message: "Erro na requisição. Verifique os dados e tente novamente." },
  { pattern: /columns.*not found/i, message: "Erro ao processar a solicitação. Tente novamente." },
  
  // Generic database errors
  { pattern: /PGRST/i, message: "Erro ao processar a solicitação. Tente novamente." },
];

/**
 * Maps an error to a user-friendly message
 * Logs the original error for debugging but returns sanitized message
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return "Ocorreu um erro. Tente novamente.";
  }

  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const errorCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";

  // Log the original error for debugging (only in development)
  if (process.env.NODE_ENV === "development") {
    console.error("Original error:", error);
  }

  // Check for matching error pattern
  for (const mapping of ERROR_MAPPINGS) {
    if (typeof mapping.pattern === "string") {
      if (errorCode === mapping.pattern || errorMessage.includes(mapping.pattern)) {
        return mapping.message;
      }
    } else if (mapping.pattern.test(errorMessage)) {
      // Pass through validation messages as-is
      if (mapping.message === "__PASS_THROUGH__") {
        return errorMessage;
      }
      return mapping.message;
    }
  }

  // Return generic message for unmapped errors
  return "Ocorreu um erro. Tente novamente.";
}

/**
 * Helper to display error in toast with proper sanitization
 */
export function getToastErrorDescription(error: unknown): string {
  return getErrorMessage(error);
}
