import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
import {createEngine} from './engine_node_runtime.mjs';
import {outputFamilyCircuit} from './output_family_fixtures.mjs';
import {passiveMenuCircuit} from './passive_menu_fixtures.mjs';
import {expansionCircuit} from './component_expansion_fixtures.mjs';
import {logicDisplayCircuit} from './logic_display_fixtures.mjs';
const A=CircuitDocumentAdapter,M=CircuitEditorModel;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let installGate=null,stepGate=null,workers=0;
function workerFactory(options){
 workers++;const protocol=CircuitRevisionProtocol.create(A.createSession(createEngine()));let requestId=0,state={documentId:null,circuitRevision:0,runEpoch:0};
 const send=(operation,extra={})=>{const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++requestId,operation,base:state,...extra});state=reply.state;if(!reply.ok)throw Object.assign(new Error(reply.error.message),reply.error);return reply.result;};
 const ready=Promise.resolve(send('initialize'));
 return {ready,terminate(){},async request(op,extra){if(op==='installCircuit'&&installGate)await installGate.promise;if(op==='step'&&stepGate)await stepGate.promise;return send(op,extra);}};
}
function create(){
 const tasks=new Map();let id=0;
 const sim=CircuitSimulation.create({workerFactory,batchSteps:10,scheduleTask:fn=>{tasks.set(++id,fn);return id;},cancelTask:key=>tasks.delete(key)});
 return {sim,tasks,async fire(){assert.equal(tasks.size,1);const [key,fn]=tasks.entries().next().value;tasks.delete(key);fn();await tick();}};
}
const rc=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/switched-rc.json',import.meta.url)));
// Default run intent, layout edits, disconnected parts and reconnection.
{
 const {sim,tasks,fire}=create();await sim.setDocument(rc);assert.equal(sim.getState().runRequested,true);await fire();
 const epoch=sim.getState().accepted.runEpoch,time=sim.getState().frame.time;
 const moved=structuredClone(rc);moved.layout.components.r1.x+=64;assert.equal((await sim.setDocument(moved)).reused,true);assert.equal(sim.getState().accepted.runEpoch,epoch);assert.equal(sim.getState().frame.time,time);await fire();assert.ok(sim.getState().frame.time>time);
 const loose=structuredClone(moved);loose.electrical.components.push({id:'loose',reference:'R99',kind:'resistor',modelVersion:1,parameters:{resistance:1000}});loose.layout.components.loose={x:0,y:0,rotation:0,mirror:false};
 await sim.setDocument(loose);assert.equal(sim.getState().runRequested,true);await fire();assert.equal(sim.getState().error,null);assert.equal(sim.getState().frame.componentCurrents.loose,0);
 const disconnected=structuredClone(loose);disconnected.electrical.wires=disconnected.electrical.wires.filter(w=>![w.from,w.to].some(e=>e.componentId==='r1'));await sim.setDocument(disconnected);await fire();assert.equal(sim.getState().status,'running');
 await sim.setDocument(rc);await fire();assert.equal(sim.getState().status,'running');
 // Pause wins even if a replacement is still installing.
 installGate=deferred();const replacement=structuredClone(rc);replacement.electrical.components.find(c=>c.id==='r1').parameters.resistance=2000;const pending=sim.setDocument(replacement);await tick();await sim.pause();installGate.resolve();await pending;installGate=null;assert.equal(tasks.size,0);assert.equal(sim.getState().status,'paused');
 await sim.setDocument(rc);assert.equal(sim.getState().status,'paused');assert.equal(tasks.size,0);
 sim.run();await sim.reset();assert.equal(sim.getState().status,'running');assert.equal(tasks.size,1);
 // Temporary invalid edits retain intent; the next valid edit recovers automatically.
 const invalid=structuredClone(rc);invalid.electrical.components.find(c=>c.id==='r1').parameters.resistance=0;await assert.rejects(sim.setDocument(invalid));assert.equal(sim.getState().runRequested,true);assert.equal(tasks.size,0);await sim.setDocument(rc);await fire();assert.equal(sim.getState().status,'running');sim.dispose();assert.equal(tasks.size,0);
}
// Live source edits wait for the in-flight batch, retaining epoch/time and scheduling.
{
 const {sim,tasks,fire}=create(),d=outputFamilyCircuit('variableVoltage');await sim.setDocument(d);const epoch=sim.getState().accepted.runEpoch;
 stepGate=deferred();const firing=fire();await tick();const next=structuredClone(d);next.electrical.components[0].parameters.voltage=2;const changing=sim.setDocument(next);await tick();assert.equal(tasks.size,0);stepGate.resolve();await firing;await changing;stepGate=null;assert.equal(sim.getState().accepted.runEpoch,epoch);assert.equal(sim.getState().runRequested,true);await fire();assert.equal(sim.getState().frame.pinVoltages.part.p,2);assert.ok(sim.getState().frame.time>10*d.simulation.timeStep);sim.dispose();
}
// Each clickable switch/input uses the same live worker and retains simulation time.
for(const [kind,base,field,values] of [
 ['switch',rc,'closed',[false,true]],
 ['pushSwitch',passiveMenuCircuit('pushSwitch'),'normallyClosed',[true,false]],
 ['spdtSwitch',expansionCircuit('spdtSwitch'),'position',[1,2,0]],
 ['dpdtSwitch',expansionCircuit('dpdtSwitch'),'position',[1,0]],
 ['mbbSwitch',passiveMenuCircuit('mbbSwitch'),'position',[1,2,3,0]],
 ['logicInput',logicDisplayCircuit('logicInput'),'state',[0,1]]
]){
 const {sim,fire}=create();await sim.setDocument(base);await fire();const before=sim.getState(),workerCount=workers;let time=before.frame.time;
 for(const value of values){const d=structuredClone(base),c=d.electrical.components.find(c=>c.kind===kind);c.parameters[field]=value;const result=await sim.setDocument(d);assert.equal(result.appliedAtTime,time);assert.equal(sim.getState().accepted.runEpoch,before.accepted.runEpoch);assert.equal(sim.getState().runRequested,true);await fire();assert.ok(sim.getState().frame.time>time);time=sim.getState().frame.time;}
 assert.equal(workers,workerCount);sim.dispose();
}
// Original solver stabilizes a floating resistor, isolated source/load loop and loose inputs.
{
 const engine=createEngine(),session=A.createSession(engine),d=M.empty();d.electrical.components.push({id:'r',reference:'R',kind:'resistor',modelVersion:1,parameters:{resistance:1000}});session.loadDocument(d);let f=session.step(10);assert.equal(f.componentCurrents.r,0);assert.equal(f.pinVoltages.r.a,0);assert.equal(f.pinVoltages.r.b,0);
 const open=M.empty();open.electrical.components.push({id:'i',reference:'I',kind:'currentSource',modelVersion:1,parameters:{current:.01,maxVoltage:0}});assert.ok(A.compile(open).diagnostics.some(d=>d.code==='OPEN_CURRENT_SOURCE'));session.loadDocument(open);assert.ok(Object.values(session.step(10).componentCurrents).every(Number.isFinite));
 const isolated=structuredClone(rc);isolated.electrical.components=isolated.electrical.components.filter(c=>c.kind!=='ground');isolated.electrical.wires=isolated.electrical.wires.filter(w=>![w.from,w.to].some(e=>e.componentId==='g1'));session.loadDocument(isolated);f=session.step(20);assert.ok(Object.values(f.componentCurrents).every(Number.isFinite));
}
console.log('Running edits passed: auto-start, layout continuity, floating/disconnected parts, reconnect/reset resume, pause during install, invalid-edit recovery, in-flight slider edits and all live switch/input states.');
