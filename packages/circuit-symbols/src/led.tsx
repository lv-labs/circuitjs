import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "led";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.

  prefix: "D",
  name: "LED",
  pins: {
    anode: [-100, 0],
    cathode: [100, 0],
  },
  parameters: {
    model: "default-led",
    red: 1,
    green: 0,
    blue: 0,
    maxCurrent: 0.01,
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  current = 0,
}: SymbolProps) {
  const brightness = Math.max(
    0,
    Math.min(1, current > 0 ? 1 + .2 * Math.log(current / Number(parameters.maxCurrent)) : 0),
  );
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-30, 0]} />
      <Lead from={metadata.pins.cathode} to={[30, 0]} />
      <polygon points="30,0 -30,-40, -30,40" fill={`rgb(${Math.round(255 * Number(parameters.red ?? 1) * brightness)},${Math.round(255 * Number(parameters.green ?? 0) * brightness)},${Math.round(255 * Number(parameters.blue ?? 0) * brightness)})`} />
      <path d="M30-40V40" />
      <path d="M-12-56L12-80M0-80H12V-68M12-40L36-64M24-64H36V-52" />
    </>
  );
}
