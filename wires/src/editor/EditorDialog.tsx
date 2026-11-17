import { useLayoutEffect, useRef } from "react"
import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function EditorDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const content = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const previous = document.activeElement
    return () => {
      requestAnimationFrame(() => {
        if (
          document.activeElement === document.body &&
          (previous instanceof HTMLElement || previous instanceof SVGElement)
        )
          previous.focus()
      })
    }
  }, [])

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        ref={content}
        className="max-h-[85vh] overflow-y-auto sm:max-w-md"
        initialFocus={() => {
          const primary =
            content.current?.querySelector<HTMLInputElement>(
              "[data-primary]"
            ) ??
            content.current?.querySelector<HTMLInputElement>(
              "input[type=text], input:not([type])"
            )
          primary?.select()
          return primary ?? true
        }}
      >
        <DialogHeader>
          <DialogTitle className="pr-7">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
