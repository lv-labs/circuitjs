import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "latch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "U",
  name: "Latch / register (4 bit)",
  pins: {
    I0: [-48, 32],
    I1: [-48, 0],
    I2: [-48, -32],
    I3: [-48, -64],
    O0: [48, 32],
    O1: [48, 0],
    O2: [48, -32],
    O3: [48, -64],
    load: [-48, 64],
  },
  parameters: {
    highVoltage: 5,
    initialValue: 0,
    edgeTriggered: true,
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  return (
    <Chip
      pins={metadata.pins}
      labels={{ load: parameters.edgeTriggered ? "▷" : "Ld" }}
      pose={pose}
    />
  );
}
