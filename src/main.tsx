import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter/wght.css";
import "./styles/tokens.css";
import "./styles/app.css";
import { ConfirmDialog } from "./components/ui/ConfirmDialog.tsx";
import { App } from "./App.tsx";
import { applyTheme, readTheme } from "./lib/theme.ts";

applyTheme(readTheme()); // antes do primeiro render, para não piscar

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <ConfirmDialog />
  </StrictMode>,
);
