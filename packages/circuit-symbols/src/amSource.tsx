import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "amSource";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "V",
  name: "AM source",
  pins: {
    p: [0, 32],
  },
  parameters: {
    carrierFrequency: 1000,
    signalFrequency: 40,
    amplitude: 5,
  },
} as const;
export const output = {
  type: "200",
  fields: {
    carrierFrequency: {
      label: "Carrier frequency · Hz",
      type: "number",
      min: 0,
    },
    signalFrequency: {
      label: "Signal frequency · Hz",
      type: "number",
      min: 0,
    },
    amplitude: {
      label: "Peak voltage · V",
      type: "number",
      min: 0,
    },
  },
  sign: -1,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <circle r={20} />
      <Lead from={metadata.pins.p} to={[0, 20]} />
      <UprightText pose={pose} y={4} textAnchor="middle" fontSize={12}>
        AM
      </UprightText>
    </>
  );
}
