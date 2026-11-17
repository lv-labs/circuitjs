import { Display } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "decimalDisplay";
export const metadata = {
  prefix: "DISP",
  name: "Decimal display (4 bit)",
  pins: {
    I0: [-48, 48],
    I1: [-48, 16],
    I2: [-48, -16],
    I3: [-48, -48],
  },
  parameters: {
    mode: 0,
  },
} as const;

export const output = {
  type: "419",
  fields: {
    mode: {
      label: "Base (0 decimal, 1 hex, 2 octal)",
      type: "number",
      min: 0,
      max: 2,
      integer: true,
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
