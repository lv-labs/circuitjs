import {adapter as CircuitDocumentAdapter, protocol as CircuitRevisionProtocol, simulation as CircuitSimulation, signals as CircuitScopeModel} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEngine} from './engine_node_runtime.mjs';
const A=CircuitDocumentAdapter,S=CircuitScopeModel;
const doc=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url)));
const channels=[{id:'out',positive:{componentId:'r2',pinId:'a'},negative:null}];
const buffer=S.create({capacity:100});buffer.setChannels(channels);
function workerFactory(options){let state={documentId:null,circuitRevision:0,runEpoch:0},requestId=0;const protocol=CircuitRevisionProtocol.create(A.createSession(createEngine()));
 const send=(operation,extra={})=>{const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++requestId,operation,base:state,...extra});state=reply.state;if(!reply.ok)throw new Error(reply.error.message);return reply.result;};
 return {ready:Promise.resolve(send('initialize')),terminate(){},async request(op,args){return send(op,args);}};
}
const sim=CircuitSimulation.create({autoRun:false,workerFactory,onState:s=>buffer.followState(s),onFrame:f=>assert.ok(buffer.append(f))});
sim.setSampleChannels(channels);await sim.setDocument(doc);await sim.step(10);
const first=buffer.window(1),epoch=sim.getState().acquisitionEpoch,solver=sim.getState().accepted.runEpoch;
const moved=structuredClone(doc);moved.layout.components.r1.x+=64;await sim.setDocument(moved);assert.equal(buffer.count,10);assert.equal(sim.getState().accepted.runEpoch,solver);await sim.step(5);assert.equal(buffer.count,15);assert.deepEqual(buffer.window(1).times.slice(0,10),first.times);
const placed=structuredClone(moved);placed.electrical.components.push({id:'loose',reference:'R99',kind:'resistor',modelVersion:1,parameters:{resistance:1000}});placed.layout.components.loose={x:0,y:0,rotation:0,mirror:false};
const before=buffer.window(1);await sim.setDocument(placed);assert.equal(buffer.count,15);assert.equal(sim.getState().acquisitionEpoch,epoch);assert.equal(sim.getState().accepted.runEpoch,solver);
const replacement=await sim.step(5);assert.ok(replacement.sampleBatch.times[0]>before.times.at(-1),'Native engine time continues through edits');let view=buffer.window(1);assert.equal(buffer.count,20);assert.deepEqual(view.times.slice(0,15),before.times);assert.deepEqual(view.channels[0].values.slice(0,15),before.channels[0].values);assert.ok(view.times[15]>view.times[14]);assert.ok(Math.abs(view.times[15]-view.times[14]-doc.simulation.timeStep)<1e-12);
// Repeated rewiring/rebuilds keep history and a monotonic acquisition time axis.
for(let i=0;i<4;i++){const next=structuredClone(placed);next.electrical.components.find(c=>c.id==='r2').parameters.resistance=1000+i*100;const count=buffer.count;await sim.setDocument(next);assert.equal(buffer.count,count);await sim.step(3);assert.equal(buffer.count,count+3);}
view=buffer.window(1);assert.ok(view.times.every((t,i)=>!i||t>view.times[i-1]));
// An invalid intermediate edit suspends acquisition without discarding its samples.
const bad=structuredClone(placed);bad.electrical.components.find(c=>c.id==='r1').parameters.resistance=0;const count=buffer.count;await assert.rejects(sim.setDocument(bad));assert.equal(buffer.count,count);assert.equal(buffer.append(replacement),false);await sim.setDocument(placed);await sim.step(2);assert.equal(buffer.count,count+2);
// User Reset/new document clears the scope, while stale earlier frames remain rejected.
await sim.reset();assert.equal(buffer.count,0);assert.equal(sim.getState().acquisitionEpoch,epoch+1);assert.equal(buffer.append(replacement),false);await sim.step(2);assert.equal(buffer.window(1).times[0],0);
const other=structuredClone(doc);other.id='different-document';await sim.setDocument(other);assert.equal(buffer.count,0);await sim.step(2);assert.equal(buffer.window(1).times[0],0);
sim.dispose();assert.equal(buffer.count,0);
console.log('Scope continuity passed: real-engine layout/placement/rebuilds retain history, timestamps continue without mutating engine time, invalid edits suspend, and explicit reset/new document reject stale samples.');
