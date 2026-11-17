export { colourPresets as ledColourPresets } from "./colourPresets"

export function normaliseLedHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const digits = match[1].length === 3
    ? [...match[1]].map(digit => digit + digit).join("")
    : match[1]
  return `#${digits.toUpperCase()}`
}

export function ledHexToRgb(value: string) {
  const hex = normaliseLedHex(value)
  if (!hex) throw new Error("Enter a hex colour such as #FF0000 or #F00.")
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  }
}

export function ledRgbToHex(parameters: Record<string, unknown>) {
  return "#" + (["red", "green", "blue"] as const).map(channel =>
    Math.round(Math.max(0, Math.min(1, Number(parameters[channel] ?? (channel === "red" ? 1 : 0)) )) * 255)
      .toString(16).padStart(2, "0")
  ).join("").toUpperCase()
}
