import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "switch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "S",
  name: "Switch",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    onResistance: 0,
    momentary: false,
    linkLabel: "",
    iecSymbol: false,

    closed: false,
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
      {parameters.momentary === true && <path d="M0-32V-16M-12-32H12" />}
      {parameters.iecSymbol === true && <path d="M0-32V-16M-8-32H8" strokeDasharray="3 3" />}
    </>
  );
}
