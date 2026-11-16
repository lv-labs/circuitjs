import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
import {createEngine} from './engine_node_runtime.mjs';
import {outputFamilyKinds,outputFamilyCircuit} from './output_family_fixtures.mjs';
import {passiveMenuKinds,passiveMenuCircuit} from './passive_menu_fixtures.mjs';
import {expansionKinds,expansionCircuit} from './component_expansion_fixtures.mjs';
import {passiveSwitchKinds,passiveSwitchCircuit} from './passive_switch_fixtures.mjs';
import {logicDisplayKinds,logicDisplayCircuit} from './logic_display_fixtures.mjs';
import {flipFlopKinds,flipFlopCircuit} from './flip_flop_fixtures.mjs';
import {chipBatchKinds,chipBatchCircuit} from './chip_batch_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const rc=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/switched-rc.json',import.meta.url)));
function added(d){const next=structuredClone(d);next.electrical.components.push({id:'aaa-added',reference:'Rnew',kind:'resistor',modelVersion:1,parameters:{resistance:1000}});next.layout.components['aaa-added']={x:0,y:0,rotation:0,mirror:false};return next;}
function update(session,d){return session.updateProjection(JSON.parse(A.compile(d).canonical),d.id);}
// Every retained model survives an unrelated placement (including index shifts),
// agreeing with a continuously running control engine on the following step.
for(const [kinds,fixture] of [[outputFamilyKinds,outputFamilyCircuit],[passiveMenuKinds,passiveMenuCircuit],[expansionKinds,expansionCircuit],[passiveSwitchKinds,passiveSwitchCircuit],[logicDisplayKinds,logicDisplayCircuit],[flipFlopKinds,flipFlopCircuit],[chipBatchKinds,chipBatchCircuit]])for(const kind of kinds){
 const d=fixture(kind),session=A.createSession(createEngine()),control=A.createSession(createEngine());session.loadDocument(d);control.loadDocument(d);const f=session.step(100);control.step(100);
 const next=added(d),ack=update(session,next);near(ack.appliedAtTime,f.time);const actual=session.step(1),expected=control.step(1);near(actual.time,expected.time);
 for(const [id,pins] of Object.entries(expected.pinVoltages))for(const [pin,v] of Object.entries(pins))near(actual.pinVoltages[id][pin],v,1e-7);
 for(const [id,v] of Object.entries(expected.componentCurrents))near(actual.componentCurrents[id],v,1e-7);
 if(expected.componentMeasurements)assert.deepEqual(actual.componentMeasurements,expected.componentMeasurements,kind+' measurements survive reanalysis');
 if(['dataExport','audioOutput'].includes(kind))assert.deepEqual(session.readCapture('part'),control.readCapture('part'),kind+' capture survives reanalysis');
}
// Resistor edit preserves capacitor voltage and clock; next sample follows the new RC equation.
{
 const session=A.createSession(createEngine());session.loadDocument(rc);const f=session.step(100),d=structuredClone(rc);d.electrical.components.find(c=>c.id==='r1').parameters.resistance=2000;
 const c=rc.electrical.components.find(c=>c.kind==='capacitor'),pin=Object.keys(M.definitions[c.kind].pins)[0],v=f.pinVoltages[c.id][pin];
 const ack=update(session,d);near(ack.appliedAtTime,f.time);const next=session.step(1);near(next.time,f.time+rc.simulation.timeStep);near(next.pinVoltages[c.id][pin],(v*.1+5/2000)/(.1+1/2000+1/10000),1e-10);
 // Invalid edits are rejected before touching the running solver.
 const before=session.snapshot(),bad=structuredClone(d);bad.electrical.components.find(c=>c.id==='r1').parameters.resistance=0;assert.throws(()=>update(session,bad));assert.deepEqual(session.snapshot(),before);
}
// Named-node rewiring preserves charge; disconnecting/reconnecting changes only its next physical evolution.
{
 const d=outputFamilyCircuit('labeledNode');
 d.electrical.components.push({id:'alias',kind:'labeledNode',reference:'N2',modelVersion:1,parameters:{name:'NET'}},{id:'load',kind:'resistor',reference:'R',modelVersion:1,parameters:{resistance:1000}},{id:'cap',kind:'capacitor',reference:'C',modelVersion:1,parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}});
 d.electrical.wires.push({id:'al',from:{kind:'pin',componentId:'alias',pinId:'in'},to:{kind:'pin',componentId:'load',pinId:'a'}},{id:'lg',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}},{id:'ac',from:{kind:'pin',componentId:'alias',pinId:'in'},to:{kind:'pin',componentId:'cap',pinId:'a'}},{id:'cg',from:{kind:'pin',componentId:'cap',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
 // Add series resistance to avoid an ideal source/capacitor loop in the initial circuit.
 d.electrical.components.push({id:'series',kind:'resistor',reference:'Rs',modelVersion:1,parameters:{resistance:1000}});
 d.electrical.wires.find(w=>w.to.componentId==='part').to={kind:'pin',componentId:'series',pinId:'a'};
 d.electrical.wires.push({id:'sp',from:{kind:'pin',componentId:'series',pinId:'b'},to:{kind:'pin',componentId:'part',pinId:'in'}});
 const session=A.createSession(createEngine());session.loadDocument(d);const before=session.step(100),disconnected=structuredClone(d);disconnected.electrical.components.find(c=>c.id==='alias').parameters.name='OTHER';
 update(session,disconnected);const decay=session.step(1);near(decay.time,before.time+d.simulation.timeStep);near(decay.pinVoltages.cap.a,before.pinVoltages.cap.a/1.01,1e-9);
 update(session,d);const connected=session.step(1);near(connected.pinVoltages.cap.a,(decay.pinVoltages.cap.a*.1+.005)/.102,1e-9);near(connected.time,before.time+2*d.simulation.timeStep);
}
// Editing capacitance/inductance updates the existing dynamic model; timestep edits retain time.
{
 const d=outputFamilyCircuit('variableVoltage');d.electrical.components.push({id:'cap',kind:'capacitor',reference:'C',modelVersion:1,parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}});
 d.electrical.wires=d.electrical.wires.filter(w=>!(w.from.componentId==='load'&&w.from.pinId==='b'));d.electrical.wires.push({id:'lc',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'cap',pinId:'a'}},{id:'cg',from:{kind:'pin',componentId:'cap',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
 const session=A.createSession(createEngine());session.loadDocument(d);let f=session.step(100),v=f.pinVoltages.cap.a,t=f.time;d.electrical.components.find(c=>c.id==='cap').parameters.capacitance=2e-6;update(session,d);f=session.step(1);near(f.pinVoltages.cap.a,(v+.005*d.electrical.components[0].parameters.voltage)/1.005,1e-10);near(f.time,t+d.simulation.timeStep);
 v=f.pinVoltages.cap.a;t=f.time;d.simulation.timeStep=2e-5;update(session,d);f=session.step(1);near(f.time,t+2e-5);near(f.pinVoltages.cap.a,(v+.01*d.electrical.components[0].parameters.voltage)/1.01,1e-10);
 const l=structuredClone(d);l.electrical.components=l.electrical.components.map(c=>c.id==='cap'?{...c,kind:'inductor',parameters:{inductance:1,initialCurrent:0,integration:'backwardEuler'}}:c);l.electrical.wires=l.electrical.wires.map(w=>structuredClone(w));session.loadDocument(l);f=session.step(20);const current=f.componentCurrents.cap;l.electrical.components.find(c=>c.id==='cap').parameters.inductance=2;update(session,l);f=session.step(1);near(f.componentCurrents.cap,(current+l.electrical.components[0].parameters.voltage*2e-5/2)/(1+1000*2e-5/2),1e-10);
}
// FIFO general edits stay on one worker/epoch while running; explicit Reset remains fresh.
{
 let workers=0,requests=0;const tasks=new Map();let timer=0;
 function workerFactory(options){workers++;const protocol=CircuitRevisionProtocol.create(A.createSession(createEngine()));let state={documentId:null,circuitRevision:0,runEpoch:0},seq=0;
  function send(operation,extra={}){const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++seq,operation,base:state,...extra});state=reply.state;if(!reply.ok)throw Object.assign(new Error(reply.error.message),reply.error);return reply.result;}
  return {ready:Promise.resolve({capabilities:send('initialize')}),terminate(){},async request(op,extra){if(op==='updateCircuit')requests++;return send(op,extra);}};
 }
 const sim=CircuitSimulation.create({workerFactory,scheduleTask:fn=>{tasks.set(++timer,fn);return timer;},cancelTask:key=>tasks.delete(key)});await sim.setDocument(rc);await sim.pause();const f=await sim.step(100),epoch=sim.getState().accepted.runEpoch;sim.run();
 const changes=[2000,3000,1500].map(resistance=>{const d=structuredClone(rc);d.electrical.components.find(c=>c.id==='r1').parameters.resistance=resistance;return sim.setDocument(d);});
 const replies=await Promise.all(changes);assert.ok(replies.every(r=>r.appliedAtTime===f.time));assert.equal(workers,1);assert.equal(requests,3);assert.equal(sim.getState().accepted.runEpoch,epoch);assert.equal(sim.getState().runRequested,true);
 await sim.setDocument(added(rc));assert.equal(workers,1);assert.equal(sim.getState().accepted.runEpoch,epoch);await sim.pause();const after=await sim.step(1);near(after.time,f.time+rc.simulation.timeStep);
 await sim.reset();assert.equal(workers,2);assert.notEqual(sim.getState().accepted.runEpoch,epoch);sim.dispose();
}
console.log('Live reanalysis passed: retained model families match continuous controls after placement/index shifts, RC charge survives value edits, invalid edits are atomic, and FIFO general edits retain worker/time/epoch.');
