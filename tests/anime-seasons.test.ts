import { expect, it } from "vitest";
import { parse } from "yaml";
import {
  animeSeasonId,
  animeSeasonMonths,
  animeSeasonTemplate,
  groupAnimeSeasons,
} from "../src/shared/anime-seasons";
import { animeSeasonAuthor, removeAnimeSeasonFlags } from "../src/lib/server/anime-season-format";
import { splitArticleSource } from "../src/lib/articles/article-source";

it.each(animeSeasonMonths)(
  "generates the %s-month season metadata with a safe historical author",
  (month) => {
    const author = 'ee268: "quoted"\nnext line';
    const source = animeSeasonTemplate("2026", month, author);
    expect(animeSeasonId("2026", month)).toBe(`2026/${month}月.md`);
    expect(parse(splitArticleSource(source)!.yaml)).toEqual({
      cover: "http:://example.com",
      title: `2026年${month}月新番`,
      date: `2026/${String(month).padStart(2, "0")}/01`,
      author,
    });
  },
);

it("rejects years or months outside the supported selection", () => {
  for (const year of ["26", "2026/..", "0000", "10000"])
    expect(() => animeSeasonId(year, 1)).toThrow();
  for (const month of [0, 2, 3, 12, 13])
    expect(() => animeSeasonTemplate("2026", month, "")).toThrow();
});

it("groups years newest first and keeps the four quarters in calendar order", () => {
  const entries = ["2025/7月.md", "2026/10月.md", "2026/4月.md", "2026/1月.md", "2026/7月.md"].map(
    (id) => ({ id }),
  );
  expect(
    groupAnimeSeasons(entries).map(({ year, items }) => [year, items.map((item) => item.id)]),
  ).toEqual([
    ["2026", ["2026/1月.md", "2026/4月.md", "2026/7月.md", "2026/10月.md"]],
    ["2025", ["2025/7月.md"]],
  ]);
});

it.each(["\n", "\r\n"])(
  "removes only top-level season flags while preserving the body and %j newlines",
  (newline) => {
    const source = [
      "---",
      "title: Example",
      "comments: true",
      "author: ee268",
      "copyright: true",
      "custom:",
      "  comments: keep",
      "---",
      "",
      "{% 496276 %}",
      "comments: body text",
      "---",
      "",
    ].join(newline);
    const result = removeAnimeSeasonFlags(source);
    expect(parse(splitArticleSource(result)!.yaml)).toEqual({
      title: "Example",
      author: "ee268",
      custom: { comments: "keep" },
    });
    expect(splitArticleSource(result)!.body).toBe(splitArticleSource(source)!.body);
    expect(removeAnimeSeasonFlags(result)).toBe(result);
    expect(animeSeasonAuthor(result)).toBe("ee268");
    if (newline === "\r\n") expect(result.replace(/\r\n/g, "")).not.toContain("\n");
  },
);

it("rejects invalid YAML before saving and ignores it for author inference", () => {
  for (const source of ["plain body", "---\n[broken\n---\n", "---\n- item\n---\n"])
    expect(() => removeAnimeSeasonFlags(source)).toThrow();
  expect(animeSeasonAuthor("plain body")).toBe("");
});
