import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "analogSwitch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "S",
  name: "Analog switch (SPST)",
  pins: {
    a: [-48, 0],
    b: [48, 0],
    control: [0, -32],
  },
  parameters: {
    onResistance: 20,
    offResistance: 10000000000,
    threshold: 2.5,
    inverted: false,
    pulldown: true,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-20, 0]} />
      <Lead from={metadata.pins.b} to={[20, 0]} />
      <Lead from={metadata.pins.control} to={[0, -20]} />
      <path d="M-20 0L18-12" />
      <path d="M0-20V-4" strokeDasharray="3 3" />
      <UprightText pose={pose} x={7} y={-22} fontSize={9}>
        C
      </UprightText>
    </>
  );
}
