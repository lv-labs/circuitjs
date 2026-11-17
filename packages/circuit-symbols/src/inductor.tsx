import { Lead } from "../svg";

export const kind = "inductor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "L",
  name: "Inductor",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    inductance: 1,
    initialCurrent: 0,
    integration: "backwardEuler",
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-24, 0]} />
      <Lead from={metadata.pins.b} to={[24, 0]} />
      <path d="M-24 0C-24-22-12-22-12 0C-12-22 0-22 0 0C0-22 12-22 12 0C12-22 24-22 24 0" />
    </>
  );
}
