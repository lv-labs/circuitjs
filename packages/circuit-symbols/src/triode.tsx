import { Lead } from "../svg";
export const kind = "triode";
export const metadata = {
  name: "Triode",
  prefix: "Q",
  pins: {
    plate: [32, -48],
    grid: [-48, 0],
    cathode: [32, 48],
  },
  parameters: {
    mu: 93,
    kg1: 680,
  },
} as const;
export const output = {
  type: "173",
  fields: {
    mu: {
      label: "Amplification factor · μ",
      type: "number",
      exclusiveMin: 0,
    },
    kg1: {
      label: "Triode perveance factor · kg1",
      type: "number",
      exclusiveMin: 0,
    },
  },
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.plate} to={[0, -10]} />
      <Lead from={metadata.pins.grid} to={[-20, 0]} />
      <Lead from={metadata.pins.cathode} to={[7, 10]} />
      <circle r={24} />
      <path d="M-16-10H16M-16 0H-9M-5 0H2M6 0H13M-10 10H10" />
    </>
  );
}
