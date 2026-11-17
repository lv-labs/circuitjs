import { useEffect, useId, useMemo, useRef, useState } from "react"
import { GripIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Component, Point } from "./core"
import type { SliderItem } from "./SliderList"
import { numericProperties } from "./PropertySliders"
import type { PropertySlider } from "./PropertySliders"
import { format } from "./componentValue"
import { SliderList } from "./SliderList"
import { componentSliders, potPositionRange } from "./componentSliders"
import type { SliderAdjustment, SliderKind } from "./componentSliders"

const orderStorageKey = "circuit-editor.slider-orders.v1"

function readSliderOrders() {
  const orders = new Map<string, string[]>()
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(orderStorageKey) ?? "[]"
    )
    if (Array.isArray(saved)) {
      for (const entry of saved) {
        if (
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          Array.isArray(entry[1]) &&
          entry[1].every((id: unknown) => typeof id === "string")
        )
          orders.set(entry[0], entry[1])
      }
    }
  } catch {
    // A missing or invalid preference falls back to component order.
  }
  return orders
}

const inset = 12
const toolbarClearance = 48
const arrows: Record<string, Point | undefined> = {
  ArrowLeft: { x: -16, y: 0 },
  ArrowRight: { x: 16, y: 0 },
  ArrowUp: { x: 0, y: -16 },
  ArrowDown: { x: 0, y: 16 },
}

function clampPosition(card: HTMLDivElement, point: Point): Point {
  const viewport = card.parentElement!
  return {
    x: Math.max(
      inset,
      Math.min(point.x, viewport.clientWidth - card.offsetWidth - inset)
    ),
    y: Math.max(
      toolbarClearance,
      Math.min(point.y, viewport.clientHeight - card.offsetHeight - inset)
    ),
  }
}

