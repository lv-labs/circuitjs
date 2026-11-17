import { Meter, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "voltmeter";
export const metadata = {
  prefix: "VM",
  name: "Voltmeter / scope probe",
  pins: {
    a: [-100, 0],
    b: [100, 0],
  },
  parameters: {
    mode: 0,
    resistance: 10000000,
  },
} as const;

export const output = {
  type: "p",
  fields: {
    mode: {
      label: "Reading (0 V, 1 RMS, 2 max, 3 min, 4 peak-to-peak, 5 binary)",
      type: "number",
      min: 0,
      max: 5,
      integer: true,
    },
    resistance: {
      label: "Input resistance · Ω (0 = ideal)",
      type: "number",
      min: 0,
    },
  },
  sign: 1,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <Meter pins={metadata.pins} letter="V" pose={pose} />
      <UprightText pose={pose} x={-80} y={-30} textAnchor="middle" dominantBaseline="central" fontSize={36}>+</UprightText>
      <UprightText pose={pose} x={80} y={-30} textAnchor="middle" dominantBaseline="central" fontSize={36}>−</UprightText>
    </>
  );
}
