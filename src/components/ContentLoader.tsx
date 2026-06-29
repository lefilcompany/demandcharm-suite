import logoIcon from "@/assets/logo-soma-icon.png";

/**
 * Loader used inside the protected layout shell.
 * Preserves the surrounding chrome (dark sidebar + white board panel)
 * and shows a centered logo with an animated ring + subtle skeleton lines.
 */
export function ContentLoader() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 py-12">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 -m-5 animate-spin-slow rounded-full border-4 border-transparent border-t-primary/30" />
        <div
          className="absolute inset-0 -m-2.5 animate-spin rounded-full border-2 border-transparent border-t-primary"
          style={{ animationDuration: "1s" }}
        />
        <img
          src={logoIcon}
          alt="SoMA"
          className="h-16 w-16 drop-shadow-md animate-pulse-subtle"
        />
      </div>

      <div className="w-full max-w-3xl space-y-3 px-4">
        <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted/70" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

export default ContentLoader;
