import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AtlasApp } from "@/atlas-app/AtlasApp";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <AtlasApp />
  </StrictMode>,
);
