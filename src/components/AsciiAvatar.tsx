import { getSprite } from "../lib/sprites";
import { getColor } from "../lib/colors";

interface Props {
  species: string;
  color: string;
}

export function AsciiAvatar({ species, color }: Props) {
  const sprite = getSprite(species);
  const { text } = getColor(color);

  return (
    <pre className={`${text} text-[10px] font-mono leading-tight select-none`}>
      {sprite.join("\n")}
    </pre>
  );
}
