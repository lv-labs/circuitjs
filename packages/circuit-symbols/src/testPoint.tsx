import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "testPoint";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "TP",
  name: "Test point",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    mode: 0,
    label: "TP",
  },
} as const;

export const output = {
  type: "368",
  fields: {
    mode: {
      label: "Reading (0 V, 1 RMS, 2 max, 3 min, 4 peak-to-peak, 5 binary)",
      type: "number",
      min: 0,
      max: 5,
      integer: true,
    },
    label: {
      label: "Label",
      type: "string",
      maxLength: 80,
    },
  },
  sign: null,
};

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  return (
    <TerminalBox
      pin={metadata.pins.in}
      label={String(parameters.label)}
      pose={pose}
    />
  );
}
