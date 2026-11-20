import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@ui-sdk/core/web.css";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

let storedTheme: string | null = null;
try {
  storedTheme = localStorage.getItem("utw-theme");
} catch {
  storedTheme = null;
}
document.documentElement.dataset.theme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

mount(App, { target: document.getElementById("app")! });

const env = (import.meta as ImportMeta & { env?: Record<string, boolean> }).env;
if (env?.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
