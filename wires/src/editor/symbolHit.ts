/** Hit rendered artwork, including unfilled closed interiors, in sheet SVG coordinates. */
export function symbolBodyHit(
  svg: SVGSVGElement,
  x: number,
  y: number
): string | null {
  const screen = svg.getScreenCTM()
  if (!screen) return null
  const point = new DOMPoint(x, y).matrixTransform(screen)
  const bodies = Array.from(
    svg.querySelectorAll<SVGGElement>("[data-symbol-body]")
  )
  for (const body of bodies.reverse()) {
    for (const shape of body.querySelectorAll<SVGGraphicsElement>(
      "path,rect,circle,ellipse,line,polyline,polygon,text"
    )) {
      const matrix = shape.getScreenCTM()
      if (!matrix) continue
      const local = point.matrixTransform(matrix.inverse())
      if (shape instanceof SVGGeometryElement) {
        if (shape.isPointInFill(local) || shape.isPointInStroke(local))
          return body.dataset.symbolBody ?? null
      } else {
        const box = shape.getBBox()
        if (
          local.x >= box.x &&
          local.x <= box.x + box.width &&
          local.y >= box.y &&
          local.y <= box.y + box.height
        )
          return body.dataset.symbolBody ?? null
      }
    }
  }
  return null
}
