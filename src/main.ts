import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@ui-sdk/core/web.css";
import "./app.css";
import { hydrate, mount } from "svelte";
import LandingApp from "./LandingApp.svelte";
import { isLandingRoute } from "./lib/route.ts";

let storedTheme: string | null = null;
try {
  storedTheme = localStorage.getItem("utw-theme");
} catch {
  storedTheme = null;
}
document.documentElement.dataset.theme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

const target = document.getElementById("app")!;
// The build inlines the landing page for `/`; hydrate that markup instead of
// throwing it away.
const prerendered = target.firstElementChild !== null;
const onLanding = () => isLandingRoute(location.pathname, location.hash);
let mounted: "landing" | "app" = "landing";

function renderLanding(hydratable: boolean) {
  if (hydratable) {
    try {
      hydrate(LandingApp, { target });
      return;
    } catch {
      // Prerendered markup drift must never leave a blank page.
    }
  }
  target.replaceChildren();
  mount(LandingApp, { target });
}

async function renderApp() {
  // The tool shell is its own chunk: a landing-page visitor never downloads the
  // unpackers, archive readers or licensing client.
  const { default: App } = await import("./App.svelte");
  target.replaceChildren();
  mount(App, { target });
}

if (onLanding()) {
  renderLanding(prerendered);
} else {
  mounted = "app";
  void renderApp();
}

window.addEventListener("hashchange", () => {
  const landing = onLanding();
  if (landing && mounted === "app") {
    mounted = "landing";
    renderLanding(false);
  } else if (!landing && mounted === "landing") {
    mounted = "app";
    void renderApp();
  }
});

const env = (import.meta as ImportMeta & { env?: Record<string, boolean> }).env;
if (env?.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
