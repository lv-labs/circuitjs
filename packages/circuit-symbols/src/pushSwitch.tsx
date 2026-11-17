import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "pushSwitch";
export const metadata = {
  prefix: "S",
  name: "Push switch",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    normallyClosed: false,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-20, 0]} />
      <Lead from={metadata.pins.b} to={[20, 0]} />
      <path
        d={`M-20 0L20 ${parameters.normallyClosed ? 0 : -16}M0-32V-16M-12-32H12`}
      />
    </>
  );
}
