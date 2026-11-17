import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const symbols = new URL("../../packages/circuit-symbols/", import.meta.url)
const source = new URL("src/", symbols)
const catalogPath = new URL("../circuit-core/catalog.js", symbols)
const registryPath = new URL("index.ts", symbols)
const checking = process.argv.includes("--check")

// Catalog generation reads literals without evaluating TSX or loading React.
function literal(node) {
  if (ts.isAsExpression(node) && node.type.getText() === "const")
    return literal(node.expression)
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property) || !("text" in property.name))
          throw new Error("Symbol metadata must contain literal properties")
        return [property.name.text, literal(property.initializer)]
      })
    )
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  )
    return -literal(node.operand)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  throw new Error("Symbol metadata must be literal data")
}

const registry = ts.createSourceFile(
  fileURLToPath(registryPath),
  readFileSync(registryPath, "utf8"),
  ts.ScriptTarget.Latest,
  true
)
const files = registry.statements
  .filter(ts.isExportDeclaration)
  .map((entry) => {
    const clause = entry.exportClause
    const item = clause && ts.isNamedExports(clause) && clause.elements[0]
    const kind = item?.name.text
    if (
      !kind ||
      item.propertyName?.text !== "Symbol" ||
      clause.elements.length !== 1 ||
      !entry.moduleSpecifier ||
      !ts.isStringLiteral(entry.moduleSpecifier) ||
      entry.moduleSpecifier.text !== `./src/${kind}`
    )
      throw new Error(`Invalid symbol registration: ${entry.getText()}`)
    return `${kind}.tsx`
  })
const allFiles = readdirSync(source).filter((file) => file.endsWith(".tsx"))
if (
  files.length !== allFiles.length ||
  allFiles.some((file) => !files.includes(file))
)
  throw new Error(
    "Register every authored symbol once in packages/circuit-symbols/index.ts"
  )
const definitions = new Map()
const outputSpecs = new Map()
const presets = new Map()
for (const file of files) {
  const kind = file.slice(0, -4)
  if (!/^[a-z][a-zA-Z0-9]+$/.test(kind))
    throw new Error(`Invalid symbol filename: ${file}`)
  const path = new URL(file, source)
  const ast = ts.createSourceFile(
    fileURLToPath(path),
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const declarations = new Map(
    ast.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .map((declaration) => [
        declaration.name.getText(ast),
        declaration.initializer,
      ])
  )
  const read = (name) =>
    declarations.has(name) ? literal(declarations.get(name)) : undefined
  if (read("kind") !== kind)
    throw new Error(`Symbol kind does not match ${file}`)
  const metadata = read("metadata")
  if (
    !metadata ||
    typeof metadata.name !== "string" ||
    typeof metadata.prefix !== "string" ||
    !metadata.pins ||
    !metadata.parameters ||
    Object.values(metadata.pins).some(
      (pin) =>
        !Array.isArray(pin) || pin.length !== 2 || !pin.every(Number.isFinite)
    )
  )
    throw new Error(`Invalid symbol metadata in ${file}`)
  const drawingScale = metadata.drawingScale ?? 1
  metadata.pins = Object.fromEntries(Object.entries(metadata.pins).map(([name, pin]) => [name, pin.map(value => value * drawingScale)]))
  const output = read("output")
  if (output) {
    const { name, prefix, pins, parameters } = metadata
    const { type, fields, sign } = output
    if (
      Object.keys(fields).length !== Object.keys(parameters).length ||
      Object.keys(fields).some((key) => !Object.hasOwn(parameters, key))
    )
      throw new Error(`Output fields and defaults differ in ${file}`)
    const withDefaults = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [
        key,
        { ...field, default: parameters[key] },
      ])
    )
    outputSpecs.set(kind, {
      name,
      prefix,
      drawingScale,
      pins,
      type,
      fields: withDefaults,
      parameters,
      sign,
    })
  } else {
    definitions.set(kind, metadata)
  }
  for (const [name, preset] of Object.entries(read("presets") ?? {})) {
    if (presets.has(name)) throw new Error(`Duplicate symbol preset: ${name}`)
    presets.set(name, { kind, ...preset })
  }
}

const catalog = readFileSync(catalogPath, "utf8")
const begin = "  // BEGIN GENERATED SYMBOL CATALOG"
const end = "  // END GENERATED SYMBOL CATALOG"
const start = catalog.indexOf(begin)
const finish = catalog.indexOf(end, start)
if (start < 0 || finish < 0)
  throw new Error("Missing generated catalog markers")
const declaration = (name, entries) =>
  `  const ${name} = ${JSON.stringify(Object.fromEntries(entries), null, 2).replaceAll("\n", "\n  ")};\n`
// Keep the reference editor's quick palette order for the original variants.
const presetOrder = [
  "acSource",
  "squareRail",
  "clockRail",
  "opampPlusTop",
  "acRail",
]
const orderedPresets = [...new Set([...presetOrder, ...presets.keys()])]
  .filter((key) => presets.has(key))
  .map((key) => [key, presets.get(key)])
const generatedCatalog =
  catalog.slice(0, start) +
  begin +
  "\n" +
  declaration("outputSpecs", outputSpecs) +
  declaration("basicDefinitions", definitions) +
  declaration("placementPresets", orderedPresets) +
  catalog.slice(finish)

function update(path, data) {
  if (checking) {
    if (readFileSync(path, "utf8") !== data)
      throw new Error(
        `${fileURLToPath(path)} is stale. Run pnpm --dir wires symbols:generate.`
      )
  } else {
    writeFileSync(path, data)
  }
}
update(catalogPath, generatedCatalog)
console.log(
  `${checking ? "Checked" : "Generated"} catalog metadata for ${files.length} React symbols.`
)
