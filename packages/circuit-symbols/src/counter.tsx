import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "counter";
export const metadata = {
  prefix: "U",
  name: "Counter (4 bit)",
  pins: {
    clock: [-48, -48],
    reset: [-48, 48],
    Q3: [48, -48],
    Q2: [48, -16],
    Q1: [48, 16],
    Q0: [48, 48],
  },
  parameters: {
    highVoltage: 5,
    initialValue: 0,
    modulus: 0,
    invertReset: true,
    negativeEdge: false,
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  return (
    <Chip
      pins={metadata.pins}
      labels={{
        clock: parameters.negativeEdge ? "○▷" : "▷",
        reset: parameters.invertReset ? "R̅" : "reset",
      }}
      pose={pose}
    />
  );
}
