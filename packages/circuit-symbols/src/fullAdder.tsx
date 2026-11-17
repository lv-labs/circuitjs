import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "fullAdder";
export const metadata = {
  prefix: "U",
  name: "Adder (4 bit)",
  pins: {
    A0: [-48, -32],
    A1: [-48, -64],
    A2: [-48, -96],
    A3: [-48, -128],
    B0: [-48, 96],
    B1: [-48, 64],
    B2: [-48, 32],
    B3: [-48, 0],
    S0: [48, 32],
    S1: [48, 0],
    S2: [48, -32],
    S3: [48, -64],
    carryIn: [-48, 128],
    carryOut: [48, -128],
  },
  parameters: {
    highVoltage: 5,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return (
    <Chip
      pins={metadata.pins}
      labels={{ carryIn: "Cin", carryOut: "Cout" }}
      pose={pose}
    />
  );
}
