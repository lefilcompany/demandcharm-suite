import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadForFreshBuild } from "@/lib/chunkReload";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Última linha de defesa contra a tela em branco. Se um erro escapar (por
 * exemplo, um arquivo da versão anterior que já não existe no servidor), mostra
 * uma mensagem com botão para recarregar em vez de deixar a página vazia.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro não tratado na interface:", error, info.componentStack);
    if (isChunkLoadError(String(error?.message || ""))) {
      // Página de uma versão antiga: recarrega já na versão atual.
      reloadForFreshBuild();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-background text-foreground p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-8 text-center space-y-4">
          <h1 className="text-xl font-semibold">Algo deu errado ao carregar o SoMA</h1>
          <p className="text-sm text-muted-foreground">
            Pode ser uma versão antiga da página guardada no navegador. Recarregar costuma resolver.
          </p>
          <button
            type="button"
            onClick={() => reloadForFreshBuild()}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
