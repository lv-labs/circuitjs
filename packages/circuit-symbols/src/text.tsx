import { UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "text";
export const metadata = {
  prefix: "TXT",
  name: "Text",
  pins: {},
  parameters: {
    text: "Text",
    size: 18,
  },
} as const;

export const output = {
  type: "x",
  fields: {
    text: {
      label: "Text",
      type: "string",
      maxLength: 4096,
    },
    size: {
      label: "Font size",
      type: "number",
      min: 8,
      max: 96,
      integer: true,
    },
  },
  sign: null,
};

export function Symbol({
  parameters = metadata.parameters,
  pose,
  graphicSize,
}: SymbolProps) {
  const size = Number(parameters.size);
  const lines = String(parameters.text).split("\n");
  const width =
    graphicSize?.width ??
    Math.max(32, ...lines.map((line) => line.length * size * 0.65));
  const height =
    graphicSize?.height ?? Math.max(size, lines.length * size * 1.3);
  const x = -width / 2;
  const y = -height / 2 + size;
  return (
    <UprightText
      pose={pose}
      x={x}
      y={y}
      fontSize={size}
      fontFamily="system-ui,sans-serif"
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index ? size * 1.3 : 0}>
          {line}
        </tspan>
      ))}
    </UprightText>
  );
}
