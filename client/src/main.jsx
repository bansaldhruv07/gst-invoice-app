import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "@fontsource-variable/dm-sans";
import "./index.css";

// After a new version goes live, a page left open may ask for files that are
// gone. Reloading fetches the new ones; once only, so it cannot loop.
window.addEventListener("vite:preloadError", () => {
  try {
    const last = Number(sessionStorage.getItem("reloaded-at")) || 0;
    if (Date.now() - last < 60000) return;
    sessionStorage.setItem("reloaded-at", String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
