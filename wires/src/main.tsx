import { Component, StrictMode } from "react"
import type { ErrorInfo, ReactNode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

type ErrorState = { error: Error | null; componentStack: string }

class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorState> {
  state: ErrorState = { error: null, componentStack: "" }

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React editor failed to render", error, info.componentStack)
    this.setState({ componentStack: info.componentStack || "" })
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" className="m-6 grid gap-3 font-mono text-sm">
          <h1 className="font-semibold">The editor could not render.</h1>
          <pre className="overflow-auto whitespace-pre-wrap">{this.state.error.message}</pre>
          {this.state.componentStack && (
            <pre className="overflow-auto whitespace-pre-wrap text-xs opacity-70">
              {this.state.componentStack}
            </pre>
          )}
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>
)
