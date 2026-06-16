import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { DemandHistorySection } from "@/components/profile/DemandHistorySection";
import { History, Award, Briefcase, Target, ChevronDown, ChevronUp } from "lucide-react";
import type { ProfileFieldKey } from "@/lib/profileCustomization";

interface BadgeItem {
  id: string;
  [k: string]: any;
}

interface TeamRow {
  role: string;
  joined_at?: string;
  teams?: { id: string; name: string } | null;
}
interface BoardRow {
  role: string;
  boards?: { id: string; name: string } | null;
}

interface Props {
  userId: string;
  isPublic: boolean;
  visibility: Record<ProfileFieldKey, boolean>;
  earnedBadges: BadgeItem[];
  lockedBadges: BadgeItem[];
  totalBadges: number;
  teams?: TeamRow[];
  boards?: BoardRow[];
  getRoleLabel?: (r: string) => string;
  getRoleBadgeVariant?: (r: string) => "default" | "secondary" | "destructive" | "outline";
}

const INITIAL_BADGES = 12;

export function ProfileTabsSection({
  userId,
  isPublic,
  visibility,
  earnedBadges,
  lockedBadges,
  totalBadges,
  teams = [],
  boards = [],
  getRoleLabel = (r) => r,
  getRoleBadgeVariant = () => "secondary",
}: Props) {
  const [showAllBadges, setShowAllBadges] = useState(false);

  const tabs = [
    visibility.demandHistory && { id: "history", label: "Histórico", icon: History },
    visibility.achievements && { id: "achievements", label: "Conquistas", icon: Award },
    visibility.teams && teams.length > 0 && { id: "teams", label: "Equipes", icon: Briefcase },
    visibility.boards && boards.length > 0 && { id: "boards", label: "Quadros", icon: Target },
  ].filter(Boolean) as { id: string; label: string; icon: any }[];

  if (tabs.length === 0) return null;

  const allBadges = [...earnedBadges, ...lockedBadges];
  const displayedBadges = showAllBadges ? allBadges : allBadges.slice(0, INITIAL_BADGES);
  const hasMoreBadges = allBadges.length > INITIAL_BADGES;

  return (
    <Card>
      <Tabs defaultValue={tabs[0].id} className="w-full">
        <div className="border-b px-4 pt-3 pb-2 overflow-x-auto">
          <TabsList className="bg-transparent h-auto p-0 gap-1 mb-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 hover:text-foreground transition-colors rounded-md px-3 py-2 text-sm gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {t.id === "achievements" && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {earnedBadges.length}/{totalBadges}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {visibility.demandHistory && (
          <TabsContent value="history" className="mt-0 p-0">
            <div className="p-0">
              <DemandHistorySection userId={userId} isPublic={isPublic} embedded />
            </div>
          </TabsContent>
        )}

        {visibility.achievements && (
          <TabsContent value="achievements" className="mt-0">
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {displayedBadges.map((badge: any, index: number) => {
                  const isEarned = earnedBadges.some((b) => b.id === badge.id);
                  return (
                    <AnimatedBadge
                      key={badge.id}
                      badge={badge}
                      isEarned={isEarned}
                      index={index}
                    />
                  );
                })}
              </div>
              {hasMoreBadges && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllBadges(!showAllBadges)}
                    className="gap-2"
                  >
                    {showAllBadges ? (
                      <>
                        <ChevronUp className="h-4 w-4" /> Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" /> Ver mais (
                        {allBadges.length - INITIAL_BADGES})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </TabsContent>
        )}

        {visibility.teams && teams.length > 0 && (
          <TabsContent value="teams" className="mt-0">
            <CardContent className="space-y-2 pt-4">
              {teams.map((tm) => (
                <div
                  key={tm.teams?.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">{tm.teams?.name}</p>
                    {tm.joined_at && (
                      <p className="text-xs text-muted-foreground">
                        Desde {new Date(tm.joined_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <Badge variant={getRoleBadgeVariant(tm.role)}>
                    {getRoleLabel(tm.role)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </TabsContent>
        )}

        {visibility.boards && boards.length > 0 && (
          <TabsContent value="boards" className="mt-0">
            <CardContent className="space-y-2 pt-4">
              {boards.map((bm) => (
                <div
                  key={bm.boards?.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <p className="font-medium">{bm.boards?.name}</p>
                  <Badge variant={getRoleBadgeVariant(bm.role)}>
                    {getRoleLabel(bm.role)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}
