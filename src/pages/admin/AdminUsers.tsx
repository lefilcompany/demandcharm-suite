import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

const roleLabels: Record<string, string> = {
  admin: "System Admin",
  member: "Membro",
};

export default function AdminUsers() {
  const { data: users, isLoading } = useAdminUsers();

  return (
    <div className="p-6 space-y-6">
      <SEOHead title="Admin - Usuários" />
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Todos os usuários do sistema</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !users?.length ? (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => {
                  const appRole = u.user_roles?.[0]?.role ?? "member";
                  const teams = u.team_members ?? [];
                  return (
                    <TableRow key={u.id}>
                      <SEOHead title="Admin - Usuários" />
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback>{u.full_name?.[0] ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{u.full_name}</p>
                            {u.job_title && <p className="text-xs text-muted-foreground">{u.job_title}</p>}
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
