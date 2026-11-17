import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "output";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
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
