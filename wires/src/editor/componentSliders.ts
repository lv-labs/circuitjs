export const componentSliders = {
  variableVoltage: {
    field: "voltage",
    defaultLabel: "Voltage",
    historyLabel: "Adjust variable voltage",
  },
  potentiometer: {
    field: "position",
    defaultLabel: "Potentiometer",
    historyLabel: "Adjust potentiometer wiper",
  },
} as const

export type SliderKind = keyof typeof componentSliders

export function hasSlider<T extends { kind: string }>(
  component: T
): component is T & { kind: SliderKind } {
  return Object.hasOwn(componentSliders, component.kind)
}

export type SliderAdjustment = {
  kind: SliderKind
  id: string
  value: number
}
