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
import "../../../experiments/engine/legacy-component-menu.js"
import "../../../experiments/engine/component-menu.js"

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
const entries = CircuitComponentMenu.entries(core.catalog.placementDefinitions)

function matchingEntries(items: MenuEntry[], term: string): MenuEntry[] {
  if (!term) return items
  return items.flatMap((item): MenuEntry[] => {
    if (item.label.toLowerCase().includes(term)) return [item]
    if (!("children" in item))
      return item.tool?.toLowerCase().includes(term) ? [item] : []
    const children = matchingEntries(item.children, term)
    return children.length ? [{ ...item, children }] : []
  })
}

function ComponentEntries({
  entries,
  onChoose,
}: {
  entries: MenuEntry[]
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
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (tool: string) => void
}) {
  const [search, setSearch] = useState("")
  const term = search.trim().toLowerCase()
  const matching = matchingEntries(entries, term)
  return (
    <MenubarMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("")
        onOpenChange(next)
      }}
    >
      <MenubarTrigger aria-keyshortcuts="A">Add</MenubarTrigger>
      <MenubarContent className="w-64">
        <Input
          aria-label="Search components"
          placeholder="Search components…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (!["Escape", "ArrowDown", "ArrowUp", "Tab"].includes(event.key))
              event.stopPropagation()
          }}
          className="sticky top-0 z-10 w-full border-b bg-popover p-2"
        />
        <ComponentEntries entries={matching} onChoose={onChoose} />
        {(!term || "voltage probe".includes(term)) && (
          <>
            <MenubarSeparator />
            <MenubarItem onClick={() => onChoose("probe")}>
              Voltage probe
            </MenubarItem>
          </>
        )}
      </MenubarContent>
    </MenubarMenu>
  )
}
