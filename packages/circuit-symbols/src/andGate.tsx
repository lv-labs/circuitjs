import { Gate } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "andGate";
export const metadata = {
  prefix: "U",
  name: "AND gate",
  pins: {
    a: [-48, -16],
    b: [-48, 16],
    out: [48, 0],
  },
  parameters: {
    highVoltage: 5,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return <Gate pins={metadata.pins} label="AND" pose={pose} />;
}
