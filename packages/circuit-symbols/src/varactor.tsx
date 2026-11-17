import { Lead } from "../svg";
export const kind = "varactor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  name: "Varactor",
  prefix: "D",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
  },
  parameters: {
    capacitance: 4e-12,
  },
} as const;
export const output = {
  type: "176",
  fields: {
    capacitance: {
      label: "Zero-bias capacitance · F",
      type: "number",
      exclusiveMin: 0,
    },
  },
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-15, 0]} />
      <Lead from={metadata.pins.cathode} to={[12, 0]} />

      <path d="M-15-13V13L6 0ZM6-15V15M12-15V15" />
    </>
  );
}
