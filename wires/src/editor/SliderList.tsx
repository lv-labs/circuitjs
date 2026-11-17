import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { GripVerticalIcon, PencilIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { sliderField } from "./componentSliders"
import type { SliderAdjustment } from "./componentSliders"
import type { Component } from "./core"
import type { PropertySlider } from "./PropertySliders"

export type SliderItem = {
  id: string
  component: Component
  field: string
  label: string
  min: number
  max: number
  step: number
  value: number
  displayValue: (value: number) => string
  config?: PropertySlider
}

type Drop = { id: string; index: number }
type RowDrag = {
  id: string
  pointerId: number
  startY: number
  y: number
  moved: boolean
}

export function SliderList({
  items,
  adjustment,
  onPreview,
  onCommit,
  onReorder,
  onEdit,
  onRemove,
}: {
  items: SliderItem[]
  adjustment: SliderAdjustment | null
  onPreview: (item: SliderItem, value: number) => void
  onCommit: (id: string, value: number) => void
  onReorder: (id: string, index: number) => void
  onEdit: (config: PropertySlider) => void
  onRemove: (id: string) => void
}) {
  const list = useRef<HTMLOListElement>(null)
  const drag = useRef<RowDrag | null>(null)
  const scrollFrame = useRef<number | null>(null)
  const focusedHandle = useRef<HTMLButtonElement | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const instructions = useId()

  useLayoutEffect(() => {
    const handle = focusedHandle.current
    if (!handle) return
    focusedHandle.current = null
    handle.focus({ preventScroll: true })
    handle.scrollIntoView({ block: "nearest" })
  }, [items])

  useEffect(
    () => () => {
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current)
    },
    []
  )

  function dropIndex(id: string, y: number) {
    const rows =
      list.current?.querySelectorAll<HTMLElement>("[data-slider-row]")
    let index = 0
    for (const row of rows ?? []) {
      if (row.dataset.sliderRow === id) continue
      const { top, height } = row.getBoundingClientRect()
      if (y < top + height / 2) break
      index++
    }
    return index
  }

  function updateDrop(active: RowDrag) {
    const index = dropIndex(active.id, active.y)
    setDrop((current) =>
      current?.id === active.id && current.index === index
        ? current
        : { id: active.id, index }
    )
  }

  function scrollAtEdge() {
    scrollFrame.current = null
    const active = drag.current
    const viewport = list.current?.parentElement
    if (!active?.moved || !viewport) return
    const { top, bottom } = viewport.getBoundingClientRect()
    const distance = Math.min(28, active.y - top, bottom - active.y)
    if (distance >= 28) return
    const before = viewport.scrollTop
    viewport.scrollTop +=
      (active.y - top < bottom - active.y ? -1 : 1) *
      Math.min(16, (28 - distance) / 2)
    if (before === viewport.scrollTop) return
    updateDrop(active)
    scrollFrame.current = requestAnimationFrame(scrollAtEdge)
  }

  function cancelDrag() {
    drag.current = null
    setDrop(null)
    if (scrollFrame.current !== null) {
      cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = null
    }
  }

  function move(id: string, destination: number, handle: HTMLButtonElement) {
    const source = items.findIndex((item) => item.id === id)
    const index = Math.max(0, Math.min(destination, items.length - 1))
    if (source < 0 || source === index) return
    focusedHandle.current = handle
    setAnnouncement(
      `${items[source].label} moved to position ${index + 1} of ${items.length}.`
    )
    onReorder(id, index)
  }

  const dropBefore = drop
    ? items.filter(({ id }) => id !== drop.id)[drop.index]?.id
    : null

  return (
    <>
      <p id={instructions} className="sr-only">
        Drag to reorder, or press the Up and Down arrow keys.
      </p>
      <div role="status" className="sr-only">
        {announcement}
      </div>
      <ol
        ref={list}
        className="relative"
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape" || !drag.current) return
          event.stopPropagation()
          event.preventDefault()
          cancelDrag()
        }}
      >
        {items.map((item, index) => {
          const {
            id,
            component,
            field,
            min,
            max,
            step,
            label,
            displayValue,
            config,
          } = item
          const value =
            adjustment?.id === component.id && sliderField(adjustment) === field
              ? adjustment.value
              : item.value
          return (
            <li
              key={id}
              data-slider-row={id}
              className={cn(
                "relative grid gap-2 border-b py-2 last:border-b-0",
                drop?.id === id && "opacity-50"
              )}
            >
              {dropBefore === id && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary"
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-grab touch-none active:cursor-grabbing"
                  disabled={items.length < 2 || !!adjustment}
                  aria-label={`Reorder ${label}`}
                  aria-describedby={instructions}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                      return
                    event.preventDefault()
                    move(
                      id,
                      index + (event.key === "ArrowUp" ? -1 : 1),
                      event.currentTarget
                    )
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || drag.current) return
                    drag.current = {
                      id,
                      pointerId: event.pointerId,
                      startY: event.clientY,
                      y: event.clientY,
                      moved: false,
                    }
                    event.currentTarget.focus({ preventScroll: true })
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    const active = drag.current
                    if (active?.pointerId !== event.pointerId) return
                    active.y = event.clientY
                    if (!active.moved && Math.abs(active.y - active.startY) < 4)
                      return
                    active.moved = true
                    updateDrop(active)
                    if (scrollFrame.current === null)
                      scrollFrame.current = requestAnimationFrame(scrollAtEdge)
                  }}
                  onPointerUp={(event) => {
                    const active = drag.current
                    if (active?.pointerId !== event.pointerId) return
                    cancelDrag()
                    if (active.moved)
                      move(
                        id,
                        dropIndex(id, event.clientY),
                        event.currentTarget
                      )
                  }}
                  onLostPointerCapture={(event) => {
                    if (drag.current?.pointerId === event.pointerId)
                      cancelDrag()
                  }}
                >
                  <GripVerticalIcon aria-hidden="true" />
                </Button>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <output className="shrink-0 tabular-nums">
                  {displayValue(value)}
                </output>
                {config && (
                  <>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit ${label}`}
                      onClick={() => onEdit(config)}
                    >
                      <PencilIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Remove ${label}`}
                      onClick={() => onRemove(config.id)}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </>
                )}
              </div>
              <Slider
                value={value}
                min={min}
                max={max}
                step={step}
                largeStep={10 * step}
                disabled={
                  !!drop ||
                  (!!adjustment &&
                    (adjustment.id !== component.id ||
                      sliderField(adjustment) !== field))
                }
                getAriaLabel={() => label}
                getAriaValueText={(_, value) => displayValue(value)}
                onValueChange={(next) => {
                  if (typeof next === "number") onPreview(item, next)
                }}
                onValueCommitted={(next) => {
                  if (typeof next === "number") onCommit(component.id, next)
                }}
                className="py-1"
              />
            </li>
          )
        })}
        {drop && !dropBefore && (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary"
          />
        )}
      </ol>
    </>
  )
}
