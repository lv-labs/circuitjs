import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { catalog, geometry } from "../packages/circuit-core/index.mjs";
import {createTypeScriptLoader, React, renderToStaticMarkup} from './typescript_module.mjs';
const load=createTypeScriptLoader();
const check = spawnSync(
  process.execPath,
  ["wires/scripts/generate-symbols.mjs", "--check"],
  { encoding: "utf8" },
);
assert.equal(check.status, 0, check.stderr);

const root = new URL("../packages/circuit-symbols/", import.meta.url);
const symbols = load(new URL("index.ts", root));
assert.deepEqual(Object.keys(symbols), Object.keys(catalog.definitions));
for (const [kind, definition] of Object.entries(catalog.definitions)) {
  const authored = load(new URL(`src/${kind}.tsx`, root));
  assert.equal(symbols[kind], authored.Symbol);
  const drawingScale = authored.metadata.drawingScale ?? 1;
  const expected = JSON.parse(JSON.stringify(authored.metadata));
  expected.pins = Object.fromEntries(Object.entries(expected.pins).map(([name, pin]) => [name, pin.map(value => value * drawingScale)]));
  if (authored.output) expected.drawingScale = drawingScale;
  assert.deepEqual(expected, definition);
  const render = (props) =>
    renderToStaticMarkup(React.createElement(symbols[kind], props));
  assert.ok(render(), `${kind}: empty symbol`);

  // Move one authored pin without changing the body. Its lead must follow it.
  for (const [pinId, pin] of Object.entries(authored.metadata.pins)) {
    const original = [...pin];
    pin[0] += 13;
    pin[1] += 7;
    assert.ok(
      render().includes(`${pin[0]} ${pin[1]}`),
      `${kind}.${pinId}: lead endpoint follows metadata`,
    );
    pin.splice(0, 2, ...original);
  }
  for (const rotation of [0, 90, 180, 270])
    for (const mirror of [false, true]) {
      const pose = { x: 128, y: 96, rotation, mirror };
      const document = {
        electrical: { components: [{ id: "part", kind }] },
        layout: { components: { part: pose } },
      };
      for (const [pinId, [x, y]] of Object.entries(authored.metadata.pins)) {
        const [rx, ry] = geometry.rotateOffset(
          x * drawingScale * (mirror ? -1 : 1),
          y * drawingScale,
          rotation,
        );
        assert.deepEqual(
          geometry.pin(document, { kind: "pin", componentId: "part", pinId }),
          { x: pose.x + rx, y: pose.y + ry },
        );
      }
    }
}

for (const kind of ["acSource", "acRail", "clockRail", "squareRail"]) {
  const preset = catalog.placementDefinitions[kind];
  const markup = renderToStaticMarkup(
    React.createElement(symbols[preset.kind], {
      parameters: preset.parameters,
    }),
  );
  assert.doesNotMatch(
    markup,
    />\+<\/text>/,
    `${kind}: rendered with DC polarity glyphs`,
  );
}
const annotation = renderToStaticMarkup(
  React.createElement(symbols.text, {
    parameters: { text: "<Circuit>", size: 18 },
  }),
);
assert.match(annotation, /&lt;Circuit&gt;/);
console.log(
  "Symbol authoring passed: React registry, generated metadata, lead endpoints, orientations and source presets.",
);
