import { useCallback, useEffect, useRef, useState } from "react";
import { LineChart, Receipt, Clock, Tag, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanManageFinance, useProjectBoards } from "@/hooks/useProjectFinance";
import { ProjectHoursCosts } from "./ProjectHoursCosts";
import { ProjectRevenue } from "./ProjectRevenue";
import { ProjectMinimumPrice } from "./ProjectMinimumPrice";
import { ProjectFinanceSummary, ProjectFinanceSettings } from "./ProjectFinanceSummary";

const SECTIONS = [
  { v: "result", label: "Resultado", hint: "Lucro e margem do mês", icon: LineChart },
  { v: "revenue", label: "Faturamento", hint: "Contratos do projeto", icon: Receipt },
  { v: "hours", label: "Horas e custos", hint: "Tempo apontado × custo", icon: Clock },
  { v: "price", label: "Preço mínimo", hint: "Quanto cobrar", icon: Tag },
  { v: "config", label: "Configuração", hint: "Valores da equipe", icon: Settings2 },
] as const;
type SectionId = (typeof SECTIONS)[number]["v"];

export function ProjectFinancePanel({ projectId, teamId }: { projectId: string; teamId: string | null }) {
  const competence = `${new Date().toISOString().substring(0, 7)}-01`;
  const { data: canManage } = useCanManageFinance(teamId);
  const { isError } = useProjectBoards(teamId);
  const [month, setMonth] = useState(competence.substring(0, 7));
  const [active, setActive] = useState<SectionId>("result");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const jumping = useRef<number | null>(null);

  const computeActive = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
      setActive(SECTIONS[SECTIONS.length - 1].v);
      return;
    }
    const top = root.getBoundingClientRect().top + 24;
    let current: SectionId = SECTIONS[0].v;
    for (const s of SECTIONS) {
      const el = sectionRefs.current[s.v];
      if (el && el.getBoundingClientRect().top <= top) current = s.v;
    }
    setActive(current);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => { if (jumping.current === null) computeActive(); };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [computeActive, isError]);

  const jumpTo = (id: SectionId) => {
    const root = scrollRef.current;
    const el = sectionRefs.current[id];
    if (!root || !el) return;
    setActive(id);
    const target = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 8;
    if (jumping.current) window.clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => { jumping.current = null; }, 700);
    root.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  if (isError) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Seções financeiras" className="flex w-full gap-1 overflow-x-auto lg:flex-col lg:self-start">
        {SECTIONS.map(({ v, label, hint, icon: Icon }) => {
          const on = active === v;
          return (
            <button key={v} type="button" onClick={() => jumpTo(v)} aria-current={on ? "true" : undefined}
              className={cn("group flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                on ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-background", on && "border-primary/40 text-primary")}><Icon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{label}</span>
                <span className="hidden text-[11px] leading-tight text-muted-foreground lg:block">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <div ref={scrollRef} className="min-w-0 space-y-10 overflow-y-auto pr-1 h-[calc(100dvh-16rem)] min-h-[20rem]">
        {SECTIONS.map(({ v, label, hint, icon: Icon }) => (
          <section key={v} ref={(el) => { sectionRefs.current[v] = el; }} aria-label={label} className="scroll-mt-2">
            <header className="mb-3 border-b pb-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border bg-muted/50 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                {label}
              </h2>
              <p className="mt-1 pl-8 text-[11px] leading-tight text-muted-foreground">{hint}</p>
            </header>
            {v === "result" && <ProjectFinanceSummary projectId={projectId} month={month} onMonth={setMonth} />}
            {v === "revenue" && <ProjectRevenue projectId={projectId} teamId={teamId} canManage={!!canManage} />}
            {v === "hours" && <ProjectHoursCosts projectId={projectId} canExport={!!canManage} />}
            {v === "price" && <ProjectMinimumPrice teamId={teamId} />}
            {v === "config" && <ProjectFinanceSettings projectId={projectId} canManage={!!canManage} />}
          </section>
        ))}
      </div>
    </div>
  );
}
