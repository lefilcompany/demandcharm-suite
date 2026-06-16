import logoIcon from "@/assets/logo-soma-icon.png";

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background safe-all">
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated logo container */}
        <div className="relative">
          {/* Outer ring */}
          <div className="absolute inset-0 -m-4 animate-spin-slow rounded-full border-4 border-transparent border-t-primary/30" />
          
          {/* Inner ring */}
          <div className="absolute inset-0 -m-2 animate-spin rounded-full border-2 border-transparent border-t-primary" style={{ animationDuration: '1s' }} />
          
          {/* Logo with pulse effect */}
          <div className="animate-pulse-subtle">
            <img
              src={logoIcon}
              alt="SoMA"
              className="h-20 w-20 drop-shadow-lg"
            />
          </div>
        </div>

        {/* Loading text with fade animation */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">SoMA</h1>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Carregando</span>
            <span className="loading-dots flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full animate-loading-progress rounded-full bg-gradient-to-r from-primary via-primary-glow to-primary" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
