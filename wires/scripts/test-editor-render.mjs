import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createServer} from 'vite'
import React from 'react'
import {renderToString} from 'react-dom/server'
const server=await createServer({server:{middlewareMode:true,ws:false,watch:null},appType:'custom'})
try {
  const {CircuitEditor}=await server.ssrLoadModule('/src/editor/CircuitEditor.tsx')
  const initialDocument=JSON.parse(readFileSync(new URL('../../docs/new-simulator/examples/voltage-divider.json',import.meta.url),'utf8'))
  const html=renderToString(React.createElement(CircuitEditor,{initialDocument,autosave:false}))
  assert.ok(html.includes('Voltage divider'))
  assert.ok(html.includes('Circuit sheet'))
  assert.equal((html.match(/>1 kΩ<\/text>/g)||[]).length,2)
  assert.doesNotMatch(html,/>R[12]<\/text>/)
  assert.ok(!html.includes('NaN'))
  console.log('React divider renders with the actual core, normalized wires, symbols and controls.')
} finally {await server.close()}
