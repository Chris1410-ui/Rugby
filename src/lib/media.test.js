import { describe, it, expect } from "vitest";
import { detectPlatform, instagramCode, instagramEmbed, mediaThumb, mediaEmbed } from "./media.js";

describe("detectPlatform", () => {
  it("reconnaît YouTube / Instagram / autre", () => {
    expect(detectPlatform("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatform("https://www.instagram.com/reel/CxYz12aBc/")).toBe("instagram");
    expect(detectPlatform("https://vimeo.com/12345")).toBe("autre");
    expect(detectPlatform("")).toBe("autre");
  });
});

describe("instagram helpers", () => {
  it("extrait le code et construit l'embed", () => {
    expect(instagramCode("https://www.instagram.com/reel/CxYz12aBc/")).toBe("CxYz12aBc");
    expect(instagramCode("https://www.instagram.com/p/AbC_dEf/?utm=1")).toBe("AbC_dEf");
    expect(instagramCode("https://youtu.be/x")).toBe(null);
    expect(instagramEmbed("https://www.instagram.com/p/AbC_dEf/")).toBe("https://www.instagram.com/p/AbC_dEf/embed");
  });
});

describe("mediaThumb", () => {
  it("privilégie thumb_url, sinon vignette YouTube, sinon null", () => {
    expect(mediaThumb({ thumbUrl: "https://x/y.jpg" })).toBe("https://x/y.jpg");
    expect(mediaThumb({ url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(mediaThumb({ url: "https://vimeo.com/1" })).toBe(null);
  });
});

describe("mediaEmbed", () => {
  it("embed YouTube puis Instagram, sinon null", () => {
    expect(mediaEmbed({ url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(mediaEmbed({ url: "https://www.instagram.com/reel/CxYz12aBc/" })).toBe("https://www.instagram.com/p/CxYz12aBc/embed");
    expect(mediaEmbed({ url: "https://vimeo.com/1" })).toBe(null);
  });
});
