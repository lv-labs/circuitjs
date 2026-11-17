import { Meter, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "ammeter";
export const metadata = {
 
  prefix: "AM",
  name: "Ammeter",
  pins: {
    a: [-100, 0],
    b: [100, 0],
  },
  parameters: {
    mode: 0,
  },
} as const;

export const output = {
  type: "370",
  fields: {
    mode: {
      label: "Reading (0 instantaneous, 1 RMS)",
      type: "number",
      min: 0,
      max: 1,
      integer: true,
    },
  },
  sign: 1,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <Meter pins={metadata.pins} letter="A" pose={pose} />
      <UprightText pose={pose} x={-80} y={-30} textAnchor="middle" dominantBaseline="central" fontSize={36}>
        +
      </UprightText>
      <UprightText pose={pose} x={80} y={-30} textAnchor="middle" dominantBaseline="central" fontSize={36}>
        −
      </UprightText>
    </>
  );
}
