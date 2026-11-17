import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "switch";
export const metadata = {
  prefix: "S",
  name: "Switch",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    closed: true,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-20, 0]} />
      <Lead from={metadata.pins.b} to={[20, 0]} />
      <circle cx={-20} r={2.5} />
      <circle cx={20} r={2.5} />
      <path d={`M-18 0L18 ${parameters.closed ? 0 : -18}`} />
    </>
  );
}
