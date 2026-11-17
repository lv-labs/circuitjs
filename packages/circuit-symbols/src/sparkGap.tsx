import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "sparkGap";
export const metadata = {
  prefix: "R",
  name: "Spark gap",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    onResistance: 1000,
    offResistance: 1000000000,
    breakdownVoltage: 1000,
    holdingCurrent: 0.001,
  },
} as const;
export const output = {
  type: "187",
  fields: {
    onResistance: {
      label: "On resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    offResistance: {
      label: "Off resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    breakdownVoltage: {
      label: "Breakdown voltage · V",
      type: "number",
      exclusiveMin: 0,
    },
    holdingCurrent: {
      label: "Holding current · A",
      type: "number",
      min: 0,
    },
  },
  sign: 1,
};
export function Symbol({ measured }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-16, 0]} />
      <Lead from={metadata.pins.b} to={[16, 0]} />
      <path d="M-16 0H-6L-2-5M16 0H6L2 5" />
      {measured?.conducting && <path d="M-6 0L-2 3L2-3L6 0" />}
    </>
  );
}
