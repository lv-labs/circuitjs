import { Lead } from "../svg";

// Authoritative symbol metadata. Generate the headless catalog with pnpm --dir wires symbols:generate.
export const kind = "ground";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  prefix: "G",
  name: "Ground",
  pins: {
    g: [0, 0],
  },
  parameters: {},
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.g} to={[0, 50]} />
      <path d="M -50 50 H 50 L 0 100 Z " />
    </>
  );
}
