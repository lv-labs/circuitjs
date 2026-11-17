import type { ScopeDockNode } from "./core"
export type DockEdge = "left" | "right" | "top" | "bottom"
export function removeDock(
  node: ScopeDockNode | null | undefined,
  id: string
): ScopeDockNode | null {
  if (!node) return null
  if (node.type === "scope") return node.id === id ? null : node
  const first = removeDock(node.first, id),
    second = removeDock(node.second, id)
  return first && second ? { ...node, first, second } : first || second
}
export function dockIds(node: ScopeDockNode | null | undefined): string[] {
  return !node
    ? []
    : node.type === "scope"
      ? [node.id]
      : [...dockIds(node.first), ...dockIds(node.second)]
}
export function normalizeDock(
  saved: ScopeDockNode | null | undefined,
  ids: string[],
  weight: (id: string) => number
): ScopeDockNode | null {
  let node = saved || null
  for (const id of dockIds(node))
    if (!ids.includes(id)) node = removeDock(node, id)
  const known = new Set(dockIds(node))
  for (const id of ids)
    if (!known.has(id)) {
      const total = dockIds(node).reduce((sum, id) => sum + weight(id), 0)
      node = node
        ? {
            type: "split",
            axis: "horizontal",
            ratio: total / (total + weight(id)),
            first: node,
            second: { type: "scope", id },
          }
        : { type: "scope", id }
    }
  return node
}
export function insertDock(
  node: ScopeDockNode | null,
  id: string,
  target?: string,
  edge: DockEdge = "right"
): ScopeDockNode {
  const leaf: ScopeDockNode = { type: "scope", id }
  if (!node) return leaf
  if (!target)
    return {
      type: "split",
      axis: "horizontal",
      ratio: 0.5,
      first: node,
      second: leaf,
    }
  if (node.type === "scope") {
    if (node.id !== target) return node
    const before = edge === "left" || edge === "top"
    return {
      type: "split",
      axis: edge === "left" || edge === "right" ? "horizontal" : "vertical",
      ratio: 0.5,
      first: before ? leaf : node,
      second: before ? node : leaf,
    }
  }
  return {
    ...node,
    first: insertDock(node.first, id, target, edge),
    second: insertDock(node.second, id, target, edge),
  }
}
export function dockRatio(
  node: ScopeDockNode,
  path: string,
  ratio: number
): ScopeDockNode {
  if (node.type === "scope") return node
  if (!path) return { ...node, ratio: Math.max(0.15, Math.min(0.85, ratio)) }
  return path[0] === "a"
    ? { ...node, first: dockRatio(node.first, path.slice(1), ratio) }
    : { ...node, second: dockRatio(node.second, path.slice(1), ratio) }
}
export function dockSize(node: ScopeDockNode | null): {
  width: number
  height: number
} {
  if (!node || node.type === "scope") return { width: 260, height: 180 }
  const a = dockSize(node.first),
    b = dockSize(node.second)
  return node.axis === "horizontal"
    ? { width: a.width + b.width + 8, height: Math.max(a.height, b.height) }
    : { width: Math.max(a.width, b.width), height: a.height + b.height + 8 }
}
export function swapDock(
  node: ScopeDockNode,
  a: string,
  b: string
): ScopeDockNode {
  return node.type === "scope"
    ? { ...node, id: node.id === a ? b : node.id === b ? a : node.id }
    : {
        ...node,
        first: swapDock(node.first, a, b),
        second: swapDock(node.second, a, b),
      }
}

export function arrangeDock(
  ids: string[],
  axis: "horizontal" | "vertical"
): ScopeDockNode | null {
  if (!ids.length) return null
  if (ids.length === 1) return { type: "scope", id: ids[0] }
  const middle = Math.ceil(ids.length / 2)
  return {
    type: "split",
    axis,
    ratio: middle / ids.length,
    first: arrangeDock(ids.slice(0, middle), axis)!,
    second: arrangeDock(ids.slice(middle), axis)!,
  }
}
