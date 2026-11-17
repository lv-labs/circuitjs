import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "ledArray";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "LA",
  name: "LED array (8 × 8)",
  pins: {
    C0: [-112, 160],
    C1: [-80, 160],
    C2: [-48, 160],
    C3: [-16, 160],
    C4: [16, 160],
    C5: [48, 160],
    C6: [80, 160],
    C7: [112, 160],
    R0: [-160, -112],
    R1: [-160, -80],
    R2: [-160, -48],
    R3: [-160, -16],
    R4: [-160, 16],
    R5: [-160, 48],
    R6: [-160, 80],
    R7: [-160, 112],
  },
  parameters: {},
} as const;

export const output = {
  type: "405",
  fields: {},
  sign: null,
};

export function Symbol({ measured, pose }: SymbolProps) {
  const currents = Array.isArray(measured?.currents) ? measured.currents : [];
  return (
    <>
      <rect x={-128} y={-128} width={256} height={256} />
      {Object.entries(metadata.pins).map(([name, pin]) => {
        const column = name.startsWith("C");
        const position = -112 + 32 * Number(name.slice(1));
        return (
          <g key={name}>
            <Lead from={pin} to={column ? [position, 128] : [-128, position]} />
            <UprightText
              pose={pose}
              x={column ? position + 5 : -152}
              y={column ? 148 : position - 5}
              fontSize={8}
            >
              {name}
            </UprightText>
          </g>
        );
      })}
      {Array.from({ length: 64 }, (_, index) => {
        const brightness = Math.max(
          0.04,
          Math.min(1, (currents[index] ?? 0) / 0.01),
        );
        return (
          <circle
            key={index}
            cx={-112 + 32 * (index % 8)}
            cy={-112 + 32 * Math.floor(index / 8)}
            r={7}
            stroke="#607064"
            fill={`rgba(255,75,45,${brightness})`}
          />
        );
      })}
    </>
  );
}
