import { describe, it, expect } from "vitest";
import { AGENT_COLORS, getColor } from "../lib/colors";

describe("Colors", () => {
  it("has all 6 agent colors", () => {
    expect(Object.keys(AGENT_COLORS)).toEqual(["blue", "green", "red", "purple", "yellow", "cyan"]);
  });

  it("each color has text, hex, letter, border", () => {
    for (const [_name, color] of Object.entries(AGENT_COLORS)) {
      expect(color.text).toBeTruthy();
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.letter).toHaveLength(1);
      expect(color.border).toBeTruthy();
    }
  });

  it("getColor returns correct color", () => {
    expect(getColor("blue").hex).toBe("#5dadec");
    expect(getColor("red").hex).toBe("#f06060");
  });

  it("getColor falls back to blue for unknown", () => {
    expect(getColor("unknown").hex).toBe("#5dadec");
  });

  it("letters match: B G R P Y C", () => {
    expect(AGENT_COLORS.blue.letter).toBe("B");
    expect(AGENT_COLORS.green.letter).toBe("G");
    expect(AGENT_COLORS.red.letter).toBe("R");
    expect(AGENT_COLORS.purple.letter).toBe("P");
    expect(AGENT_COLORS.yellow.letter).toBe("Y");
    expect(AGENT_COLORS.cyan.letter).toBe("C");
  });
});
