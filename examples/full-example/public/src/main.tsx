import { render, h } from "preact";
//import "./styles/main.css";
import { App } from "./App";

const root = document.getElementById("app");
if (root) {
  render(h(App, null), root);
}
