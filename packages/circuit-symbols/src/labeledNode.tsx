import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "labeledNode";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "NET",
  name: "Labeled node",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    name: "NET",
  },
} as const;

export const output = {
  type: "207",
  fields: {
    name: {
      label: "Net name",
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
      label={String(parameters.name)}
      pose={pose}
    />
  );
}
