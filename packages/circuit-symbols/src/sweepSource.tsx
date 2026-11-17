import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "sweepSource";
export const metadata = {
  prefix: "V",
  name: "A/C sweep",
  pins: {
    p: [0, 32],
  },
  parameters: {
    minFrequency: 20,
    maxFrequency: 4000,
    amplitude: 5,
    sweepTime: 0.1,
    logarithmic: false,
    bidirectional: true,
  },
} as const;
export const output = {
  type: "170",
  fields: {
    minFrequency: {
      label: "Minimum frequency · Hz",
      type: "number",
      exclusiveMin: 0,
    },
    maxFrequency: {
      label: "Maximum frequency · Hz",
      type: "number",
      min: 0,
    },
    amplitude: {
      label: "Peak voltage · V",
      type: "number",
      min: 0,
    },
    sweepTime: {
      label: "Sweep time · s",
      type: "number",
      exclusiveMin: 0,
    },
    logarithmic: {
      label: "Logarithmic sweep",
      type: "boolean",
    },
    bidirectional: {
      label: "Sweep up and down",
      type: "boolean",
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
        Sweep
      </UprightText>
    </>
  );
}
