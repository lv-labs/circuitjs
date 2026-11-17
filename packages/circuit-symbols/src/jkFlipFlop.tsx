import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "jkFlipFlop";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "U",
  name: "JK flip-flop",
  pins: {
    J: [-48, -32],
    clock: [-48, 0],
    K: [-48, 32],
    Q: [48, -32],
    Qn: [48, 32],
  },
  parameters: {
    highVoltage: 5,
    initialState: false,
    positiveEdge: false,
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  return (
    <Chip
      pins={metadata.pins}
      labels={{ clock: parameters.positiveEdge ? "▷" : "○▷", Qn: "Q̅" }}
      pose={pose}
    />
  );
}
