import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "mbbSwitch";
export const metadata = {
  prefix: "S",
  name: "Make-before-break switch",
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
  const position = Number(parameters.position);
  const bridging = position % 2 === 1;
  return (
    <>
      <Lead from={metadata.pins.common} to={[-20, 0]} />
      <Lead from={metadata.pins.a} to={[20, -16]} />
      <Lead from={metadata.pins.b} to={[20, 16]} />
      {(position === 0 || bridging) && <path d="M-20 0L20-16" />}
      {(position === 2 || bridging) && <path d="M-20 0L20 16" />}
    </>
  );
}
