import * as React from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Underlined tab bar used across the finance module. */
export function FinanceTabsList({ className, ...p }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn("h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0", className)}
      {...p}
    />
  );
}

export function FinanceTab({ full, children, className, ...p }: React.ComponentProps<typeof TabsTrigger> & { full?: string }) {
  const t = (
    <TabsTrigger
      className={cn(
        "relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none",
        "hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
        className,
      )}
      {...p}
    >
      {children}
    </TabsTrigger>
  );
  if (!full) return t;
  return <Tooltip><TooltipTrigger asChild>{t}</TooltipTrigger><TooltipContent>{full}</TooltipContent></Tooltip>;
}

const TONE = {
  info: { icon: Info, cls: "border-border bg-muted/40" },
  warn: { icon: AlertTriangle, cls: "border-primary/40 bg-primary/5" },
  error: { icon: XCircle, cls: "border-destructive/40 bg-destructive/5" },
};

/** Single notice style for warnings, errors and empty states. */
export function FinanceNotice({ tone = "info", children, action, className }: { tone?: keyof typeof TONE; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = TONE[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", cls, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "warn" ? "text-primary" : tone === "error" ? "text-destructive" : "text-muted-foreground")} />
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}

/** Card section with short title, one-line description and optional actions. */
export function FinanceSection({ title, description, actions, children, className }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
