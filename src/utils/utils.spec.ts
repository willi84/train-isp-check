import { normalizeText } from "./utils.js";

describe("normalizeText()", () => {
  const FN = normalizeText;

  it("should return empty string for null or undefined", () => {
    expect(FN(null)).toBe("");
    expect(FN(undefined)).toBe("");
  });

  it("should trim and lowercase the string", () => {
    expect(FN("  Hello World  ")).toBe("hello world");
  });

  it("should remove diacritics", () => {
    expect(FN("éàè")).toBe("eae");
  });
});
