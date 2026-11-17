import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "fuse";
export const metadata = {
  prefix: "R",
  name: "Fuse",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    resistance: 0.0613,
    i2t: 6.73,
  },
} as const;
export const output = {
  type: "404",
  fields: {
    resistance: {
      label: "Cold resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    i2t: {
      label: "Melting I²t · A²s",
      type: "number",
      exclusiveMin: 0,
    },
  },
  sign: 1,
};
export function Symbol({ measured }: SymbolProps) {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-22, 0]} />
      <Lead from={metadata.pins.b} to={[22, 0]} />
      <path d="M-22-8H22V8H-22Z" />
      <path d={measured?.blown ? "M-22 0H-5L3-5M7 0H22" : "M-22 0H22"} />
    </>
  );
}
