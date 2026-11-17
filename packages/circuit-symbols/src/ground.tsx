import { Lead } from "../svg";

// Authoritative symbol metadata. Generate the headless catalog with pnpm --dir wires symbols:generate.
export const kind = "ground";
export const metadata = {
  prefix: "G",
  name: "Ground",
  pins: {
    g: [0, -32],
  },
  parameters: {},
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.g} to={[0, 0]} />
      <path d="M-20 0H20M-12 7H12M-5 14H5" />
    </>
  );
}
