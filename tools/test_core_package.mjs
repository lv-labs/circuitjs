// Exercise the package directly. No prototype globals, DOM, renderer or UI imports.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import vm from 'node:vm';
import core,{catalog,geometry,document as documents,editing,adapter,simulation,signals} from '../packages/circuit-core/index.mjs';
import {createEngine} from './engine_node_runtime.mjs';
if(!isMainThread){
 const model=editing.create(editing.empty(),()=>{},{wireSections:true});
 model.execute({type:'addComponent',kind:'resistor',x:128,y:128});
 parentPort.postMessage({models:Object.keys(catalog.definitions).length,parts:model.document.electrical.components.length,hasDOM:typeof document!=='undefined'||typeof window!=='undefined'});
}else{
 assert.equal(typeof globalThis.CircuitEditorModel,'undefined');
 assert.equal(typeof globalThis.CircuitDocumentAdapter,'undefined');
 assert.equal(Object.keys(catalog.definitions).length,65);
 assert.equal(editing.definitions,catalog.definitions,'One shared metadata owner');
 assert.equal(adapter.outputSpecs,catalog.outputSpecs,'One shared output schema owner');
 for(const [kind,model] of Object.entries(catalog.simulationModels)){
  assert.deepEqual([...model.pins].sort(),Object.keys(catalog.definitions[kind].pins).sort());
  assert.deepEqual([...model.postOrder].sort(),[...model.pins].sort());
 }
 assert.deepEqual(catalog.simulationModels.voltageSource.postOrder,['n','p'],'Native post order differs from display order deliberately');
 const input=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url))),before=structuredClone(input);
 const model=editing.create(input,()=>{},{wireSections:true}),initial=model.document,canonical=adapter.compile(initial).canonical;
 model.execute({type:'transform',selection:[{kind:'component',id:'r1'}],dx:32,dy:16});
 assert.equal(adapter.compile(model.document).canonical,canonical);model.undo();assert.deepEqual(model.document,initial);
 model.execute({type:'setParameters',componentId:'r1',parameters:{resistance:2000}});assert.equal(model.document.electrical.components.find(c=>c.id==='r1').parameters.resistance,2000);
 model.undo();assert.deepEqual(model.document,initial);
 assert.throws(()=>model.execute({type:'setParameters',componentId:'r1',parameters:{resistance:-1}}));assert.deepEqual(model.document,initial);
 assert.throws(()=>model.execute({type:'invented'}),/Unknown editing command/);
 const detached=editing.applyCommand(initial,{type:'transform',selection:[{kind:'component',id:'r1'}],rotation:90});documents.validate(detached);assert.deepEqual(input,before,'One-shot commands preserve caller ownership');
 const base=editing.empty(),placed=editing.applyCommand(base,{type:'addComponent',kind:'resistor',x:128,y:128});assert.equal(base.electrical.components.length,0);assert.equal(placed.electrical.components.length,1);
 const pin=geometry.pin(placed,{kind:'pin',componentId:placed.electrical.components[0].id,pinId:'a'});assert.deepEqual(pin,{x:80,y:128});
 const original=structuredClone(initial),session=editing.createDragSession(initial,new Set([geometry.token('component','r1')]));session.update(32,16);assert.deepEqual(initial,original);assert.deepEqual(session.cancel(),original);
 // A second frontend can drive the retained solver directly via the package.
 const engine=adapter.createSession(createEngine());engine.loadDocument(initial);const frame=engine.step(10);assert.ok(Math.abs(frame.pinVoltages.r2.a-2.5)<1e-10);
 assert.throws(()=>simulation.create(),/workerFactory/,'Transport is injected, never taken from the prototype');
 assert.equal(typeof signals.create,'function');assert.equal(core.version,1);
 // Real computation worker imports only the public package entry.
 const worker=new Worker(new URL(import.meta.url));
 try{const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});assert.deepEqual(result,{models:65,parts:1,hasDOM:false});}finally{await worker.terminate();}
 // Classic-script consumers use the exact same implementations. Hostile getters
 // catch accidental access to UI services even when loading every core module.
 const sandbox={structuredClone,crypto,console,setTimeout,clearTimeout};
 for(const name of ['document','window','localStorage','Worker','CircuitEditorModel','CircuitDocumentAdapter'])Object.defineProperty(sandbox,name,{get(){throw new Error('Core accessed UI dependency: '+name);}});
 const context=vm.createContext(sandbox);
 for(const name of ['catalog','geometry','document','history','drag','commands','adapter','protocol','simulation','signals','browser-transport','index'])vm.runInContext(await readFile(new URL(`../packages/circuit-core/${name}.js`,import.meta.url),'utf8'),context,{filename:name+'.js'});
 const classic=context.CircuitCore,doc=classic.editing.applyCommand(classic.editing.empty(),{type:'addComponent',kind:'resistor',x:64,y:64});assert.equal(doc.electrical.components.length,1);
 assert.equal(classic.adapter.compile(initial).canonical,canonical);
 console.log('Core package passed: direct ESM and classic imports, real DOM-free worker, shared metadata/post order, commands/history/immutability, drag cancellation, injected transport and real-engine divider results.');
}
