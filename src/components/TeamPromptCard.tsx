import { useNavigate } from "react-router-dom";
import { Users, Plus, ArrowRight } from "lucide-react";

interface TeamPromptCardProps {
  variant: "create" | "join";
}

export function TeamPromptCard({ variant }: TeamPromptCardProps) {
  const navigate = useNavigate();

  const config = {
    create: {
      icon: Plus,
      title: "Criar Nova Equipe",
      description: "Crie sua equipe e gerencie demandas. Você será o administrador.",
      path: "/teams/create",
      iconBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
      cardBg: "from-primary/5 to-transparent border-primary/20 hover:border-primary/50 hover:shadow-primary/10",
    },
    join: {
      icon: Users,
      title: "Entrar em Equipe",
      description: "Use um código de acesso para solicitar entrada em uma equipe.",
      path: "/teams/join",
      iconBg: "bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground",
      cardBg: "from-secondary/10 to-transparent border-border hover:border-primary/30",
    },
  };

  const { icon: Icon, title, description, path, iconBg, cardBg } = config[variant];

  return (
    <button
      onClick={() => navigate(path)}
      className={`group relative bg-gradient-to-br ${cardBg} border-2 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 w-full`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
      <div className="relative">
        <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl ${iconBg} mb-4 transition-colors duration-300`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          {title}
          <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}
