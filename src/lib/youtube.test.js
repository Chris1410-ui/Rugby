import { describe, it, expect } from "vitest";
import { youtubeId, youtubeEmbed, safeVideoUrl, hasVideo } from "./youtube.js";

describe("youtubeId", () => {
  it("parses watch URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/watch?list=PL&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses short / shorts / embed forms", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("accepts a bare id", () => {
    expect(youtubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-YouTube / empty", () => {
    expect(youtubeId("")).toBeNull();
    expect(youtubeId(null)).toBeNull();
    expect(youtubeId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });
});

describe("youtubeEmbed", () => {
  it("builds an embed URL from any accepted form", () => {
    expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
  it("is null when not YouTube", () => {
    expect(youtubeEmbed("https://vimeo.com/12345")).toBeNull();
  });
});

describe("safeVideoUrl", () => {
  it("keeps http(s) links (non-YouTube included)", () => {
    expect(safeVideoUrl("https://vimeo.com/12345")).toBe("https://vimeo.com/12345");
  });
  it("normalises a bare YouTube id to a watch URL", () => {
    expect(safeVideoUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
  it("rejects dangerous / non-http schemes", () => {
    expect(safeVideoUrl("javascript:alert(1)")).toBeNull();
    expect(safeVideoUrl("")).toBeNull();
    expect(safeVideoUrl(null)).toBeNull();
  });
});

describe("hasVideo", () => {
  it("is true for usable links, false otherwise", () => {
    expect(hasVideo("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(hasVideo("")).toBe(false);
    expect(hasVideo("javascript:alert(1)")).toBe(false);
  });
});
