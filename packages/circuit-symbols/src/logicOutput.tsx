import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "logicOutput";
export const metadata = {
  prefix: "M",
  name: "Logic output",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    threshold: 2.5,
    mode: "logic",
    pulldown: false,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return <TerminalBox pin={metadata.pins.in} label="L/H" pose={pose} />;
}
