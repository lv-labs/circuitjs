import { Lead } from "../svg";

export const kind = "invertingSchmittTrigger";
export const metadata = {
  prefix: "U",
  name: "Inverting Schmitt trigger",
  pins: {
    input: [-48, 0],
    out: [48, 0],
  },
  parameters: {
    slewRate: 0.5,
    lowerThreshold: 1.66,
    upperThreshold: 3.33,
    highVoltage: 5,
    lowVoltage: 0,
  },
} as const;
export const output = {
  type: "183",
  fields: {
    slewRate: {
      label: "Slew rate · V/ns",
      type: "number",
      exclusiveMin: 0,
    },
    lowerThreshold: {
      label: "Lower threshold · V",
      type: "number",
    },
    upperThreshold: {
      label: "Upper threshold · V",
      type: "number",
    },
    highVoltage: {
      label: "High output · V",
      type: "number",
    },
    lowVoltage: {
      label: "Low output · V",
      type: "number",
    },
  },
  sign: -1,
};

export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.input} to={[-24, 0]} />
      <Lead from={metadata.pins.out} to={[26, 0]} />
      <path d="M-24-24V24L18 0Z" />
      <path d="M-15 6H-7L1-6H9M-7-6H1L-7 6" />
      <circle cx={22} r={4} />
    </>
  );
}
