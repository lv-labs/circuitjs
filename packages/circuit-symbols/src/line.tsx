import type { SymbolProps } from "../svg";

export const kind = "line";
export const metadata = {
  prefix: "LINE",
  name: "Line",
  pins: {},
  parameters: {
    width: 128,
    height: 0,
  },
} as const;

export const output = {
  type: "423",
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
      min: 0,
      max: 2048,
    },
  },
  sign: null,
};

export function Symbol({ parameters = metadata.parameters }: SymbolProps) {
  const halfWidth = Number(parameters.width) / 2;
  const halfHeight = Number(parameters.height) / 2;
  return (
    <path d={`M${-halfWidth} ${-halfHeight}L${halfWidth} ${halfHeight}`} />
  );
}
