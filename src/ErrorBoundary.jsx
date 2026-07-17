import { Component } from "react";
import { C, FONT } from "./lib/tokens.js";

/* Error boundary GLOBAL : toute exception non catchée pendant un rendu React
   blanchissait l'écran (page bleue vide, aucun message). Ici on affiche un
   écran d'erreur lisible + recharger, et on log l'erreur en console pour
   diagnostic. Complète la sentinelle ES5 d'index.html (qui couvre, elle, les
   erreurs AVANT le montage React : bundle qui ne parse pas, import qui casse). */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || String(this.state.error);
    return (
      <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.coral, marginBottom: 8 }}>Une erreur est survenue</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", wordBreak: "break-word", marginBottom: 14 }}>{msg}</div>
          <button onClick={() => window.location.reload()} style={{ background: C.coral, border: "none", borderRadius: 10, padding: "11px 16px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Recharger</button>
        </div>
      </div>
    );
  }
}
