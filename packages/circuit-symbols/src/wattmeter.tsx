import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "wattmeter";
export const metadata = {
  prefix: "WM",
  name: "Wattmeter",
  pins: {
    returnIn: [-100, 50],
    returnOut: [100, 50],
    currentIn: [-100, -50],
    currentOut: [100, -50],
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
      <Lead from={metadata.pins.returnIn} to={[-50, 50]} />
      <Lead from={metadata.pins.returnOut} to={[50, 50]} />
      <Lead from={metadata.pins.currentIn} to={[-50, -50]} />
      <Lead from={metadata.pins.currentOut} to={[50, -50]} />
      <rect x={-50} y={-80} width={100} height={160} />
      <UprightText pose={pose} y={16} textAnchor="middle" fontSize={64}>
        W
      </UprightText>
    </>
  );
}
