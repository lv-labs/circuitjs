import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "logicOutput";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "M",
  name: "Logic output",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    threshold: 2.5,
    mode: "logic",
    pulldown: false,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return <TerminalBox pin={metadata.pins.in} label="L/H" pose={pose} />;
}
