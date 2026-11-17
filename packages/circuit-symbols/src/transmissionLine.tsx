import { Lead } from "../svg";

export const kind = "transmissionLine";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "TL",
  name: "Transmission line",
  pins: {
    leftReturn: [-48, 16],
    rightReturn: [48, 16],
    left: [-48, -16],
    right: [48, -16],
  },
  parameters: {
    delay: 0.001,
    impedance: 75,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.left} to={[-24, -16]} />
      <Lead from={metadata.pins.leftReturn} to={[-24, 16]} />
      <Lead from={metadata.pins.right} to={[24, -16]} />
      <Lead from={metadata.pins.rightReturn} to={[24, 16]} />
      <path d="M-24-24H24V24H-24ZM-24-8H24M-24 8H24" />
    </>
  );
}
