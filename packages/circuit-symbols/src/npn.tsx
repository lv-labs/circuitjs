import type { SymbolProps } from "../svg";
import { Lead } from "../svg";

export const kind = "npn";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "Q",
  name: "NPN transistor",
  pins: {
    base: [-48, 0],
    collector: [48, -16],
    emitter: [48, 16],
  },
  parameters: {
    beta: 100,
    model: "default",
    swapTerminals: false,
    drawCircle: false,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  return (
    <g transform={parameters.swapTerminals ? "scale(1 -1)" : undefined}>
      {parameters.drawCircle === true && <circle cx={4} r={28} />}
      <Lead from={metadata.pins.base} to={[-12, 0]} />
      <Lead from={metadata.pins.collector} to={[16, -16]} />
      <Lead from={metadata.pins.emitter} to={[16, 16]} />
      <path d="M-12-20V20M-12-8L16 -16M-12 8L16 16" />
      <path d="M7 8L16 16L5 17" />
    </g>
  );
}
