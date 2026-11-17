import { Lead } from "../svg";

// Authoritative symbol metadata. Generate the headless catalog with pnpm --dir wires symbols:generate.
export const kind = "capacitor";
export const metadata = {
  prefix: "C",
  name: "Capacitor",
  pins: {
    a: [-24, 0],
    b: [24, 0],
  },
  parameters: {
    capacitance: 1e-6,
    initialVoltage: 0,
    integration: "backwardEuler",
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-5, 0]} />
      <Lead from={metadata.pins.b} to={[5, 0]} />
      <path d="M-5-16V16M5-16V16" />
    </>
  );
}
