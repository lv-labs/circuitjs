import { Lead } from "../svg";

export const kind = "currentSource";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "I",
  name: "DC current source",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    current: 0.01,
    maxVoltage: 0,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-24, 0]} />
      <Lead from={metadata.pins.b} to={[24, 0]} />
      <circle r={24} />
      <path d="M-12 0H12M4-7L12 0L4 7" />
    </>
  );
}
