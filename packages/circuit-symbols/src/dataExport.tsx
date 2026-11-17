import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "dataExport";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "DATA",
  name: "Data export",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    capacity: 10240,
  },
} as const;

export const output = {
  type: "210",
  fields: {
    capacity: {
      label: "Maximum data points",
      type: "number",
      min: 1,
      max: 100000,
      integer: true,
    },
  },
  sign: null,
};

export function Symbol({ pose }: SymbolProps) {
  return <TerminalBox pin={metadata.pins.in} label="DATA" pose={pose} />;
}
