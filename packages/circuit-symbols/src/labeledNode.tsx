import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "labeledNode";
export const metadata = {
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
