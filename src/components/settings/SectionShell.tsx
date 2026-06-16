import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SectionShellProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionShell({ icon: Icon, title, description, action, children, className }: SectionShellProps) {
  return (
    <Card className={`shadow-sm border rounded-xl ${className ?? ""}`}>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="space-y-5">{children}</div>
      </CardContent>
    </Card>
  );
}
