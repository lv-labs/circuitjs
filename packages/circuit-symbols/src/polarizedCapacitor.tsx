import { Lead } from "../svg";

export const kind = "polarizedCapacitor";
export const metadata = {
  prefix: "C",
  name: "Polarized capacitor",
  pins: {
    positive: [-48, 0],
    negative: [48, 0],
  },
  parameters: {
    capacitance: 0.000001,
    initialVoltage: 0,
    integration: "backwardEuler",
    maxReverseVoltage: 1,
  },
} as const;

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.positive} to={[-5, 0]} />
      <Lead from={metadata.pins.negative} to={[8, 0]} />
      <path d="M-5-16V16M12-16Q4 0 12 16M-24-14H-12M-18-20V-8" />
    </>
  );
}
