import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

// Morty ASCII frames — idle, talking, panicking, dancing
const FRAMES_IDLE = [
  [
    "  ╭─────╮ ",
    "  │ ·  · │ ",
    "  │  ◡   │ ",
    "  ╰──┬──╯ ",
    "    ┌┴┐   ",
    "   ─┤ ├─  ",
    "    └┬┘   ",
    "    ┌┴┐   ",
    "    ┘ └   ",
  ],
  [
    "  ╭─────╮ ",
    "  │ ·  · │ ",
    "  │  ◡   │ ",
    "  ╰──┬──╯ ",
    "    ┌┴┐   ",
    "   ─┤ ├─  ",
    "    └┬┘   ",
    "    ┌┴┐   ",
    "    └ ┘   ",
  ],
];

const FRAMES_ACTIVE = [
  [
    "  ╭─────╮ ",
    "  │ ◉  ◉ │ ",
    "  │  □   │ ",
    "  ╰──┬──╯ ",
    "   \\┌┴┐/  ",
    "    │ │   ",
    "    └┬┘   ",
    "    / \\   ",
    "   ┘   └  ",
  ],
  [
    "  ╭─────╮ ",
    "  │ ◉ ◉  │ ",
    "  │  □   │ ",
    "  ╰──┬──╯ ",
    "   /┌┴┐\\  ",
    "    │ │   ",
    "    └┬┘   ",
    "    \\ /   ",
    "   └   ┘  ",
  ],
];

const FRAMES_DANCE = [
  [
    "  ╭─────╮ ",
    "  │ ᵔ  ᵔ │ ",
    "  │  ▽   │ ",
    "  ╰──┬──╯ ",
    "  \\┌─┴─┐  ",
    "   │   │/ ",
    "   └─┬─┘  ",
    "    / \\   ",
    "   └   ┘  ",
  ],
  [
    "  ╭─────╮ ",
    "  │ ᵔ  ᵔ │ ",
    "  │  ▽   │ ",
    "  ╰──┬──╯ ",
    "   ┌─┴─┐/ ",
    "  \\│   │  ",
    "   └─┬─┘  ",
    "    \\ /   ",
    "   ┘   └  ",
  ],
];

const EYE_STATES = [
  "·  ·",  // center
  "·  ·",  // center
  "· ·",   // looking left
  " · ·",  // looking right
  "◉  ◉",  // wide
  "−  −",  // blink
  "·  ·",  // center
];

export function LogoMascot() {
  const [frame, setFrame] = useState(0);
  const [eyeState, setEyeState] = useState(0);
  const orchStatus = useAppStore((s) => s.orchStatus);
  const isSending = useAppStore((s) => s.isSending);
  const agentStatuses = useAppStore((s) => s.agentStatuses);

  const hasActiveAgent = Object.values(agentStatuses).some((s) => s === "active");
  const isWorking = isSending || hasActiveAgent;
  const isDancing = orchStatus !== "idle" && !isWorking;

  // Animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => f + 1);
    }, isWorking ? 300 : isDancing ? 400 : 800);
    return () => clearInterval(interval);
  }, [isWorking, isDancing]);

  // Random eye movement
  useEffect(() => {
    const interval = setInterval(() => {
      setEyeState(Math.floor(Math.random() * EYE_STATES.length));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  let frames: string[][];
  let color: string;
  let label: string;

  if (isWorking) {
    frames = FRAMES_ACTIVE;
    color = "#f06060";
    label = "AW JEEZ!";
  } else if (isDancing) {
    frames = FRAMES_DANCE;
    color = "#5ddb6e";
    label = "WUBBA!";
  } else {
    frames = FRAMES_IDLE;
    color = "#5dadec";
    label = "CMD CENTER";
  }

  const currentFrame = frames[frame % frames.length];

  // Replace eyes in frame with current eye state (only for idle)
  const renderedFrame = !isWorking && !isDancing
    ? currentFrame.map((line, i) => {
        if (i === 1) {
          return line.replace(/[·◉−]  [·◉−]|[·◉−] [·◉−]| [·◉−] [·◉−]/, EYE_STATES[eyeState]);
        }
        return line;
      })
    : currentFrame;

  return (
    <div className="px-2 py-2 border-b border-[#333333] flex items-center gap-2">
      <pre
        className="text-[9px] leading-[1.05] select-none"
        style={{ color }}
      >
        {renderedFrame.join("\n")}
      </pre>
      <div>
        <div className="font-bold text-xs tracking-wider" style={{ color }}>
          {label}
        </div>
        <div className="text-[#555555] text-[9px]">
          {isWorking
            ? "working..."
            : isDancing
            ? "let's go!"
            : "ready"}
        </div>
      </div>
    </div>
  );
}
