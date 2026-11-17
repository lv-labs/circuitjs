import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "antennaSource";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "V",
  name: "Antenna",
  pins: {
    p: [0, 32],
  },
  parameters: {},
} as const;
export const output = {
  type: "A",
  fields: {},
  sign: -1,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <circle r={20} />
      <Lead from={metadata.pins.p} to={[0, 20]} />
      <UprightText pose={pose} y={4} textAnchor="middle" fontSize={12}>
        Ant
      </UprightText>
    </>
  );
}
