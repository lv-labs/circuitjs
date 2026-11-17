import { Lead } from "../svg";

// Authoritative symbol metadata. Generate the headless catalog with pnpm --dir wires symbols:generate.
export const kind = "resistor";
export const metadata = {
  prefix: "R",
  name: "Resistor",
  pins: {
    a: [0, -100],
    b: [0, 100],
  },
  parameters: {
    resistance: 1000,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[0, -70]} />
      <Lead from={metadata.pins.b} to={[0, 70]} />
      <rect x={-30} y={-70} width={60} height={140} />
    </>
  );
}
