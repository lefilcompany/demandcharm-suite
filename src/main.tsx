import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import App from "./App.tsx";
import LoadingScreen from "./components/LoadingScreen.tsx";
import "./index.css";
import "./lib/i18n";
import { installChunkReloadHandler } from "./lib/chunkReload";

installChunkReloadHandler();

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<LoadingScreen />}>
    <App />
  </Suspense>
);
