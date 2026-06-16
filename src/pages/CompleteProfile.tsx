import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import authBackground from "@/assets/auth-background.jpg";
import { SEOHead } from "@/components/SEOHead";

interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}
interface IBGECity {
  id: number;
  nome: string;
}

export default function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [states, setStates] = useState<IBGEState[]>([]);
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Check if profile is already complete
  useEffect(() => {
    if (!user) return;
    const checkProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone, state, city")
        .eq("id", user.id)
        .single();
      
      if (data?.phone && data?.state && data?.city) {
        setProfileComplete(true);
      } else {
        // Pre-fill existing data
        if (data?.phone) setPhone(data.phone);
        if (data?.state) setState(data.state);
        if (data?.city) setCity(data.city);
      }
      setCheckingProfile(false);
    };
    checkProfile();
  }, [user]);

  // Fetch states from IBGE API
  useEffect(() => {
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
        const data = await response.json();
        setStates(data);
      } catch (error) {
        console.error("Error fetching states:", error);
      } finally {
        setLoadingStates(false);
      }
    };
    fetchStates();
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }
    const fetchCities = async () => {
      setLoadingCities(true);
      setCities([]);
      setCity("");
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`);
        const data = await response.json();
        setCities(data);
      } catch (error) {
        console.error("Error fetching cities:", error);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [state]);

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  if (authLoading || checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SEOHead title="Completar Perfil" path="/complete-profile" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profileComplete) {
    return <Navigate to="/welcome" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !state || !city) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone, state, city })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Perfil completado com sucesso!");
      navigate("/welcome", { replace: true });
    } catch (error: any) {
      toast.error("Erro ao salvar perfil", {
        description: error?.message || "Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || "Usuário";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <SEOHead title="Completar Perfil" path="/complete-profile" />
      {/* Mobile Header */}
      <div
        className="lg:hidden relative h-40 sm:h-48 overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6 text-center">
          <img src={logoSomaDark} alt="SoMA" className="h-10 sm:h-12 w-auto mb-3" />
          <h2 className="text-lg sm:text-xl font-semibold">Complete seu perfil</h2>
        </div>
      </div>

      {/* Desktop Left side */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <img src={logoSomaDark} alt="SoMA" className="h-12 w-auto" />
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
              Quase lá!
            </h1>
            <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
              Precisamos de mais algumas informações para configurar sua conta.
            </p>
          </div>
          <div />
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 lg:w-1/2 xl:w-2/5 flex items-start lg:items-center justify-center p-6 sm:p-8 md:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* User info from Google */}
          <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-muted/50 border">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-14 w-14 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{fullName}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-emerald-600">Conta Google conectada</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Complete seu cadastro
            </h2>
            <p className="text-sm text-muted-foreground">
              Precisamos de algumas informações adicionais para finalizar seu perfil.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="complete-phone">{t("common.phone")}</Label>
              <Input
                id="complete-phone"
                type="tel"
                placeholder="(00) 00000-0000"
                className="h-11"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={16}
                required
              />
            </div>

            {/* State + City */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.state")}</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={loadingStates ? "..." : "UF"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingStates ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      states.map((s) => (
                        <SelectItem key={s.id} value={s.sigla}>
                          {s.sigla} - {s.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.city")}</Label>
                <Select
                  value={city}
                  onValueChange={setCity}
                  disabled={!state || loadingCities}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={loadingCities ? "Carregando..." : "Cidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCities ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      cities.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold mt-4"
              disabled={isLoading || !phone || !state || !city}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
