import { Lead } from "../svg";

export const kind = "customTransformer";
export const metadata = {
  prefix: "T",
  name: "Custom transformer (three windings)",
  pins: {
    p1a: [-32, -64],
    p1b: [-32, -32],
    p2a: [-32, 0],
    p2b: [-32, 64],
    sa: [32, -64],
    sb: [32, 64],
  },
  parameters: {
    inductance: 4,
    coupling: 0.999,
    turns1: 1,
    turns2: 1,
    turns3: 1,
    integration: "backwardEuler",
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.p1a} to={[-32, -56]} />
      <Lead from={metadata.pins.p1b} to={[-32, -40]} />
      <Lead from={metadata.pins.p2a} to={[-32, 12]} />
      <Lead from={metadata.pins.p2b} to={[-32, 44]} />
      <Lead from={metadata.pins.sa} to={[32, -48]} />
      <Lead from={metadata.pins.sb} to={[32, 48]} />
      <path d="M-32-56C-8-56-8-40-32-40M-32 12C-8 12-8 28-32 28C-8 28-8 44-32 44M32-48C8-48 8-24 32-24C8-24 8 0 32 0C8 0 8 24 32 24C8 24 8 48 32 48M-5-64V64M5-64V64" />
    </>
  );
}
