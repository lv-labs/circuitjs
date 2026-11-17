import { SwitchPole } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "spdtSwitch";
export const metadata = {
  prefix: "S",
  name: "SPDT switch (center off)",
  pins: {
    common: [-48, 0],
    a: [48, -16],
    b: [48, 16],
  },
  parameters: {
    position: 0,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  return (
    <SwitchPole
      {...metadata.pins}
      y={0}
      position={Number(parameters.position)}
    />
  );
}
