import { Lead } from "../svg";
export const kind = "diac";
export const metadata = {
  name: "DIAC",
  prefix: "D",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    onResistance: 500,
    offResistance: 100000000,
    breakdownVoltage: 30,
    holdingCurrent: 0.01,
  },
} as const;
export const output = {
  type: "203",
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
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-16, 0]} />
      <Lead from={metadata.pins.b} to={[16, 0]} />

      <path d="M-16-14V14M16-14V14M-16-12L16-6L-16 0ZM16 0L-16 6L16 12Z" />
    </>
  );
}
