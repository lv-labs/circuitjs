import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "dFlipFlop";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "U",
  name: "D flip-flop",
  pins: {
    D: [-48, -16],
    clock: [-48, 16],
    Q: [48, -16],
    Qn: [48, 16],
  },
  parameters: {
    highVoltage: 5,
    initialState: false,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return (
    <Chip pins={metadata.pins} labels={{ clock: "▷", Qn: "Q̅" }} pose={pose} />
  );
}
