import { Lead } from "../svg";

export const kind = "diode";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "D",
  name: "Diode",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
  },
  parameters: { model: "default" },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-16, 0]} />
      <Lead from={metadata.pins.cathode} to={[16, 0]} />
      <path d="M-16-16V16L16 0Z" />
      <path d="M16-16V16" />
    </>
  );
}
