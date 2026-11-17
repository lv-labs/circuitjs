import { Chip } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "tFlipFlop";
export const metadata = {
  prefix: "U",
  name: "T flip-flop",
  pins: {
    T: [-48, -16],
    clock: [-48, 16],
    Q: [48, -16],
    Qn: [48, 16],
  },
  parameters: {
    highVoltage: 5,
    initialState: false,
  },
} as const;

export function Symbol({ pose }: SymbolProps) {
  return (
    <Chip pins={metadata.pins} labels={{ clock: "▷", Qn: "Q̅" }} pose={pose} />
  );
}
