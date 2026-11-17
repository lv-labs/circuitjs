import { Lead } from "../svg";
export const kind = "scr";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  name: "SCR",
  prefix: "D",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
    gate: [16, 32],
  },
  parameters: {
    triggerCurrent: 0.01,
    holdingCurrent: 0.0082,
    gateResistance: 50,
  },
} as const;
export const output = {
  type: "177",
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
  sign: null,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-16, 0]} />
      <Lead from={metadata.pins.cathode} to={[16, 0]} />
      <Lead from={metadata.pins.gate} to={[6, 11]} />

      <path d="M-16-16V16L16 0ZM16-16V16" />
    </>
  );
}
