import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/lib/impersonation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History, LogIn, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

const roleLabels: Record<string, string> = {
  admin: "System Admin",
  member: "Membro",
};

export default function AdminUsers() {
  const { data: users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<any | null>(null);
  const [entering, setEntering] = useState(false);

  const { data: log } = useQuery({
    queryKey: ["admin-impersonation-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_impersonation_log")
        .select("id, admin_id, target_user_id, target_email, started_at")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (users ?? []).forEach((u: any) => m.set(u.id, u.full_name || u.email));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users ?? [];
    return (users ?? []).filter((u: any) =>
      [u.full_name, u.email].some((v) => v?.toLowerCase().includes(q)));
  }, [users, search]);

  const enter = async () => {
    if (!target) return;
    setEntering(true);
    try {
      await startImpersonation(target.id, target.full_name || target.email);
    } catch (e: any) {
      toast.error(e.message);
      setEntering(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <SEOHead title="Admin - Usuários" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Todos os usuários do sistema</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome ou e-mail" className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !filtered.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Equipes</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => {
                  const appRole = u.user_roles?.[0]?.role ?? "member";
                  const teams = u.team_members ?? [];
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback>{u.full_name?.[0] ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={appRole === "admin" ? "destructive" : "secondary"}>
                          {roleLabels[appRole] ?? appRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teams.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                          {teams.slice(0, 3).map((tm: any) => (
                            <Badge key={tm.team_id} variant="outline" className="text-xs">
                              {tm.teams?.name ?? "Equipe"}
                            </Badge>
                          ))}
                          {teams.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{teams.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        {appRole !== "admin" && (
                          <Button size="sm" variant="outline" onClick={() => setTarget(u)}>
                            <LogIn className="h-3.5 w-3.5 mr-1.5" />
                            Acessar conta
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico de acessos a contas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!log?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum acesso registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Conta acessada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{format(new Date(l.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>{nameById.get(l.admin_id) ?? l.admin_id}</TableCell>
                    <TableCell>{nameById.get(l.target_user_id) ?? l.target_email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && !entering && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acessar a conta de {target?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você verá e poderá agir exatamente como essa pessoa. Tudo o que fizer ficará registrado em nome dela.
              O acesso fica no histórico. Para voltar, use o botão "Voltar ao admin" no rodapé da tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={entering}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={entering} onClick={(e) => { e.preventDefault(); enter(); }}>
              {entering ? "Entrando..." : "Acessar conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
