import { TerminalBox } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "audioOutput";
export const metadata = {
  // Original 16-unit artwork, scaled to the 50-unit sheet grid.
  drawingScale: 3.125,
  prefix: "AUDIO",
  name: "Audio output",
  pins: {
    in: [-48, 0],
  },
  parameters: {
    duration: 1,
    sampleRate: 8000,
  },
} as const;

export const output = {
  type: "211",
  fields: {
    duration: {
      label: "Capture duration · s",
      type: "number",
      min: 0.001,
      max: 10,
    },
    sampleRate: {
      label: "Sample rate · Hz",
      type: "number",
      choices: [8000, 11025, 16000, 22050, 44100, 48000],
    },
  },
  sign: null,
};

export function Symbol({ pose }: SymbolProps) {
  return <TerminalBox pin={metadata.pins.in} label="AUDIO" pose={pose} />;
}
