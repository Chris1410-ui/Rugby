import { Component } from "react";
import i18n from "./i18n/config.js";
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

    // Mode COMPACT : boundary local (ex. autour d'une modale) — un plantage de
    // rendu affiche une carte d'erreur lisible SANS blanchir toute l'app. Un
    // bouton « fermer » (onClose) permet de sortir plutôt que de recharger.
    if (this.props.compact) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "#fff", lineHeight: 1.6 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.coral, marginBottom: 8 }}>{i18n.t("shared.error.title")}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", wordBreak: "break-word", marginBottom: 14 }}>{msg}</div>
          {this.props.onClose && (
            <button onClick={this.props.onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 16px", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{i18n.t("common.close")}</button>
          )}
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.coral, marginBottom: 8 }}>{i18n.t("shared.error.title")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", wordBreak: "break-word", marginBottom: 14 }}>{msg}</div>
          <button onClick={() => window.location.reload()} style={{ background: C.coral, border: "none", borderRadius: 10, padding: "11px 16px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{i18n.t("shared.error.reload")}</button>
        </div>
      </div>
    );
  }
}
