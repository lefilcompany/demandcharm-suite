import { useAdminTeams } from "@/hooks/admin/useAdminTeams";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

const statusLabels: Record<string, string> = {
  active: "Ativo",
  trialing: "Trial",
  canceled: "Cancelado",
  past_due: "Vencido",
};

export default function AdminTeams() {
  const { data: teams, isLoading } = useAdminTeams();

  return (
    <div className="p-6 space-y-6">
      <SEOHead title="Admin - Equipes" />
      <div>
        <h1 className="text-2xl font-bold">Equipes</h1>
        <p className="text-muted-foreground">Todas as equipes do sistema</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !teams?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma equipe encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial até</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => {
                  const sub = t.subscriptions?.[0];
                  return (
                    <TableRow key={t.id}>
                      <SEOHead title="Admin - Equipes" />
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{sub?.plans?.name ?? "Sem plano"}</TableCell>
                      <TableCell>
                        <Badge variant={sub?.status === "active" || sub?.status === "trialing" ? "default" : "secondary"}>
                          {statusLabels[sub?.status] ?? sub?.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub?.trial_ends_at
                          ? format(new Date(sub.trial_ends_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
