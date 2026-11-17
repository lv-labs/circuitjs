import { Lead } from "../svg";

export const kind = "inverter";
export const metadata = {
  prefix: "U",
  name: "Inverter",
  pins: {
    input: [-48, 0],
    out: [48, 0],
  },
  parameters: {
    highVoltage: 5,
    slewRate: 0.5,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.input} to={[-24, 0]} />
      <Lead from={metadata.pins.out} to={[28, 0]} />
      <path d="M-24-24V24L20 0Z" />
      <circle cx={24} r={4} />
    </>
  );
}
