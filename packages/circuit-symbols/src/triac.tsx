import { Lead } from "../svg";
export const kind = "triac";
export const metadata = {
  name: "TRIAC",
  prefix: "D",
  pins: {
    mt2: [-48, 0],
    mt1: [48, 0],
    gate: [16, 32],
  },
  parameters: {
    triggerCurrent: 0.01,
    holdingCurrent: 0.0082,
    gateResistance: 100,
  },
} as const;
export const output = {
  type: "206",
  fields: {
    triggerCurrent: {
      label: "Trigger current · A",
      type: "number",
      exclusiveMin: 0,
    },
    holdingCurrent: {
      label: "Holding current · A",
      type: "number",
      exclusiveMin: 0,
    },
    gateResistance: {
      label: "Gate resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
  },
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.mt2} to={[-16, 0]} />
      <Lead from={metadata.pins.mt1} to={[16, 0]} />
      <Lead from={metadata.pins.gate} to={[6, 11]} />

      <path d="M-16-14V14M16-14V14M-16-12L16-6L-16 0ZM16 0L-16 6L16 12Z" />
    </>
  );
}
