import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@ui-sdk/core/web.css";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
