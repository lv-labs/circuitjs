import { Lead } from "../svg";

export const kind = "opamp";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "U",
  name: "Op-amp",
  pins: {
    minus: [-48, -16],
    plus: [-48, 16],
    out: [48, 0],
  },
  parameters: {
    gain: 100000,
    minOutput: -15,
    maxOutput: 15,
  },
} as const;

export const presets = {
  opampPlusTop: {
    name: "Op-amp (+ on top)",
  },
};

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.minus} to={[-24, -16]} />
      <Lead from={metadata.pins.plus} to={[-24, 16]} />
      <Lead from={metadata.pins.out} to={[32, 0]} />
      <path d="M-24-32V32L32 0ZM-18-16H-10M-18 16H-10M-14 12V20" />
    </>
  );
}
