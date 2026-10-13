import { expect, it } from "vitest";
import { configuredAiModels, defaultAiWritingSettings } from "../src/shared/ai-writing";
import {
  aiModelInputFields,
  aiModelInputIds,
  aiModelListFields,
} from "../src/client/ai/model-settings";

it("keeps editable row order when the default changes and includes legacy single models", () => {
  expect(
    aiModelInputIds({
      ...defaultAiWritingSettings,
      openaiModel: "second",
      openaiModels: ["first", "second"],
    }),
  ).toEqual(["first", "second"]);
  expect(aiModelInputIds({ ...defaultAiWritingSettings, openaiModel: "legacy" })).toEqual([
    "legacy",
  ]);
});

it("omits blank rows from saved models, preserves draft errors, and follows renamed defaults", () => {
  const settings = {
    ...defaultAiWritingSettings,
    openaiModel: "old",
    openaiModels: ["old", "second"],
  };
  expect(aiModelInputFields(settings, ["new", "second", ""], "new")).toEqual({
    openaiModel: "new",
    openaiModels: ["new", "second"],
  });
  expect(aiModelInputFields(settings, ["", "second"])).toEqual({
    openaiModel: "second",
    openaiModels: ["second"],
  });
  expect(
    aiModelInputFields(settings, ["duplicate", "duplicate", "bad\nmodel"]).openaiModels,
  ).toEqual(["duplicate", "duplicate", "bad\nmodel"]);
});

it("merges imported models with legacy and manual models while preserving the default", () => {
  const settings = { ...defaultAiWritingSettings, openaiModel: "legacy", openaiModels: ["manual"] };
  expect(aiModelListFields(settings, [...configuredAiModels(settings), "manual", " new "])).toEqual(
    {
      openaiModel: "legacy",
      openaiModels: ["legacy", "manual", "new"],
    },
  );
});

it("selects a remaining model when the default is deleted and clears the last model", () => {
  const settings = {
    ...defaultAiWritingSettings,
    openaiModel: "first",
    openaiModels: ["first", "second"],
  };
  const fields = aiModelListFields(settings, ["second"]);
  expect(configuredAiModels({ ...settings, ...fields })).toEqual(["second"]);
  expect(fields.openaiModel).toBe("second");
  expect(aiModelListFields({ ...settings, ...fields }, [])).toEqual({
    openaiModel: "",
    openaiModels: [],
  });
});

it("initializes an empty provider list without modifying the other provider", () => {
  expect(
    aiModelListFields({ ...defaultAiWritingSettings, provider: "anthropic", openaiModel: "kept" }, [
      "claude",
    ]),
  ).toEqual({
    anthropicModel: "claude",
    anthropicModels: ["claude"],
  });
});

it("deduplicates before applying the 100 model limit and rejects secret or invalid IDs", () => {
  const values = [
    "",
    " ",
    "ok",
    "ok",
    "sk-" + "synthetic".repeat(8),
    "a".repeat(161),
    "bad\nmodel",
    ...Array.from({ length: 105 }, (_, index) => `model-${index}`),
  ];
  const fields = aiModelListFields(defaultAiWritingSettings, values);
  expect(fields.openaiModels).toHaveLength(100);
  expect(fields.openaiModels).toEqual([
    "ok",
    ...Array.from({ length: 99 }, (_, index) => `model-${index}`),
  ]);
  expect(fields.openaiModel).toBe("ok");
});
