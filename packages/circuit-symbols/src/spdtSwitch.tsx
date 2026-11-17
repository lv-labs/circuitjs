import { Lead, SwitchPole } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "spdtSwitch";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "S",
  name: "SPDT switch",
  pins: {
    common: [-48, 0],
    a: [48, -16],
    b: [48, 16],
  },
  parameters: {
    onResistance: 0,
    momentary: false,
    linkLabel: "",
    iecSymbol: false,
    group: 0,
    throwCount: 2,
    centerOff: false,

    position: 0,
  },
} as const;

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  const count=Number(parameters.throwCount??2);
  if(count===2)return <>
    <SwitchPole {...metadata.pins} y={0} position={Number(parameters.position)} />
    {parameters.iecSymbol === true && <path d="M0-32V-16M-8-32H8" strokeDasharray="3 3" />}
  </>;
  const ys=Array.from({length:count},(_,i)=>16*(i-Math.floor((count-1)/2)));
  return <>
    <Lead from={metadata.pins.common} to={[-20,0]} />
    {ys.map((y,i)=><Lead key={i} from={[48,y]} to={[20,y]} />)}
    <path d={`M-20 0L20 ${ys[Number(parameters.position)]}`} />
    {parameters.iecSymbol === true && <path d="M0-32V-16M-8-32H8" strokeDasharray="3 3" />}
  </>;
}
