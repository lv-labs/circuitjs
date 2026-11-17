import { useState } from "react"
import { Input } from "@/components/ui/input"
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { core } from "./core"
import "./menu/legacy-component-menu.js"
import "./menu/component-menu.js"

type MenuEntry =
  | { label: string; children: MenuEntry[] }
  | { label: string; legacyClass: string; tool: string | null; reason: string }

// Reuse the reference app's generated names, hierarchy, and availability map.
// These scripts supply menu data without mounting any DOM or event handlers.
const { CircuitComponentMenu } = globalThis as typeof globalThis & {
  CircuitComponentMenu: {
    entries(definitions: typeof core.catalog.placementDefinitions): MenuEntry[]
  }
}
function cleanLabels(items: MenuEntry[]): MenuEntry[] {
  return items.filter((item) => !("tool" in item && item.tool === "pushSwitch")).map((item) => ({
    ...item,
    label: item.label.replace(/^Add\s+/i, ""),
    ...("children" in item ? { children: cleanLabels(item.children) } : {}),
  }))
}

const entries = cleanLabels(
  CircuitComponentMenu.entries(core.catalog.placementDefinitions)
)

function fuzzyMatch(label: string, term: string): boolean {
  const text = label.toLowerCase().replace(/[^a-z0-9]/g, "")
  const query = term.toLowerCase().replace(/[^a-z0-9]/g, "")
  let index = 0
  for (const character of query) {
    index = text.indexOf(character, index)
    if (index === -1) return false
    index++
  }
  return true
}

function matchingEntries(items: MenuEntry[], term: string): MenuEntry[] {
  if (!term) return items
  return items.flatMap((item): MenuEntry[] => {
    const matches = fuzzyMatch(item.label, term)
    if ("children" in item)
      return matchingEntries(item.children, matches ? "" : term).flatMap(
        flattenEntry
      )
    return matches || (item.tool && fuzzyMatch(item.tool, term)) ? [item] : []
  })
}

function flattenEntry(item: MenuEntry): MenuEntry[] {
  return "children" in item ? item.children.flatMap(flattenEntry) : [item]
}

function ComponentEntries({
  entries,
  selectedTool,
  onChoose,
}: {
  entries: MenuEntry[]
  selectedTool?: string
  onChoose: (tool: string) => void
}) {
  return entries.map((entry) => {
    if ("children" in entry)
      return (
        <MenubarSub key={entry.label}>
          <MenubarSubTrigger>{entry.label}</MenubarSubTrigger>
          <MenubarSubContent className="w-max max-w-80">
            <ComponentEntries entries={entry.children} onChoose={onChoose} />
          </MenubarSubContent>
        </MenubarSub>
      )
    const { tool } = entry
    return (
      <MenubarItem
        key={entry.legacyClass}
        className={
          tool === selectedTool ? "bg-accent text-accent-foreground" : undefined
        }
        disabled={!tool}
        aria-label={tool ? undefined : `${entry.label}. ${entry.reason}`}
        onClick={() => {
          if (tool) onChoose(tool)
        }}
      >
        {entry.label}
      </MenubarItem>
    )
  })
}

export function ComponentMenu({
  open,
  position,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  position: { x: number; y: number } | null
  onOpenChange: (open: boolean) => void
  onChoose: (tool: string) => void
}) {
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const term = search.trim().toLowerCase()
  const matching = matchingEntries(entries, term)
  const showProbe = !term || fuzzyMatch("voltage probe", term)
  const firstMatch = term
    ? matching.find((entry) => "tool" in entry && entry.tool)
    : undefined
  const firstTool =
    firstMatch && "tool" in firstMatch
      ? firstMatch.tool
      : term && showProbe
        ? "probe"
        : undefined
  return (
    <MenubarMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("")
        onOpenChange(next)
      }}
    >
      <MenubarTrigger aria-keyshortcuts="A">Add</MenubarTrigger>
      <MenubarContent
        className="w-64"
        anchor={
          position
            ? {
                getBoundingClientRect: () =>
                  new DOMRect(position.x, position.y, 0, 0),
              }
            : undefined
        }
        alignOffset={position ? 0 : undefined}
        sideOffset={position ? 0 : undefined}
      >
        <Input
          aria-label="Search components"
          placeholder="Search components…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              event.stopPropagation()
              const menu = event.currentTarget.closest('[role="menu"]')
              const options = menu?.querySelectorAll<HTMLElement>(
                '[role="menuitem"]:not([aria-disabled="true"]):not([data-disabled])'
              )
              if (options?.length) {
                const selected = Array.from(options).findIndex((option) =>
                  option.classList.contains("bg-accent")
                )
                const index =
                  event.key === "ArrowDown"
                    ? Math.min(selected + 1, options.length - 1)
                    : selected > 0
                      ? selected - 1
                      : options.length - 1
                options[index].focus()
              }
              return
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.stopPropagation()
              if (firstTool) {
                onChoose(firstTool)
                setSearch("")
                onOpenChange(false)
              }
              return
            }
            if (!["Escape", "ArrowDown", "ArrowUp", "Tab"].includes(event.key))
              event.stopPropagation()
          }}
          className="sticky top-0 z-10 w-full border-b bg-popover p-2"
        />
        <ComponentEntries
          entries={matching}
          onChoose={onChoose}
          selectedTool={searchFocused ? (firstTool ?? undefined) : undefined}
        />
        {showProbe && (
          <>
            <MenubarSeparator />
            <MenubarItem
              className={
                searchFocused && firstTool === "probe"
                  ? "bg-accent text-accent-foreground"
                  : undefined
              }
              onClick={() => onChoose("probe")}
            >
              Voltage probe
            </MenubarItem>
          </>
        )}
      </MenubarContent>
    </MenubarMenu>
  )
}
