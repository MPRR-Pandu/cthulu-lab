// ASCII sprites for each agent species (from buddy system, frame 0)
export const AGENT_SPRITES: Record<string, string[]> = {
  owl: [
    "  /\\  /\\  ",
    " ((·)(·)) ",
    " (  ><  ) ",
    "  `----´  ",
  ],
  robot: [
    "  .[||].  ",
    " [ ·  · ] ",
    " [ ==== ] ",
    " `------´ ",
  ],
  dragon: [
    " /^\\  /^\\ ",
    "<  ·  ·  >",
    "(   ~~   )",
    " `-vvvv-´ ",
  ],
  cat: [
    "  /\\_/\\   ",
    " ( ·   ·) ",
    " (  ω  )  ",
    " (\")_(\")  ",
  ],
  turtle: [
    "  _,--._  ",
    " ( ·  · ) ",
    "/[______]\\",
    " ``    `` ",
  ],
  octopus: [
    "  .----.  ",
    " ( ·  · ) ",
    " (______) ",
    " /\\/\\/\\/\\ ",
  ],
  blob: [
    "  .----.  ",
    " ( ·  · ) ",
    " (      ) ",
    "  `----´  ",
  ],
};

export function getSprite(species: string): string[] {
  return AGENT_SPRITES[species] ?? AGENT_SPRITES.blob;
}
