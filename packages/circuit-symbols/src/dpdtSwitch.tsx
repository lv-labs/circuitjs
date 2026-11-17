import { SwitchPole } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "dpdtSwitch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
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
    onResistance: 0,
    momentary: false,
    linkLabel: "",
    iecSymbol: false,
    poleCount: 2,

    position: 0,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  const position = Number(parameters.position);
  const count = Number(parameters.poleCount ?? 2);
  return <>
    {Array.from({length: count}, (_,i) => {
      const y = -32+i*48;
      const common = i === 0 ? metadata.pins.common1 : i === 1 ? metadata.pins.common2 : [-48,y] as const;
      const a = i === 0 ? metadata.pins.a1 : i === 1 ? metadata.pins.a2 : [48,y+16] as const;
      const b = i === 0 ? metadata.pins.b1 : i === 1 ? metadata.pins.b2 : [48,y-16] as const;
      return <SwitchPole key={i} common={common} a={a} b={b} y={y} position={position} />;
    })}
    {count>1 && <path d={`M0-32V${-32+(count-1)*48}`} strokeDasharray="3 3" />}
    {parameters.iecSymbol === true && <path d="M0-56V-40M-8-56H8" strokeDasharray="3 3" />}
  </>;
}
