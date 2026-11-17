import { Lead } from "../svg";

export const kind = "tappedTransformer";
export const metadata = {
  prefix: "T",
  name: "Tapped transformer",
  pins: {
    p1: [-32, -48],
    p2: [-32, 48],
    s1: [32, -48],
    tap: [32, 0],
    s2: [32, 48],
  },
  parameters: {
    inductance: 4,
    ratio: 1,
    coupling: 0.99,
    integration: "backwardEuler",
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.p1} to={[-32, -24]} />
      <Lead from={metadata.pins.p2} to={[-32, 24]} />
      <Lead from={metadata.pins.s1} to={[32, -24]} />
      <Lead from={metadata.pins.s2} to={[32, 24]} />
      <path d="M-32-24C-10-24-10-12-32-12C-10-12-10 0-32 0C-10 0-10 12-32 12C-10 12-10 24-32 24M32-24C10-24 10-12 32-12C10-12 10 0 32 0C10 0 10 12 32 12C10 12 10 24 32 24M-5-28V28M5-28V28" />
      <Lead from={metadata.pins.tap} to={[32, 0]} />
      <circle cx={32} r={2} fill="currentColor" />
    </>
  );
}
