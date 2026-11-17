import { Motor } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "dcMotor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "M",
  name: "DC motor",
  pins: {
    a: [-48, 0],
    b: [48, 0],
  },
  parameters: {
    inductance: 0.5,
    resistance: 1,
    torqueConstant: 0.15,
    backEmfConstant: 0.15,
    inertia: 0.02,
    friction: 0.05,
    gearRatio: 1,
    loadTorque: 0,
  },
} as const;

export const output = {
  type: "415",
  fields: {
    inductance: {
      label: "Armature inductance · H",
      type: "number",
      exclusiveMin: 0,
    },
    resistance: {
      label: "Armature resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    torqueConstant: {
      label: "Torque constant",
      type: "number",
      min: 0,
    },
    backEmfConstant: {
      label: "Back EMF constant",
      type: "number",
      min: 0,
    },
    inertia: {
      label: "Rotor inertia",
      type: "number",
      exclusiveMin: 0,
    },
    friction: {
      label: "Friction coefficient",
      type: "number",
      exclusiveMin: 0,
    },
    gearRatio: {
      label: "Gear ratio",
      type: "number",
      exclusiveMin: 0,
    },
    loadTorque: {
      label: "Load torque",
      type: "number",
    },
  },
  sign: 1,
};

export function Symbol({ measured, pose }: SymbolProps) {
  return (
    <Motor
      pins={metadata.pins}
      letter="M"
      angle={Number(measured?.angle ?? 0)}
      pose={pose}
    />
  );
}
