import { describe, it, expect } from "vitest";
import { AGENT_SPRITES, getSprite } from "../lib/sprites";

describe("Sprites", () => {
  it("has sprites for all species", () => {
    const species = ["owl", "robot", "dragon", "cat", "turtle", "octopus", "blob"];
    for (const s of species) {
      expect(AGENT_SPRITES[s]).toBeDefined();
      expect(AGENT_SPRITES[s].length).toBeGreaterThan(0);
    }
  });

  it("each sprite is array of strings", () => {
    for (const [_name, frames] of Object.entries(AGENT_SPRITES)) {
      expect(Array.isArray(frames)).toBe(true);
      for (const line of frames) {
        expect(typeof line).toBe("string");
      }
    }
  });

  it("getSprite returns correct sprite", () => {
    expect(getSprite("owl")).toBe(AGENT_SPRITES.owl);
  });

  it("getSprite falls back to blob for unknown", () => {
    expect(getSprite("unknown")).toBe(AGENT_SPRITES.blob);
  });
});
