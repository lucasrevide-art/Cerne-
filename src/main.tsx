import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./App.tsx";
import { applyTheme, readTheme } from "./lib/theme.ts";

applyTheme(readTheme()); // antes do primeiro render, para não piscar

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
