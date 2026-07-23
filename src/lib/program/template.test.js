import { describe, it, expect } from "vitest";
import { renderProgramHtml } from "./template.js";
import { normalizeProgram } from "./model.js";

const sample = normalizeProgram({
  meta: {
    badge: { big: "C1", tag: "Haut niveau" },
    eyebrow: "Intersaison",
    title: "Revenir *prêt*",
    lede: "Un **seul** protocole.",
    facts: [{ n: "4", label: "semaines", accent: "c" }, { n: "2", label: "profils", accent: "a" }],
    sources: "Sources",
    mantra: "Travailler *aujourd'hui*",
  },
  sections: [
    { type: "narrative", num: "01", title: "Cadre & objectifs", subtitle: "Pourquoi", body: "Un para.\n\n- point un\n- point deux\n\n> Un encadré." },
    {
      type: "exercises", num: "06", title: "Musculation", weekAccents: ["c", "a"],
      rows: [
        { block: "A1", name: "Squat", tempo: "2010", rest: "E4MOM", weeks: [{ text: "4×8 R7" }, { text: "4×6 R8", peak: true }], note: "Amplitude" },
        { block: "A2", name: "Développé", exerciseRef: "0001", exerciseId: "u1", weeks: [{ text: "3×10" }, { text: "3×8" }], note: "" },
      ],
    },
  ],
}, 2);

describe("renderProgramHtml", () => {
  it("produit un document HTML complet", () => {
    const html = renderProgramHtml(sample);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("class=\"hero\"");
  });

  it("rend le hero (badge, accroche avec accent, chiffres-clés)", () => {
    const html = renderProgramHtml(sample);
    expect(html).toContain(">C1<");
    expect(html).toContain("Revenir <em>prêt</em>"); // *accent* → <em>
    expect(html).toContain("semaines");
    expect(html).toContain("profils");
  });

  it("rend les sections narratives en Markdown-léger", () => {
    const html = renderProgramHtml(sample);
    expect(html).toContain("Cadre &amp; objectifs"); // titre échappé
    expect(html).toContain("<li>point un</li>");
    expect(html).toContain("class=\"callout\"");
    expect(html).toContain("<b>seul</b>"); // **gras** dans le lede
  });

  it("rend le tableau d'exercices avec pic et blocs colorés", () => {
    const html = renderProgramHtml(sample);
    expect(html).toContain("Squat");
    expect(html).toContain("class=\"peak\">★"); // top set
    expect(html).toMatch(/class="blk b-a"/); // bloc A → ambre
  });

  it("exercice lié : span statique par défaut, <a> en mode interactif", () => {
    const stat = renderProgramHtml(sample);
    expect(stat).toContain("class=\"exlinked\"");
    expect(stat).not.toContain("data-ex-ref");
    const inter = renderProgramHtml(sample, { interactive: true });
    expect(inter).toContain("data-ex-ref=\"0001\"");
    expect(inter).toContain("postMessage");
  });

  it("affiche une vignette si un média est fourni", () => {
    const html = renderProgramHtml(sample, { exercisesByRef: { "0001": { gifUrl: "https://x/y.gif", attribution: "©" } } });
    expect(html).toContain("class=\"exthumb\"");
    expect(html).toContain("y.gif");
  });

  it("échappe le HTML injecté", () => {
    const html = renderProgramHtml(normalizeProgram({ sections: [{ type: "exercises", rows: [{ name: "<script>x</script>", weeks: [{ text: "" }] }] }] }, 1));
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("nav : une ancre par section", () => {
    const html = renderProgramHtml(sample);
    expect(html).toContain("href=\"#cadre-objectifs-0\"");
    expect(html).toContain("href=\"#musculation-1\"");
    expect(html).toContain("id=\"musculation-1\"");
  });
});
