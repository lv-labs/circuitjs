export type PanelBox = { x: number; y: number; width: number; height: number }
export const panelMargin = 12
export const panelTop = 48
const threshold = 10
const gap = panelMargin
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)))
function nearest(value: number, candidates: number[]) {
  let result = value,
    distance = threshold + 1
  for (const candidate of candidates) {
    const delta = Math.abs(candidate - value)
    if (delta <= threshold && delta < distance) {
      result = candidate
      distance = delta
    }
  }
  return result
}
export function floatingBounds(bounds: { width: number; height: number }) {
  return {
    width: Math.max(1, bounds.width - panelMargin * 2),
    height: Math.max(1, bounds.height - panelTop - panelMargin),
  }
}
export function clampFloating(
  size: { width: number; height: number },
  x: number,
  y: number,
  bounds: { width: number; height: number }
) {
  return {
    x: clamp(x, panelMargin, bounds.width - size.width - panelMargin),
    y: clamp(y, panelTop, bounds.height - size.height - panelMargin),
  }
}
export function snapFloating(
  size: { width: number; height: number },
  x: number,
  y: number,
  bounds: { width: number; height: number },
  targets: PanelBox[]
) {
  const point = clampFloating(size, x, y, bounds)
  const xs = [panelMargin, bounds.width - size.width - panelMargin]
  const ys = [panelTop, bounds.height - size.height - panelMargin]
  for (const t of targets) {
    if (
      point.y + size.height >= t.y - gap - threshold &&
      point.y <= t.y + t.height + gap + threshold
    )
      xs.push(
        t.x,
        t.x + t.width - size.width,
        t.x - gap - size.width,
        t.x + t.width + gap
      )
    if (
      point.x + size.width >= t.x - gap - threshold &&
      point.x <= t.x + t.width + gap + threshold
    )
      ys.push(
        t.y,
        t.y + t.height - size.height,
        t.y - gap - size.height,
        t.y + t.height + gap
      )
  }
  return clampFloating(size, nearest(point.x, xs), nearest(point.y, ys), bounds)
}
export function snapFloatingSize(
  width: number,
  height: number,
  point: { x: number; y: number },
  bounds: { width: number; height: number },
  targets: PanelBox[]
) {
  const maxWidth = Math.max(1, bounds.width - panelMargin - point.x)
  const maxHeight = Math.max(1, bounds.height - panelMargin - point.y)
  const widths = [maxWidth],
    heights = [maxHeight]
  for (const t of targets) {
    if (point.y + height >= t.y && point.y <= t.y + t.height)
      widths.push(t.x - gap - point.x, t.x + t.width - point.x)
    if (point.x + width >= t.x && point.x <= t.x + t.width)
      heights.push(t.y - gap - point.y, t.y + t.height - point.y)
  }
  return {
    width: clamp(nearest(width, widths), Math.min(320, maxWidth), maxWidth),
    height: clamp(
      nearest(height, heights),
      Math.min(220, maxHeight),
      maxHeight
    ),
  }
}