export function ComponentSliderPanel({
  propertySliders,
  allComponents,
  onPropertyPreview,
  onEditPropertySlider,
  onRemovePropertySlider,
  open,
  dismissible,
  focusOnOpen,
  documentId,
  persistOrder,
  components,
  adjustment,
  onPreview,
  onCommit,
  onCancelAdjustment,
  onClose,
}: {
  propertySliders: PropertySlider[]
  allComponents: Component[]
  onPropertyPreview: (
    component: Component,
    field: string,
    value: number
  ) => void
  onEditPropertySlider: (config: PropertySlider) => void
  onRemovePropertySlider: (id: string) => void
  open: boolean
  dismissible: boolean
  focusOnOpen: boolean
  documentId: string
  persistOrder: boolean
  components: (Component & { kind: SliderKind })[]
  adjustment: SliderAdjustment | null
  onPreview: (kind: SliderKind, id: string, value: number) => void
  onCommit: (id: string, value: number) => void
  onCancelAdjustment: () => void
  onClose: () => void
}) {
  const title = useId()
  const [orders, setOrders] = useState(() =>
    persistOrder ? readSliderOrders() : new Map<string, string[]>()
  )
  const sliderNames = useMemo(() => {
    const names = new Map<string, string>()
    const counts = new Map<string, number>()
    for (const component of components) {
      const base =
        String(component.parameters.label ?? "").trim() ||
        componentSliders[component.kind].defaultLabel
      const count = (counts.get(base) ?? 0) + 1
      counts.set(base, count)
      names.set(component.id, count === 1 ? base : `${base} ${count}`)
    }
    return names
  }, [components])
  const items = useMemo<SliderItem[]>(() => {
    const propertyItems = propertySliders.flatMap((config): SliderItem[] => {
      const component = allComponents.find(
        ({ id }) => id === config.componentId
      )
      const value =
        component &&
        numericProperties(component.parameters).find(
          ([field]) => field === config.field
        )?.[1]
      if (!component || value === undefined) return []
      return [
        {
          ...config,
          id: `property:${config.id}`,
          component,
          value,
          config,
          displayValue: (number) => String(Number(number.toPrecision(5))),
        },
      ]
    })
    return [
      ...propertyItems,
      ...components.map((component): SliderItem => {
        const isVoltage = component.kind === "variableVoltage"
        const { field } = componentSliders[component.kind]
        const min = isVoltage ? Number(component.parameters.minVoltage) : potPositionRange.min
        const max = isVoltage ? Number(component.parameters.maxVoltage) : potPositionRange.max
        return {
          id: component.id,
          component,
          field,
          label: sliderNames.get(component.id) ?? "Slider",
          min,
          max,
          step: Math.max(Number.MIN_VALUE, (max - min) / 1000),
          value: Number(component.parameters[field]),
          displayValue: (number) =>
            isVoltage
              ? format(number, "V")
              : `${Number((number * 100).toPrecision(4))}%`,
        }
      }),
    ]
  }, [propertySliders, allComponents, components, sliderNames])
  const order = orders.get(documentId)
  const orderedItems = useMemo(() => {
    if (!order) return items
    const positions = new Map(order.map((id, index) => [id, index]))
    return [...items].sort(
      (a, b) =>
        (positions.get(a.id) ?? order.length) -
        (positions.get(b.id) ?? order.length)
    )
  }, [items, order])
  function reorder(id: string, index: number) {
    const visibleIds = orderedItems.map((item) => item.id)
    const previousIndex = visibleIds.indexOf(id)
    if (previousIndex < 0 || previousIndex === index) return
    visibleIds.splice(previousIndex, 1)
    visibleIds.splice(index, 0, id)

    // Keep slots for deleted components so undo can restore their order.
    const visible = new Set(visibleIds)
    const knownIds = new Set([...(order ?? []), ...visibleIds])
    let nextIndex = 0
    const next = [...knownIds].map((known) =>
      visible.has(known) ? visibleIds[nextIndex++] : known
    )
    setOrders((current) => new Map(current).set(documentId, next))
    if (persistOrder) {
      try {
        localStorage.setItem(
          orderStorageKey,
          JSON.stringify([...readSliderOrders().set(documentId, next)])
        )
      } catch {
        // Keep the order in this session if storage is unavailable.
      }
    }
  }
  const panel = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const drag = useRef<{
    pointerId: number
    origin: Point
    start: Point
  } | null>(null)
  const [position, setPosition] = useState<Point | null>(null)

  useEffect(() => {
    if (!open || !focusOnOpen) return
    const focus = requestAnimationFrame(() => handle.current?.focus())
    return () => cancelAnimationFrame(focus)
  }, [open, focusOnOpen])

  useEffect(() => {
    const card = panel.current
    if (!open || !card || !card.parentElement) return
    const observer = new ResizeObserver(() => {
      setPosition((current) => {
        if (!current) return null
        const next = clampPosition(card, current)
        return next.x === current.x && next.y === current.y ? current : next
      })
    })
    observer.observe(card)
    observer.observe(card.parentElement)
    return () => {
      observer.disconnect()
      drag.current = null
    }
  }, [open])

  if (!open) return null
  return (
    <Card
      ref={panel}
      size="sm"
      role="region"
      aria-labelledby={title}
      data-component-slider-panel=""
      className="absolute z-20 max-h-[calc(100%_-_3.75rem)] w-72 max-w-[calc(100%_-_1.5rem)] gap-2 border py-0 shadow-lg"
      style={
        position
          ? { left: position.x, top: position.y }
          : { right: inset, top: toolbarClearance }
      }
      onPointerCancel={onCancelAdjustment}
      onTouchCancel={onCancelAdjustment}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          onCancelAdjustment()
          if (dismissible) onClose()
        }
      }}
    >
      <CardHeader className="flex items-center gap-1 border-b px-2 py-1.5">
        <CardTitle className="flex-1">
          <Button
            ref={handle}
            type="button"
            variant="ghost"
            aria-label="Move sliders panel"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            className="w-full cursor-grab touch-none justify-start active:cursor-grabbing"
            onPointerDown={(event) => {
              const card = panel.current
              if (!card || drag.current || event.button !== 0) return
              drag.current = {
                pointerId: event.pointerId,
                origin: { x: card.offsetLeft, y: card.offsetTop },
                start: { x: event.clientX, y: event.clientY },
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const card = panel.current
              const active = drag.current
              if (!card || active?.pointerId !== event.pointerId) return
              setPosition(
                clampPosition(card, {
                  x: active.origin.x + event.clientX - active.start.x,
                  y: active.origin.y + event.clientY - active.start.y,
                })
              )
            }}
            onLostPointerCapture={() => {
              drag.current = null
            }}
            onKeyDown={(event) => {
              const card = panel.current
              const delta = arrows[event.key]
              if (!card || !delta) return
              event.preventDefault()
              setPosition(
                clampPosition(card, {
                  x: card.offsetLeft + delta.x,
                  y: card.offsetTop + delta.y,
                })
              )
            }}
          >
            <GripIcon aria-hidden="true" />
            <span id={title}>Sliders</span>
          </Button>
        </CardTitle>
        {dismissible && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close sliders panel"
            onClick={onClose}
          >
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto pb-3">
        {orderedItems.length ? (
          <SliderList
            key={documentId}
            items={orderedItems}
            adjustment={adjustment}
            onPreview={(item, value) => {
              if (item.config)
                onPropertyPreview(item.component, item.field, value)
              else
                onPreview(
                  item.component.kind as SliderKind,
                  item.component.id,
                  value
                )
            }}
            onCommit={onCommit}
            onReorder={reorder}
            onEdit={onEditPropertySlider}
            onRemove={onRemovePropertySlider}
          />
        ) : (
          <p className="py-1 text-muted-foreground">
            Right-click a component and choose Add property slider to add a
            control.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
