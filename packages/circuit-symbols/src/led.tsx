import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "led";
export const metadata = {
  prefix: "D",
  name: "LED",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
  },
  parameters: {
    forwardVoltage: 2.1,
    maxCurrent: 0.01,
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  current = 0,
}: SymbolProps) {
  const brightness = Math.max(
    0,
    Math.min(1, current / Number(parameters.maxCurrent)),
  );
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-16, 0]} />
      <Lead from={metadata.pins.cathode} to={[16, 0]} />
      <path d="M-16-16V16L16 0Z" fill={`rgba(255,80,64,${brightness})`} />
      <path d="M16-16V16" />
      <path d="M0-22L12-34M6-34H12V-28M12-14L24-26M18-26H24V-20" />
    </>
  );
}
