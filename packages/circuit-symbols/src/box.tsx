import type { SymbolProps } from "../svg";

export const kind = "box";
export const metadata = {
  prefix: "BOX",
  name: "Box",
  pins: {},
  parameters: {
    width: 128,
    height: 96,
  },
} as const;

export const output = {
  type: "b",
  fields: {
    width: {
      label: "Width · canvas units",
      type: "number",
      min: 16,
      max: 2048,
    },
    height: {
      label: "Height · canvas units",
      type: "number",
      min: 16,
      max: 2048,
    },
  },
  sign: null,
};

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  const width = Number(parameters.width);
  const height = Number(parameters.height);
  return (
    <rect
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      fill="none"
      strokeDasharray="8 4"
    />
  );
}
