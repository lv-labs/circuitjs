import { Lead } from "../svg";

export const kind = "pnp";
export const metadata = {
  prefix: "Q",
  name: "PNP transistor",
  pins: {
    base: [-48, 0],
    collector: [48, 16],
    emitter: [48, -16],
  },
  parameters: {
    beta: 100,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.base} to={[-12, 0]} />
      <Lead from={metadata.pins.collector} to={[16, 16]} />
      <Lead from={metadata.pins.emitter} to={[16, -16]} />
      <path d="M-12-20V20M-12-8L16 16M-12 8L16 -16" />
      <path d="M3 0L-7 8L4 10" />
    </>
  );
}
