import { Lead } from "../svg";

export const kind = "memristor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "R",
  name: "Memristor",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    onResistance: 100,
    offResistance: 16000,
    initialDopedWidth: 0,
    totalWidth: 1e-8,
    mobility: 1e-10,
  },
} as const;
export const output = {
  type: "m",
  fields: {
    onResistance: {
      label: "On resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    offResistance: {
      label: "Off resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    initialDopedWidth: {
      label: "Initial doped width · m",
      type: "number",
      min: 0,
    },
    totalWidth: {
      label: "Total width · m",
      type: "number",
      exclusiveMin: 0,
    },
    mobility: {
      label: "Ion mobility · m²/(V·s)",
      type: "number",
      min: 0,
    },
  },
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.a} to={[-22, 0]} />
      <Lead from={metadata.pins.b} to={[22, 0]} />
      <path d="M-22-8H22V8H-22ZM-12-8V8M-6-8V8" />
    </>
  );
}
