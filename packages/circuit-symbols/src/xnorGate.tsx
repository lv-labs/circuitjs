import { Gate } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "xnorGate";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "U",
  name: "XNOR gate",
  pins: {
    a: [-48, -16],
    b: [-48, 16],
    out: [48, 0],
  },
  parameters: {
    highVoltage: 5,
    inputCount: 2,
    propagationDelay: 0,
    schmittInputs: false,
    invertInputs: false,
  },
} as const;

export function Symbol({ pose, parameters = metadata.parameters }: SymbolProps) {
  return <Gate pins={metadata.pins} parameters={parameters} label="XNOR" pose={pose} />;
}
