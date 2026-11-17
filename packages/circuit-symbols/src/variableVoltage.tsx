import { Lead, Upright } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "variableVoltage";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "V",
  name: "Variable voltage",
  pins: {
    p: [0, 32],
  },
  parameters: {
    minVoltage: 0,
    maxVoltage: 5,
    voltage: 2.5,
    label: "Voltage",
  },
} as const;

export const output = {
  type: "172",
  fields: {
    minVoltage: {
      label: "Minimum voltage · V",
      type: "number",
    },
    maxVoltage: {
      label: "Maximum voltage · V",
      type: "number",
    },
    voltage: {
      label: "Voltage · V",
      type: "number",
    },
    label: {
      label: "Slider label",
      type: "string",
      maxLength: 80,
    },
  },
  sign: -1,
};

export function Symbol({ pose }: SymbolProps) {
  return (
    <>
      <circle r={20} />
      <Lead from={metadata.pins.p} to={[0, 20]} />
      <Upright pose={pose}>
        <path d="M-12 12L12-12M3-12H12V-3" />
      </Upright>
    </>
  );
}
