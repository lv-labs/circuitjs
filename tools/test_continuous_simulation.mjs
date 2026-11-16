import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
const circuit=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/switched-rc.json',import.meta.url)));
const compile=CircuitDocumentAdapter.compile;
const compiled=compile(circuit),projection=JSON.parse(compiled.canonical);
assert.equal(CircuitDocumentAdapter.fromProjection(projection,circuit.id).canonical,compiled.canonical);
const opened=structuredClone(circuit);opened.electrical.components.find(d=>d.id==='s1').parameters.closed=false;
assert.notEqual(compile(opened).canonical,compiled.canonical);
for(const value of [0,-1,Infinity,NaN]) {
 const bad=structuredClone(circuit);bad.electrical.components.find(d=>d.id==='c1').parameters.capacitance=value;
 assert.throws(()=>compile(bad),e=>e.code==='INVALID_DOCUMENT');
}
const unsafe=structuredClone(circuit);
unsafe.electrical.wires.push({id:'short-cap',from:{kind:'pin',componentId:'c1',pinId:'a'},to:{kind:'pin',componentId:'c1',pinId:'b'}});
assert.throws(()=>compile(unsafe),e=>e.code==='INVALID_DOCUMENT');
let rawTime=0,loads=0,switches=0;
const session=CircuitDocumentAdapter.createSession({load(){loads++;rawTime=0;},
 step(count){rawTime+=count*1e-5;return {time:rawTime,timeStep:1e-5,elements:compiled.mapping.map(()=>({current:0,voltages:[0,0]}))};},
 setSwitch(){switches++;return {time:rawTime};}});
session.installProjection(projection,circuit.id);session.step(10);
const ack=session.setSwitch('s1',false);
assert.equal(loads,1);assert.equal(switches,1);assert.equal(ack.appliedAtTime,0.0001);
assert.throws(()=>session.snapshot(),e=>e.code==='NO_FRAME');
session.reset();assert.equal(loads,2);

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const timers=new Map();let timerID=0;
const scheduleTask=fn=>{const id=++timerID;timers.set(id,fn);return id;};
const cancelTask=id=>timers.delete(id);
const fire=()=>{assert.equal(timers.size,1);const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
const workers=[],events=[];let stepGate=null,switchGate=null,failStep=false,failSwitch=false;
function factory(options) {
 let state=null,time=0,seq=0;
 const worker={ready:Promise.resolve({}),terminated:false,
  async request(op,{target,payload}={}) {
   if(op==='installCircuit'){state=target;events.push(['install',target]);return {...target,sessionId:options.sessionId};}
   if(op==='step') {
    if(failStep){failStep=false;throw Object.assign(new Error('Solve failed'),{code:'ENGINE_FAILURE'});}
    events.push(['step',payload.count]);if(stepGate)await stepGate.promise;
    time+=payload.count*1e-5;
    return {protocolVersion:1,...state,sessionId:options.sessionId,time,timeStep:1e-5,frameSequence:++seq};
   }
   if(op==='setSwitch') {
    if(failSwitch){failSwitch=false;throw Object.assign(new Error('Restamp failed'),{code:'ENGINE_FAILURE',disposition:'faulted'});}
    events.push(['switch',payload.closed]);if(switchGate)await switchGate.promise;
    state=target;return {...state,sessionId:options.sessionId,appliedAtTime:time};
   }
   throw new Error(op);
  },terminate(){worker.terminated=true;}};
 workers.push(worker);return worker;
}
const simulation=CircuitSimulation.create({autoRun:false,workerFactory:factory,scheduleTask,cancelTask,batchSteps:10,intervalMs:0});
await simulation.setDocument(circuit);
const original=simulation.getState().accepted;
simulation.run();assert.equal(timers.size,1);fire();await tick();
assert.equal(simulation.getState().frame.time,0.0001);assert.equal(timers.size,1);
// A pause cancels a queued tick, while a pause during a batch drains exactly it.
await simulation.pause();assert.equal(timers.size,0);assert.equal(simulation.getState().status,'paused');
simulation.run();stepGate=deferred();fire();await tick();
let paused=false;const pausing=simulation.pause().then(()=>paused=true);
assert.equal(simulation.getState().status,'pausing');assert.equal(paused,false);assert.equal(timers.size,0);
stepGate.resolve();await pausing;stepGate=null;
assert.equal(simulation.getState().frame.time,0.0002);assert.equal(timers.size,0);
// Switch edits drain a pending batch and run in FIFO order before rescheduling.
simulation.run();stepGate=deferred();fire();await tick();
const before=events.length;
const open=simulation.setSwitch('s1',false),close=simulation.setSwitch('s1',true);
assert.equal(simulation.getState().status,'updating');assert.equal(simulation.getState().frame,null);
await tick();assert.equal(events.length,before,'No switch may overtake the current solve');
stepGate.resolve();await Promise.all([open,close]);stepGate=null;
assert.deepEqual(events.slice(before).map(e=>e[1]),[false,true]);
assert.equal(workers.length,1);assert.equal(simulation.getState().accepted.runEpoch,original.runEpoch);
assert.equal(simulation.getState().accepted.circuitRevision,3);assert.equal(timers.size,1);
await simulation.pause();
// setDocument classifies a sole switch edit as live as well.
await simulation.setDocument(opened);assert.equal(workers.length,1);assert.equal(simulation.getState().accepted.circuitRevision,4);
// Superseding a physical live request drains it before candidate installation.
switchGate=deferred();const changing=simulation.setSwitch('s1',true);await tick();
const replacement=structuredClone(circuit);replacement.electrical.components.find(d=>d.id==='r1').parameters.resistance=2000;
const replacing=simulation.setDocument(replacement);
assert.equal(workers.length,1);switchGate.resolve();assert.ok((await changing).superseded);await replacing;switchGate=null;
assert.equal(workers.length,2);assert.ok(workers[0].terminated);assert.equal(simulation.getState().runRequested,false);
// Reset preserves Run intent; disposal cancels all scheduled work.
simulation.run();await simulation.reset();assert.equal(timers.size,1);assert.equal(simulation.getState().status,'running');
failStep=true;simulation.run();fire();await tick();
assert.equal(simulation.getState().status,'error');assert.equal(simulation.getState().runRequested,false);assert.equal(timers.size,0);
await simulation.reset();simulation.run();failSwitch=true;
await assert.rejects(simulation.setSwitch('s1',false),e=>e.code==='ENGINE_FAILURE');
assert.equal(simulation.getState().status,'error');assert.equal(timers.size,0);assert.equal(simulation.getState().runRequested,false);
await simulation.reset();
simulation.run();simulation.dispose();assert.equal(timers.size,0);assert.equal(simulation.getState().status,'disposed');
// A switch requested by the activation observer is live, not another reset.
let early,editOnActivation,once=false;
const beforeEarly=workers.length;
early=CircuitSimulation.create({autoRun:false,workerFactory:factory,scheduleTask,cancelTask,onState:state=>{
 if(state.status==='paused' && !once){once=true;editOnActivation=early.setSwitch('s1',false);}
}});
await early.setDocument(circuit);await editOnActivation;
assert.equal(workers.length,beforeEarly+1);assert.equal(early.getState().accepted.circuitRevision,2);
assert.equal(early.getState().accepted.runEpoch,1);early.dispose();
console.log('Continuous/live checks passed: bounded run, queued/in-flight pause, FIFO edits, switch revisions, replacement drainage and disposal.');
