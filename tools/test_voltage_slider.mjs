import assert from 'node:assert/strict';
import '../experiments/engine/voltage-slider.js';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
import {createEngine} from './engine_node_runtime.mjs';
import {outputFamilyCircuit} from './output_family_fixtures.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tasks=new Map();let id=0,saved=2,physical=2,gate=null,commits=0,previewCount=0;
const slider=CircuitVoltageSlider.create({schedule:fn=>{tasks.set(++id,fn);return id;},cancel:key=>tasks.delete(key),
 preview(value){previewCount++;physical=value?.voltage??saved;return gate?.promise;},
 commit(value){if(saved===value.voltage)return false;saved=value.voltage;physical=saved;commits++;return true;}});
function fire(){assert.equal(tasks.size,1);const [id,fn]=tasks.entries().next().value;tasks.delete(id);fn();}
// Latest target wins; a slow worker does not receive an unbounded drag backlog.
slider.input('v',3);slider.input('v',4);assert.equal(tasks.size,1);gate=deferred();fire();assert.equal(physical,4);
for(let v=0;v<100;v++)slider.input('v',v/20);assert.equal(tasks.size,0);assert.equal(previewCount,1);
gate.resolve();gate=null;await tick();fire();await tick();assert.equal(physical,4.95);assert.equal(previewCount,2);assert.equal(saved,2);
slider.finish();assert.equal(saved,4.95);assert.equal(commits,1);assert.equal(slider.draft,null);assert.equal(tasks.size,0);
// Return to saved value after previews: history no-op still restores the source.
slider.input('v',1);fire();await tick();assert.equal(physical,1);slider.input('v',saved);slider.finish();assert.equal(physical,saved);assert.equal(commits,1);assert.equal(tasks.size,0);
// Cancel removes queued frames and restores saved value; a new gesture survives
// completion of an older pending update.
gate=deferred();slider.input('v',0);fire();slider.cancel();assert.equal(physical,saved);slider.input('v',3);gate.resolve();gate=null;await tick();fire();await tick();assert.equal(physical,3);slider.finish();assert.equal(commits,2);
slider.input('v',1);slider.clear();assert.equal(tasks.size,0);assert.equal(slider.draft,null);
// Real native source + RC load: repeated slider steps advance physics immediately,
// preserve epoch and follow the continuous capacitor recurrence without resetting.
const d=outputFamilyCircuit('variableVoltage'),M=CircuitEditorModel,A=CircuitDocumentAdapter;
d.electrical.components.push({id:'cap',reference:'C',kind:'capacitor',modelVersion:1,parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}});
d.electrical.wires=d.electrical.wires.filter(w=>!(w.from.componentId==='load'&&w.from.pinId==='b'));
d.electrical.wires.push({id:'rc',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'cap',pinId:'a'}},{id:'cg',from:{kind:'pin',componentId:'cap',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
let updates=0,workerCount=0;const timers=new Map();
function workerFactory(options){workerCount++;const protocol=CircuitRevisionProtocol.create(A.createSession(createEngine()));let requestId=0,state={documentId:null,circuitRevision:0,runEpoch:0};
 const send=(operation,extra={})=>{const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++requestId,operation,base:state,...extra});state=reply.state;if(!reply.ok)throw new Error(reply.error.message);return reply.result;};
 return {ready:Promise.resolve(send('initialize')),terminate(){},async request(op,args){if(op==='setVariableVoltage')updates++;return send(op,args);}};
}
const sim=CircuitSimulation.create({workerFactory,batchSteps:1,scheduleTask:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},cancelTask:key=>timers.delete(key)});
async function solve(){assert.equal(timers.size,1);const [key,t]=timers.entries().next().value;timers.delete(key);t.fn();await tick();}
await sim.setDocument(d);await solve();let f=sim.getState().frame,time=f.time,charge=f.pinVoltages.cap.a;const epoch=f.runEpoch;
for(let i=0;i<50;i++){
 const next=structuredClone(d),voltage=(i%10)/2;next.electrical.components[0].parameters.voltage=voltage;
 const pending=sim.setDocument(next),during=sim.getState();assert.equal(during.frame,null);assert.equal(CircuitSimulation.presentationFrame(during).time,time);await pending;
 assert.equal([...timers.values()][0].delay,0,'Live changes must prompt a solve before the next drag event');await solve();f=sim.getState().frame;
 const expected=(charge+voltage*.01)/1.01;assert.ok(Math.abs(f.pinVoltages.cap.a-expected)<1e-12);assert.ok(Math.abs(f.time-time-d.simulation.timeStep)<1e-14);assert.equal(f.runEpoch,epoch);charge=f.pinVoltages.cap.a;time=f.time;
}
assert.equal(workerCount,1);assert.equal(updates,50);await sim.pause();const next=structuredClone(d);next.electrical.components[0].parameters.voltage=4.9;await sim.setDocument(next);assert.equal(timers.size,0);assert.equal(sim.getState().runRequested,false);
const state=sim.getState();for(const status of ['error','loading','disposed'])assert.equal(CircuitSimulation.presentationFrame({...state,status}),null);assert.equal(CircuitSimulation.presentationFrame({...state,accepted:{...state.accepted,runEpoch:999}}),null);sim.dispose();
console.log('Voltage slider checks passed: bounded preview queue, final/no-op restore, cancellation, history, continuous native RC charge/time across 50 edits, prompt solves and safe presentation frames.');
