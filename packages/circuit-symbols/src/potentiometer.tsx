import { Lead } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "potentiometer";
export const metadata = {
  prefix: "RV",
  name: "Potentiometer",
  pins: {
    a: [-48, 0],
    b: [48, 0],
    wiper: [0, 32],
  },
  parameters: {
    resistance: 1000,
    position: 0.5,
    label: "",
  },
} as const;

export function Symbol({ parameters }: SymbolProps) {
  const position =
    typeof parameters?.position === "number"
      ? parameters.position
      : metadata.parameters.position;
  const halfWidth = 24;
  const arrowX = (2 * position - 1) * halfWidth;
  const [wiperX, wiperY] = metadata.pins.wiper;
  return (
    <>
      <Lead from={metadata.pins.a} to={[-halfWidth, 0]} />
      <Lead from={metadata.pins.b} to={[halfWidth, 0]} />
      <rect x={-halfWidth} y={-8} width={2 * halfWidth} height={16} />
      <path d={`M${wiperX} ${wiperY}V24H${arrowX}V12M${arrowX - 6} 20L${arrowX} 12L${arrowX + 6} 20`} />
    </>
  );
}
