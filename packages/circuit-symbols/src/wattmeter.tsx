import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "wattmeter";
export const metadata = {
  prefix: "WM",
  name: "Wattmeter",
  pins: {
    returnIn: [-48, 16],
    returnOut: [48, 16],
    currentIn: [-48, -16],
    currentOut: [48, -16],
  },
  parameters: {
    mode: 0,
  },
} as const;

export const output = {
  type: "420",
  fields: {
    mode: {
      label: "Reading (0 instantaneous, 1 average)",
      type: "number",
      min: 0,
      max: 1,
      integer: true,
    },
  },
  sign: null,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.returnIn} to={[-24, 16]} />
      <Lead from={metadata.pins.returnOut} to={[24, 16]} />
      <Lead from={metadata.pins.currentIn} to={[-24, -16]} />
      <Lead from={metadata.pins.currentOut} to={[24, -16]} />
      <rect x={-24} y={-28} width={48} height={56} />
      <UprightText pose={pose} y={5} textAnchor="middle" fontSize={14}>
        W
      </UprightText>
    </>
  );
}
