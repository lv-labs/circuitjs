import { Meter } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "ohmmeter";
export const metadata = {
  prefix: "OM",
  name: "Ohmmeter",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    current: 0.01,
    maxVoltage: 0,
  },
} as const;

export const output = {
  type: "216",
  fields: {
    current: {
      label: "Test current a → b · A",
      type: "number",
      min: 0,
      max: 1,
    },
    maxVoltage: {
      label: "Compliance voltage · V (0 = ideal)",
      type: "number",
      min: 0,
    },
  },
  sign: 1,
};

export function Symbol({ pose }: SymbolProps) {
  return <Meter pins={metadata.pins} letter="Ω" pose={pose} />;
}
