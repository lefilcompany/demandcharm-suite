import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, Mail, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import authBackground from "@/assets/auth-background.jpg";
import { SEOHead } from "@/components/SEOHead";

type PageState = "loading" | "ready" | "expired" | "invalid" | "success" | "request-link";

// Parse hash parameters from URL
function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || hash.length <= 1) return params;
  
  const hashContent = hash.substring(1);
  const pairs = hashContent.split("&");
  
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  
  return params;
}

// Password strength calculator
function getPasswordStrength(password: string): { level: number; text: string; color: string } {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 1) return { level: 1, text: "Fraca", color: "bg-destructive" };
  if (score === 2) return { level: 2, text: "Razoável", color: "bg-orange-500" };
  if (score === 3) return { level: 3, text: "Boa", color: "bg-yellow-500" };
  if (score >= 4) return { level: 4, text: "Forte", color: "bg-green-500" };
  
  return { level: 0, text: "", color: "" };
}

// ---- PageWrapper extracted OUTSIDE the component to avoid remount on re-render ----
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <SEOHead title="Redefinir Senha" path="/reset-password" />
      {/* Mobile Header */}
      <div 
        className="lg:hidden relative h-48 sm:h-64 overflow-hidden" 
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6 text-center">
          <img src={logoSomaDark} alt="SoMA" className="h-10 sm:h-12 w-auto mb-3" />
          <h2 className="text-lg sm:text-xl font-semibold">Redefinir Senha</h2>
        </div>
      </div>

      {/* Desktop Left Side */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden" 
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="max-w-md">
            <KeyRound className="h-16 w-16 mb-6" />
            <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">Redefinir Senha</h1>
            <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
              Crie uma nova senha segura para acessar sua conta.
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-6 sm:p-8 md:p-12 bg-background">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  
  // Page state
  const [pageState, setPageState] = useState<PageState>("loading");
  const pageStateRef = useRef<PageState>("loading");
  
  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Resend link state
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Keep ref in sync with state
  const updatePageState = useCallback((newState: PageState) => {
    pageStateRef.current = newState;
    setPageState(newState);
  }, []);

  // Initialize page - detect token and set appropriate state
  useEffect(() => {
    const hash = window.location.hash;
    const params = parseHashParams(hash);
    
    // Check for error in URL first
    if (params.error) {
      const errorCode = params.error_code || params.error;
      const errorDescription = params.error_description || "";
      
      if (errorCode === "otp_expired" || errorDescription.toLowerCase().includes("expired")) {
        updatePageState("expired");
      } else {
        updatePageState("invalid");
      }
      // Clear the hash to prevent confusion on refresh
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    
    // Check if there's a recovery token
    if (params.access_token && params.type === "recovery") {
      // Token exists - Supabase will handle it via onAuthStateChange
      // Stay in loading state until PASSWORD_RECOVERY event fires
      updatePageState("loading");
      return;
    }
    
    // No token in URL - check if we already have a valid session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        updatePageState("ready");
      } else {
        updatePageState("request-link");
      }
    });
  }, [updatePageState]);

  // Listen for PASSWORD_RECOVERY event from Supabase
  // Using ref to avoid re-subscribing on pageState changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log("ResetPassword auth event:", event);
      
      if (event === "PASSWORD_RECOVERY") {
        updatePageState("ready");
        window.history.replaceState(null, "", window.location.pathname);
      } else if (event === "SIGNED_OUT" && pageStateRef.current === "loading") {
        updatePageState("invalid");
      }
    });

    return () => subscription.unsubscribe();
  }, [updatePageState]);

  // Timeout for loading state
  useEffect(() => {
    if (pageState !== "loading") return;
    
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          updatePageState("ready");
        } else {
          updatePageState("invalid");
        }
      });
    }, 5000);

    return () => clearTimeout(timeout);
  }, [pageState, updatePageState]);

  // Handle password form submission - calls Supabase directly
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("Senha muito curta", {
        description: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("Senhas não coincidem", {
        description: "As senhas digitadas não são iguais.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call Supabase directly to update password
      const { data, error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }

      // Verify that the update was successful
      if (!data.user) {
        throw new Error("Não foi possível confirmar a alteração da senha.");
      }

      console.log("Password updated successfully for user:", data.user.id);
      updatePageState("success");
      toast.success("Senha alterada com sucesso!", {
        description: "Você será redirecionado para o login.",
      });

      // Sign out and redirect after a brief delay
      setTimeout(async () => {
        try {
          // Clear session preferences
          localStorage.removeItem("rememberMe");
          sessionStorage.removeItem("sessionOnly");
          sessionStorage.removeItem("sessionChecked");
          
          // Sign out to force re-authentication with new password
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.log("SignOut during password reset:", signOutError);
        } finally {
          navigate("/auth");
        }
      }, 2000);
    } catch (error: any) {
      console.error("Password update failed:", error);
      toast.error("Erro ao alterar senha", {
        description: error?.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [password, confirmPassword, navigate, updatePageState]);

  // Handle resend link form submission
  const handleResendLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resendEmail || !resendEmail.includes("@")) {
      toast.error("Email inválido", {
        description: "Por favor, digite um email válido.",
      });
      return;
    }

    setIsResending(true);
    try {
      await resetPassword(resendEmail);
      toast.success("Email enviado!", {
        description: "Verifique sua caixa de entrada para o link de recuperação.",
      });
      setResendEmail("");
    } catch (error: any) {
      toast.error("Erro ao enviar email", {
        description: error?.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsResending(false);
    }
  }, [resendEmail, resetPassword]);

  // Password validation indicators
  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsDontMatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Loading State
  if (pageState === "loading") {
    return (
      <PageWrapper>
        <SEOHead title="Redefinir Senha" path="/reset-password" />
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold text-lg">Verificando link...</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Aguarde enquanto validamos seu link de recuperação.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Success State
  if (pageState === "success") {
    return (
      <PageWrapper>
        <SEOHead title="Redefinir Senha" path="/reset-password" />
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-xl">Senha alterada!</h3>
              <p className="text-muted-foreground mt-2">
                Sua senha foi alterada com sucesso. Redirecionando para o login...
              </p>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Error States (Expired/Invalid) and Request Link State
  if (pageState === "expired" || pageState === "invalid" || pageState === "request-link") {
    const isExpired = pageState === "expired";
    const title = pageState === "request-link" 
      ? "Recuperar Senha" 
      : isExpired 
        ? "Link Expirado" 
        : "Link Inválido";
    const description = pageState === "request-link"
      ? "Digite seu email para receber um link de recuperação."
      : isExpired
        ? "O link de recuperação expirou. Solicite um novo link abaixo."
        : "O link é inválido. Solicite um novo link abaixo.";

    return (
      <PageWrapper>
        <SEOHead title="Redefinir Senha" path="/reset-password" />
        <Card>
          <CardHeader className="text-center">
            {pageState !== "request-link" && (
              <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            )}
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleResendLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    className="h-11 sm:h-12 pl-10" 
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 sm:h-12"
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
            
            <div className="text-center pt-2">
              <Button 
                variant="link" 
                onClick={() => navigate("/auth")}
                className="text-muted-foreground"
              >
                Voltar para o login
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Ready State - Password Reset Form
  return (
    <PageWrapper>
      <SEOHead title="Redefinir Senha" path="/reset-password" />
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Nova Senha</CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  className="h-11 sm:h-12 pr-10" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  minLength={6}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.level ? passwordStrength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Força: <span className="font-medium">{passwordStrength.text}</span>
                  </p>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Mínimo de 6 caracteres
              </p>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input 
                  id="confirm-password" 
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  className={`h-11 sm:h-12 pr-16 ${
                    passwordsDontMatch ? "border-destructive focus-visible:ring-destructive" : ""
                  } ${passwordsMatch ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                />
                <div className="absolute right-0 top-0 h-full flex items-center">
                  {passwordsMatch && (
                    <Check className="h-4 w-4 text-green-500 mr-1" />
                  )}
                  {passwordsDontMatch && (
                    <X className="h-4 w-4 text-destructive mr-1" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {passwordsDontMatch && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 text-base font-semibold" 
              disabled={isSubmitting || password.length < 6 || !passwordsMatch}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar Senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
