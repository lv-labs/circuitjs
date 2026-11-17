import { Lead } from "../svg";

export const kind = "photoresistor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "R",
  name: "Photoresistor",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    position: 0.34,
  },
} as const;
export const output = {
  type: "374",
  fields: {
    position: {
      label: "Sensor position · 0 to 1",
      type: "number",
      min: 0,
      max: 1,
    },
  },
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-22, 0]} />
      <Lead from={metadata.pins.b} to={[22, 0]} />
      <path d="M-22-8H22V8H-22ZM-13-24L-4-13M-10-13H-4V-19M3-26L12-15M6-15H12V-21" />
    </>
  );
}
