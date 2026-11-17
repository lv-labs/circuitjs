import {adapter as CircuitDocumentAdapter, protocol as CircuitRevisionProtocol, simulation as CircuitSimulation} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {createEngine} from './engine_node_runtime.mjs';
import {outputFamilyCircuit} from './output_family_fixtures.mjs';
const A=CircuitDocumentAdapter;let holdCapture=false,releaseCapture;
function workerFactory(options){
 const protocol=CircuitRevisionProtocol.create(A.createSession(createEngine()));let sequence=1,state={documentId:null,circuitRevision:0,runEpoch:0};
 const initialized=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:sequence,operation:'initialize'});assert.ok(initialized.result.liveChanges.includes('setVariableVoltage'));
 return {ready:Promise.resolve(initialized.result),terminate(){},async request(operation,extra={}){
  const reply=protocol.handle({protocolVersion:1,sessionId:options.sessionId,requestId:++sequence,operation,base:state,...extra});state=reply.state;
  if(operation==='readCapture'&&holdCapture)await new Promise(resolve=>{releaseCapture=resolve;});
  if(!reply.ok)throw Object.assign(new Error(reply.error.message),reply.error);return reply.result;
 }};
}
// Queue three source edits between a running batch and its successor. Epoch/time are retained.
{
 const d=outputFamilyCircuit('variableVoltage'),coordinator=CircuitSimulation.create({autoRun:false,workerFactory,batchSteps:4,intervalMs:1});
 await coordinator.setDocument(d);const frame=await coordinator.step(100),epoch=coordinator.getState().accepted.runEpoch;coordinator.run();
 const revisions=[3,4,1].map(voltage=>{const next=structuredClone(d);next.electrical.components[0].parameters.voltage=voltage;return coordinator.setDocument(next);});
 const applied=await Promise.all(revisions);assert.ok(applied.every(x=>x.appliedAtTime===frame.time));assert.equal(coordinator.getState().accepted.runEpoch,epoch);assert.equal(coordinator.getState().runRequested,true);
 await coordinator.pause();const nextFrame=await coordinator.step(1);assert.equal(nextFrame.pinVoltages.part.p,1);assert.ok(nextFrame.time>frame.time);
 const next=structuredClone(d);next.electrical.components[0].parameters.voltage=1;next.electrical.components.push({id:'note',kind:'text',reference:'TXT',modelVersion:1,parameters:{text:'Hello',size:18}});next.layout.components.note={x:0,y:0,rotation:0,mirror:false};
 assert.equal((await coordinator.setDocument(next)).reused,true);assert.equal(coordinator.getState().accepted.runEpoch,epoch);assert.equal(coordinator.getState().frame.time,nextFrame.time);
 await assert.rejects(coordinator.readCapture('part'),/recorder/);assert.equal((await coordinator.step(1)).pinVoltages.part.p,1);coordinator.dispose();
}
// A stop trigger is a normal pause, retaining a usable worker and a final sampled frame.
{
 let resolveFrame;const captured=new Promise(resolve=>{resolveFrame=resolve;});
 const coordinator=CircuitSimulation.create({autoRun:false,workerFactory,batchSteps:1000,intervalMs:1,onFrame:frame=>resolveFrame(frame)});
 await coordinator.setDocument(outputFamilyCircuit('stopTrigger',{delay:.0001}));coordinator.setSampleChannels([{id:'v',positive:{componentId:'part',pinId:'in'},negative:null}]);coordinator.run();
 const frame=await captured;await Promise.resolve();assert.equal(frame.stopRequested,true);assert.ok(frame.sampleBatch.times.length<1000);assert.equal(coordinator.getState().runRequested,false);assert.equal(coordinator.getState().status,'paused');assert.equal(coordinator.getState().error,null);assert.ok((await coordinator.step(1)).time>frame.time);coordinator.dispose();
}
// Reads never advance the solver, and results from a replaced recorder are rejected.
{
 const d=outputFamilyCircuit('dataExport',{capacity:3}),coordinator=CircuitSimulation.create({autoRun:false,workerFactory});await coordinator.setDocument(d);const frame=await coordinator.step(10),capture=await coordinator.readCapture('part');assert.deepEqual(capture.values,[5,5,5]);assert.equal(coordinator.getState().frame.time,frame.time);
 holdCapture=true;const pending=coordinator.readCapture('part');await Promise.resolve();await Promise.resolve();assert.ok(releaseCapture);
 const next=structuredClone(d);next.electrical.components[0].parameters.capacity=4;await coordinator.setDocument(next);holdCapture=false;releaseCapture();await assert.rejects(pending,/changed while reading/);coordinator.dispose();
}
console.log('Output coordinator checks passed: FIFO live voltage edits with unchanged epoch/time, annotation reuse, nonfaulting trigger pause, capture reads and stale-recorder rejection.');
