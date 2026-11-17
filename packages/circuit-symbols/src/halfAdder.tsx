import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "halfAdder";
export const metadata = {
  prefix: "U",
  name: "Half adder",
  pins: {
    sum: [48, -16],
    carry: [48, 16],
    A: [-48, -16],
    B: [-48, 16],
  },
  parameters: {
    highVoltage: 5,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return <Chip pins={metadata.pins} pose={pose} />;
}
