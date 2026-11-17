// Execute the packaged classic worker and every relative import without a DOM.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import vm from 'node:vm'
import {adapter} from '../../packages/circuit-core/index.mjs'
const root=new URL('../dist/engine/',import.meta.url)
for(const name of ['voltage-divider','rc-charge']){
const replies=[]
const context=vm.createContext({console,URL,performance,setTimeout,clearTimeout,structuredClone,crypto,DedicatedWorkerGlobalScope:class {}})
context.self=context
context.location={href:new URL('revision-worker.js',root).href}
context.postMessage=reply=>replies.push(reply)
context.close=()=>{}
context.importScripts=(...names)=>{for(const name of names)vm.runInContext(readFileSync(new URL(name,root),'utf8'),context,{filename:name,timeout:10000})}
vm.runInContext(readFileSync(new URL('revision-worker.js',root),'utf8'),context,{timeout:10000})
assert.equal(replies[0]?.type,'ready',JSON.stringify(replies))
let requestId=0
function request(operation,extra={}){
 context.onmessage({data:{protocolVersion:1,sessionId:'vite-assets',requestId:++requestId,operation,...extra}})
 const reply=replies.at(-1);assert.ok(reply.ok,JSON.stringify(reply));return reply.result
}
request('initialize')
 const document=JSON.parse(readFileSync(new URL(`../../docs/new-simulator/examples/${name}.json`,import.meta.url),'utf8'))
 const initial={documentId:null,circuitRevision:0,runEpoch:0}
 const base={documentId:document.id,circuitRevision:requestId,runEpoch:requestId}
 request('installCircuit',{base:initial,target:base,payload:{circuit:JSON.parse(adapter.compile(document).canonical)}})
 const frame=request('step',{base,payload:{count:name==='voltage-divider'?10:1000}})
 if(name==='voltage-divider')assert.ok(Math.abs(frame.pinVoltages.r2.a-2.5)<1e-10)
 else assert.ok(frame.pinVoltages.c1.a>4.99&&frame.pinVoltages.c1.a<5)
}
console.log(`Packaged worker imports and divider/RC measurements passed: ${fileURLToPath(root)}`)
