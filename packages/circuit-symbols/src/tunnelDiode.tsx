import { Lead } from "../svg";

export const kind = "tunnelDiode";
export const metadata = {
  prefix: "D",
  name: "Tunnel diode",
  pins: {
    anode: [-48, 0],
    cathode: [48, 0],
  },
  parameters: {},
} as const;
export const output = {
  type: "175",
  fields: {},
  sign: 1,
};
export function Symbol() {
  return (
    <>
      <Lead from={metadata.pins.anode} to={[-16, 0]} />
      <Lead from={metadata.pins.cathode} to={[16, 0]} />
      <path d="M-16-14V14L16 0ZM10-14H16V14H10" />
    </>
  );
}
