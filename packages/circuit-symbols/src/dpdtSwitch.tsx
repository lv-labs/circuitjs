import { SwitchPole } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "dpdtSwitch";
export const metadata = {
  prefix: "S",
  name: "DPDT switch",
  pins: {
    common1: [-48, -32],
    a1: [48, -16],
    b1: [48, -48],
    common2: [-48, 16],
    a2: [48, 32],
    b2: [48, 0],
  },
  parameters: {
    position: 0,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  const position = Number(parameters.position);
  return (
    <>
      <SwitchPole
        common={metadata.pins.common1}
        a={metadata.pins.a1}
        b={metadata.pins.b1}
        y={-32}
        position={position}
      />
      <SwitchPole
        common={metadata.pins.common2}
        a={metadata.pins.a2}
        b={metadata.pins.b2}
        y={16}
        position={position}
      />
      <path d="M0-32V16" strokeDasharray="3 3" />
    </>
  );
}
