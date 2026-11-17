import { Lead } from "../svg";

export const kind = "zener";
export const metadata = {
  prefix: "D",
  name: "Zener diode",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
  },
  parameters: {
    forwardVoltage: 0.805904783,
    breakdownVoltage: 5.6,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-16, 0]} />
      <Lead from={metadata.pins.cathode} to={[16, 0]} />
      <path d="M-16-16V16L16 0Z" />
      <path d="M10-20H16V20H22" />
    </>
  );
}
