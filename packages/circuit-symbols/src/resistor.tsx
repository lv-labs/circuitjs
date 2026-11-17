import { Lead } from "../svg";

// Authoritative symbol metadata. Generate the headless catalog with pnpm --dir wires symbols:generate.
export const kind = "resistor";
export const metadata = {
  prefix: "R",
  name: "Resistor",
  pins: {
    a: [-24, 0],
    b: [24, 0],
  },
  parameters: {
    resistance: 1000,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-24, 0]} />
      <Lead from={metadata.pins.b} to={[24, 0]} />
      <path d="M-24-8H24V8H-24Z" />
    </>
  );
}
