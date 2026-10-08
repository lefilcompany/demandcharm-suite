import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import App from "./App.tsx";
import LoadingScreen from "./components/LoadingScreen.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.tsx";
import "./index.css";
import "./lib/i18n";
import { installChunkReloadHandler } from "./lib/chunkReload";

installChunkReloadHandler();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      <App />
    </Suspense>
  </AppErrorBoundary>
);
