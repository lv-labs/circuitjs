import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "lamp";
export const metadata = {
  prefix: "LP",
  name: "Lamp",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    nominalPower: 100,
    nominalVoltage: 120,
    warmTime: 0.4,
    coolTime: 0.4,
    initialTemperature: 300,
  },
} as const;

export const output = {
  type: "181",
  fields: {
    nominalPower: {
      label: "Nominal power · W",
      type: "number",
      exclusiveMin: 0,
    },
    nominalVoltage: {
      label: "Nominal voltage · V",
      type: "number",
      exclusiveMin: 0,
    },
    warmTime: {
      label: "Warm-up time · s",
      type: "number",
      exclusiveMin: 0,
    },
    coolTime: {
      label: "Cool-down time · s",
      type: "number",
      exclusiveMin: 0,
    },
    initialTemperature: {
      label: "Initial temperature · K",
      type: "number",
      min: 300,
      max: 5000,
    },
  },
  sign: 1,
};

export function Symbol({ measured }: SymbolProps) {
  const temperature = Number(measured?.temperature ?? 300);
  const brightness = Math.max(0, Math.min(1, (temperature - 700) / 2000));
  return (
    <>
      <Lead from={metadata.pins.a} to={[-24, 0]} />
      <Lead from={metadata.pins.b} to={[24, 0]} />
      <circle r={24} fill={`rgba(255,175,55,${brightness})`} />
      <path d="M-16-16L16 16M-16 16L16-16" />
    </>
  );
}
