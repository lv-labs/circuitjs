import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ThemeProvider } from "./components/theme-provider"
import { CircuitEditor } from "./editor/CircuitEditor"
import type { CircuitDocument } from "./editor/core"
import divider from "../../docs/new-simulator/examples/voltage-divider.json"
import rc from "../../docs/new-simulator/examples/rc-charge.json"

function EditorPreview() {
  const [fixture, setFixture] = useState("divider")
  return (
    <main className="p-6">
      <label className="mb-4 flex items-center gap-2 text-sm">
        Example circuit{" "}
        <NativeSelect
          value={fixture}
          onChange={(e) => setFixture(e.target.value)}
        >
          <NativeSelectOption value="divider">
            Voltage divider
          </NativeSelectOption>
          <NativeSelectOption value="rc">
            RC charging circuit
          </NativeSelectOption>
        </NativeSelect>
      </label>
      <CircuitEditor
        key={fixture}
        autosave={false}
        initialDocument={
          (fixture === "divider" ? divider : rc) as CircuitDocument
        }
      />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <EditorPreview />
    </ThemeProvider>
  </StrictMode>
)
