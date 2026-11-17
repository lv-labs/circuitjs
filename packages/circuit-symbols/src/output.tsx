import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "output";
export const metadata = {
  prefix: "O",
  name: "Output marker",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    showVoltage: true,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return <TerminalBox pin={metadata.pins.in} label="out" pose={pose} />;
}
