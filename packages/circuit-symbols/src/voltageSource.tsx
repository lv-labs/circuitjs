import { Lead, WaveformGlyph } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "voltageSource";
export const metadata = {
  prefix: "V",
  name: "DC source (2 terminals)",
  pins: {
    p: [0, -48],
    n: [0, 48],
  },
  parameters: {
    waveform: {
      kind: "dc",
      voltage: 5,
    },
  },
} as const;

export const presets = {
  acSource: {
    name: "AC source (2 terminals)",
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
      <circle r={24} />
      <Lead from={metadata.pins.p} to={[0, -24]} />
      <Lead from={metadata.pins.n} to={[0, 24]} />
      <WaveformGlyph waveform={parameters.waveform} pose={pose} />
    </>
  );
}
