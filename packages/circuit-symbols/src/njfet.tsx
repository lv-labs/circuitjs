import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "njfet";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "Q",
  name: "NJFET",
  pins: {
    gate: [-48, 0],
    source: [48, 16],
    drain: [48, -16],
  },
  parameters: {
    threshold: -4,
    beta: 0.00125,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.gate} to={[-16, 0]} />
      <Lead from={metadata.pins.drain} to={[-8, -16]} />
      <Lead from={metadata.pins.source} to={[-8, 16]} />
      <path d="M-16-20V20M-8-20V20" />
      <UprightText pose={pose} y={5} fontSize={9}>
        NJFET
      </UprightText>
    </>
  );
}
