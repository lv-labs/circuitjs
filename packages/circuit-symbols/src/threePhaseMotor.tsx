import { Motor } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "threePhaseMotor";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "M",
  name: "3-phase motor",
  pins: {
    U1: [-48, -32],
    U2: [48, 32],
    V1: [-48, 0],
    V2: [48, 0],
    W1: [-48, 32],
    W2: [48, -32],
  },
  parameters: {
    statorResistance: 0.435,
    rotorResistance: 0.816,
    statorInductance: 0.0294,
    rotorInductance: 0.0297,
    mutualInductance: 0.0287,
    friction: 0.05,
    inertia: 1,
  },
} as const;

export const output = {
  type: "427",
  fields: {
    statorResistance: {
      label: "Stator resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    rotorResistance: {
      label: "Rotor resistance · Ω",
      type: "number",
      exclusiveMin: 0,
    },
    statorInductance: {
      label: "Stator inductance · H",
      type: "number",
      exclusiveMin: 0,
    },
    rotorInductance: {
      label: "Rotor inductance · H",
      type: "number",
      exclusiveMin: 0,
    },
    mutualInductance: {
      label: "Mutual inductance · H",
      type: "number",
      exclusiveMin: 0,
    },
    friction: {
      label: "Friction coefficient",
      type: "number",
      min: 0,
    },
    inertia: {
      label: "Rotor inertia",
      type: "number",
      exclusiveMin: 0,
    },
  },
  sign: null,
};

export function Symbol({ measured, pose }: SymbolProps) {
  return (
    <Motor
      pins={metadata.pins}
      letter="3~"
      angle={Number(measured?.angle ?? 0)}
      pose={pose}
    />
  );
}
