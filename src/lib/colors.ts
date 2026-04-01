export const AGENT_COLORS: Record<
  string,
  { text: string; hex: string; letter: string; border: string }
> = {
  blue: {
    text: "text-[#5dadec]",
    hex: "#5dadec",
    letter: "B",
    border: "border-[#5dadec]",
  },
  green: {
    text: "text-[#5ddb6e]",
    hex: "#5ddb6e",
    letter: "G",
    border: "border-[#5ddb6e]",
  },
  red: {
    text: "text-[#f06060]",
    hex: "#f06060",
    letter: "R",
    border: "border-[#f06060]",
  },
  purple: {
    text: "text-[#c88dff]",
    hex: "#c88dff",
    letter: "P",
    border: "border-[#c88dff]",
  },
  yellow: {
    text: "text-[#e8d44d]",
    hex: "#e8d44d",
    letter: "Y",
    border: "border-[#e8d44d]",
  },
  cyan: {
    text: "text-[#4de8e0]",
    hex: "#4de8e0",
    letter: "C",
    border: "border-[#4de8e0]",
  },
};

export function getColor(color: string) {
  return AGENT_COLORS[color] ?? AGENT_COLORS.blue;
}
