import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { SelectedPlanCard } from "./SelectedPlanCard";
import { Plan } from "@/hooks/usePlans";

interface AuthStepProps {
  selectedPlan: Plan | null;
  onBack: () => void;
  onLoginSuccess: () => void;
  onSignupSuccess: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
}

export function AuthStep({ 
  selectedPlan, 
  onBack, 
  onLoginSuccess, 
  onSignupSuccess,
  signIn,
  signUp 
}: AuthStepProps) {
  const { t } = useTranslation();
  
  const [authTab, setAuthTab] = useState<"login" | "signup">("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(loginData.email, loginData.password);
      onLoginSuccess();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupData.password.length < 6) return;
    if (signupData.password !== signupData.confirmPassword) return;
    if (!signupData.fullName.trim()) return;
    
    setIsLoading(true);
    try {
      await signUp(signupData.email, signupData.password, signupData.fullName);
      onSignupSuccess();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold">{t("getStarted.step2Title")}</h2>
        <p className="text-muted-foreground">{t("getStarted.authSubtitle")}</p>
      </div>

      {/* Auth tabs */}
      <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "login" | "signup")}>
        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50">
          <TabsTrigger value="signup" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("auth.signup")}
          </TabsTrigger>
          <TabsTrigger value="login" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("auth.login")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signup" className="mt-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">{t("auth.fullName")}</Label>
              <Input
                id="signup-name"
                placeholder={t("auth.fullName")}
                value={signupData.fullName}
                onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">{t("common.email")}</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="seu@email.com"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">{t("common.password")}</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  className="h-11 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-confirm">{t("auth.confirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="signup-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  className="h-11 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full h-12 text-base font-semibold mt-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  {t("auth.createAccount")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">{t("common.email")}</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">{t("common.password")}</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="h-11 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full h-12 text-base font-semibold mt-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  {t("auth.login")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("getStarted.backToTeam")}
      </Button>
    </div>
  );
}
