import { Display } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "instructionDisplay";
export const metadata = {
  prefix: "INS",
  name: "Instruction display (4 bit)",
  pins: {
    I0: [-48, 48],
    I1: [-48, 16],
    I2: [-48, -16],
    I3: [-48, -48],
  },
  parameters: {
    threshold: 2.5,
    lookup: "0=NOP\n1=LOAD\n2-15=OP {a}",
  },
} as const;

export const output = {
  type: "instruction",
  fields: {
    threshold: {
      label: "Logic threshold · V",
      type: "number",
    },
    lookup: {
      label: "Lookup table (one value or range = text per line)",
      type: "string",
      maxLength: 4096,
    },
  },
  sign: null,
};

export function Symbol({ measured, pose }: SymbolProps) {
  return (
    <Display
      pins={metadata.pins}
      value={String(measured?.text ?? "—")}
      pose={pose}
    />
  );
}
