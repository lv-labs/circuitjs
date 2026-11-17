import { Lead, WaveformGlyph } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "voltageRail";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "V",
  name: "DC source (1 terminal)",
  pins: {
    p: [0, 32],
  },
  parameters: {
    waveform: {
      kind: "dc",
      voltage: 5,
    },
  },
} as const;

export const presets = {
  squareRail: {
    name: "Square wave source (1 terminal)",
    parameters: {
      waveform: {
        kind: "square",
        amplitude: 5,
        frequency: 40,
        offset: 0,
        dutyCycle: 0.5,
      },
    },
  },
  clockRail: {
    name: "Clock",
    parameters: {
      waveform: {
        kind: "square",
        amplitude: 2.5,
        frequency: 100,
        offset: 2.5,
        dutyCycle: 0.5,
      },
    },
  },
  acRail: {
    name: "AC source (1 terminal)",
    parameters: {
      waveform: {
        kind: "sine",
        amplitude: 1,
        frequency: 1000,
        offset: 0,
      },
    },
  },
};

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  return (
    <>
      <circle r={20} />
      <Lead from={metadata.pins.p} to={[0, 20]} />
      <WaveformGlyph waveform={parameters.waveform} pose={pose} />
    </>
  );
}
