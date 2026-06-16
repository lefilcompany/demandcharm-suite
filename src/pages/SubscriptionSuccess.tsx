import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { SEOHead } from "@/components/SEOHead";

export default function SubscriptionSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: userSub, isLoading: subLoading } = useUserSubscription();
  const { data: teams, isLoading: teamsLoading } = useTeams();

  const sessionId = searchParams.get("session_id");

  // Auto-redirect to dashboard after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    const successElement = document.querySelector('.success-animation');
    if (successElement) {
      successElement.classList.add('animate-bounce');
      setTimeout(() => {
        successElement.classList.remove('animate-bounce');
      }, 1000);
    }
  }, []);

  const plan = userSub?.subscription?.plan;

  if (teamsLoading || subLoading) {
    return (
      <div className="container max-w-2xl py-12 flex items-center justify-center min-h-[60vh]">
        <SEOHead title="Assinatura Ativada" path="/subscription-success" />
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-12">
      <SEOHead title="Assinatura Ativada" path="/subscription-success" />
      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 success-animation">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <CardTitle className="text-2xl">{t("subscription.success.title")}</CardTitle>
          <CardDescription className="text-lg">
            {t("subscription.success.subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {plan && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t("subscription.success.planActivated", { plan: plan.name })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {plan.price_cents ? `R$ ${(plan.price_cents / 100).toFixed(2).replace(".", ",")}` : ""}
                    {plan.price_cents ? `/${t("pricing.month")}` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 text-left">
            <h3 className="font-semibold">{t("subscription.success.whatsNext")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                {t("subscription.success.step1")}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                {t("subscription.success.step2")}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                {t("subscription.success.step3")}
              </li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <Button variant="outline" onClick={() => navigate("/")}>
              {t("subscription.success.goToDashboard")}
            </Button>
            <Button onClick={() => navigate("/boards")} className="gap-2">
              {t("subscription.success.createBoard")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
