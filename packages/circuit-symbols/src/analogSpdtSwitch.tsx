import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "analogSpdtSwitch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "S",
  name: "Analog switch (SPDT)",
  pins: {
    common: [-48, 0],
    a: [48, -16],
    b: [48, 16],
    control: [0, 32],
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
      <Lead from={metadata.pins.common} to={[-20, 0]} />
      <Lead from={metadata.pins.a} to={[20, -16]} />
      <Lead from={metadata.pins.b} to={[20, 16]} />
      <Lead from={metadata.pins.control} to={[0, 20]} />
      <path d="M-20 0L18-16" />
      <path d="M0 20V0" strokeDasharray="3 3" />
      <UprightText pose={pose} x={7} y={26} fontSize={9}>
        C
      </UprightText>
    </>
  );
}
