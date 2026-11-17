import { Lead, UprightText } from "../svg";
import type { SymbolProps } from "../svg";

export const kind = "logicInput";
export const metadata = {
  prefix: "L",
  name: "Logic input",
  pins: {
    out: [48, 0],
  },
  parameters: {
    state: 1,
    highVoltage: 5,
    lowVoltage: 0,
    mode: "logic",
  },
} as const;

export function Symbol({
  parameters = metadata.parameters,
  pose,
}: SymbolProps) {
  const state =
    parameters.mode === "logic"
      ? parameters.state === 0
        ? "L"
        : "H"
      : String(parameters.state);
  return (
    <>
      <circle r={20} />
      <Lead from={metadata.pins.out} to={[20, 0]} />
      <UprightText pose={pose} y={7} textAnchor="middle" fontSize={14}>
        {state}
      </UprightText>
    </>
  );
}
