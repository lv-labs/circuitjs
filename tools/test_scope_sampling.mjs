import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
import '../experiments/engine/editor-model.js';
const doc=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url))),A=CircuitDocumentAdapter;
const channels=[{id:'input',positive:{componentId:'v1',pinId:'p'},negative:null},{id:'output',positive:{componentId:'r2',pinId:'a'},negative:null},{id:'difference',positive:{componentId:'v1',pinId:'p'},negative:{componentId:'r2',pinId:'a'}}];
function engine(){let time=0;const calls=[],compiled=A.compile(doc);return {calls,load(){time=0;},step(count){calls.push(count);time+=count*1e-5;return this.snapshot();},snapshot(){const value=Math.sin(2*Math.PI*1000*(time-1e-5));return {time,timeStep:1e-5,elements:compiled.mapping.map(c=>({current:0,voltages:c.pins.map(p=>c.id==='v1'&&p==='p'?value:c.id==='r2'&&p==='a'?2*value:0)}))};}};}
const e=engine(),session=A.createSession(e);session.loadDocument(doc);const frame=session.step(100,channels);
assert.equal(frame.sampleBatch.times.length,100);assert.equal(e.calls.length,100);assert.ok(e.calls.every(count=>count===1));
assert.ok(Math.max(...frame.sampleBatch.values.input)>.999,'Intermediate peak captured even when final frame is near zero');
frame.sampleBatch.values.input.forEach((v,i)=>{assert.ok(Math.abs(frame.sampleBatch.values.output[i]-2*v)<1e-12);assert.ok(Math.abs(frame.sampleBatch.values.difference[i]+v)<1e-12);});
assert.equal(frame.sampleBatch.times[0],0);assert.ok(Math.abs(frame.sampleBatch.times.at(-1)-.00099)<1e-12);
const before=session.snapshot();assert.throws(()=>session.step(2,[{id:'bad',positive:{componentId:'missing',pinId:'x'},negative:null}]),/Unknown scope/);assert.deepEqual(session.snapshot(),before,'Invalid channels do not advance/fault engine');
assert.throws(()=>session.step(2,[channels[0],channels[0]]),/duplicate/);assert.throws(()=>A.normalizeSampleChannels(Array.from({length:33},(_,i)=>({...channels[0],id:String(i)}))),/32/);
assert.throws(()=>session.step(2,[{...channels[0],positive:{kind:'pin',...channels[0].positive}}]),/fields/);
session.step(10);assert.equal(e.calls.at(-1),10,'Unsampled callers retain one bounded engine call');
// Explicit probe graph resolution is deterministic, including differential and orphan targets.
const m=CircuitEditorModel.create(doc);m.addProbe({kind:'wire',id:'w2',point:{x:240,y:80}});
const resolved=CircuitEditorModel.scopeChannels(m.document);assert.equal(resolved.channels.length,2);assert.equal(resolved.unresolved.length,0);
const split=m.document;split.electrical.wires.reverse();assert.deepEqual(CircuitEditorModel.scopeChannels(split),resolved);
const orphan=structuredClone(split);orphan.electrical.wires=orphan.electrical.wires.filter(w=>!w.from.junctionId&&!w.to.junctionId);
assert.ok(CircuitEditorModel.scopeChannels(orphan).unresolved.length>0);
// Coordinator captures channel configuration at request time, independent of changes in flight.
let workerSession,request=0,state={documentId:null,circuitRevision:0,runEpoch:0};
const coordinator=CircuitSimulation.create({autoRun:false,workerFactory:options=>{
  workerSession=A.createSession(engine());const protocol=CircuitRevisionProtocol.create(workerSession);
  protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++request,operation:'initialize'});
  return {ready:Promise.resolve({}),terminate(){},async request(operation,extra={}){
    const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++request,operation,base:state,...extra});
    state=reply.state;if(!reply.ok)throw Object.assign(new Error(reply.error.message),reply.error);return reply.result;
  }};
}});
await coordinator.setDocument(doc);coordinator.setSampleChannels(channels);
const pending=coordinator.step(10);coordinator.setSampleChannels([channels[0]]);
assert.equal((await pending).sampleBatch.channels.length,3,'In-flight batch retains original channel set');
assert.equal((await coordinator.step(10)).sampleBatch.channels.length,1);
coordinator.setSampleChannels([]);assert.ok(!('sampleBatch' in await coordinator.step(10)));coordinator.dispose();
console.log('Scope sampling checks passed: per-step peaks/differentials, pre-mutation validation, unsampled compatibility, graph resolution and in-flight channel configuration.');
