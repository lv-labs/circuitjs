import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
const document=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url)));
const compiled=CircuitDocumentAdapter.compile(document);
const projection=JSON.parse(compiled.canonical);
assert.equal(CircuitDocumentAdapter.fromProjection(projection,document.id).canonical,compiled.canonical);
const corrupt=structuredClone(projection); corrupt.devices[0].pins.g='invented-net';
assert.throws(()=>CircuitDocumentAdapter.fromProjection(corrupt,document.id),e=>e.code==='INVALID_DOCUMENT');
function fakeAdapter() {
  let time=0,sequence=0;
  return {steps:0,
    installProjection(){time=0;sequence=0;return {frameAvailable:false};},
    step(count){this.steps+=count;time+=count*1e-5;return {time,timeStep:1e-5,frameSequence:++sequence,pinVoltages:{},componentCurrents:{}};},
    snapshot(){return {time,timeStep:1e-5,frameSequence:sequence};},
    reset(){time=0;sequence=0;return {frameAvailable:false};}};
}
const adapter=fakeAdapter(), protocol=CircuitRevisionProtocol.create(adapter);
const initial={documentId:null,circuitRevision:0,runEpoch:0};
const installed={documentId:document.id,circuitRevision:7,runEpoch:3};
const message=(requestId,operation,extra={})=>({protocolVersion:1,sessionId:'A',requestId,operation,base:installed,payload:{},...extra});
assert.ok(protocol.handle(message(1,'initialize')).ok);
assert.ok(protocol.handle(message(2,'installCircuit',{base:initial,target:installed,payload:{circuit:projection}})).ok);
assert.equal(protocol.handle(message(3,'step',{base:{...installed,runEpoch:2},payload:{count:10}})).error.code,'STALE_BASE');
assert.equal(protocol.handle(message(3,'step',{payload:{count:10}})).error.code,'DUPLICATE_REQUEST');
assert.equal(adapter.steps,0,'Rejected requests must not advance engine');
const stepReply=protocol.handle(message(4,'step',{payload:{count:10}}));
assert.ok(stepReply.ok); assert.equal(stepReply.result.circuitRevision,7); assert.equal(stepReply.result.sessionId,'A');
assert.equal(protocol.handle({...message(100,'step'),sessionId:'wrong'}).error.code,'SESSION_MISMATCH');
assert.equal(protocol.handle({...message(100,'step'),protocolVersion:99}).error.code,'INVALID_PROTOCOL');
const resetState={...installed,runEpoch:4};
assert.ok(protocol.handle(message(5,'reset',{target:resetState,payload:{statePolicy:'reset'}})).ok);
assert.equal(protocol.handle(message(6,'step',{payload:{count:10}})).error.code,'STALE_BASE');
assert.equal(adapter.steps,10);
assert.equal(protocol.handle(message(7,'setSwitch',{base:resetState})).error.code,'UNSUPPORTED_LIVE_CHANGE');
assert.ok(protocol.handle(message(8,'dispose',{base:resetState})).ok);
assert.equal(protocol.handle(message(9,'snapshot',{base:resetState})).error.code,'SESSION_DISPOSED');
const gate=CircuitSimulation.isCurrentFrame;
const frame={protocolVersion:1,sessionId:'A',...installed,frameSequence:2};
assert.ok(gate(frame,{sessionId:'A',...installed},1));
for(const change of [{sessionId:'old'},{documentId:'other'},{circuitRevision:6},{runEpoch:2},{frameSequence:1},{protocolVersion:99}])
  assert.equal(gate({...frame,...change},{sessionId:'A',...installed},1),false);

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plans=[], workers=[], frames=[];
function factory(options) {
  const plan=plans.shift()||{}, death=deferred();
  death.promise.catch(()=>{});
  const w={sessionId:options.sessionId,terminated:false,time:0,sequence:0,identity:null,
    ready:Promise.race([plan.readyGate?.promise||Promise.resolve({}),death.promise]),
    async request(operation,{target,payload}={}) {
      if(w.terminated)throw new Error('Terminated');
      if(operation==='installCircuit') {
        if(plan.installGate)await Promise.race([plan.installGate.promise,death.promise]);
        if(plan.failInstall)throw Object.assign(new Error('Candidate failed after installation'),{code:'ENGINE_FAILURE'});
        w.identity=target;w.time=0;w.sequence=0;
        return {...target,sessionId:w.sessionId};
      }
      if(operation==='step') {
        if(plan.stepGate)await Promise.race([plan.stepGate.promise,death.promise]);
        w.time+=payload.count*1e-5;
        return {protocolVersion:1,...w.identity,sessionId:w.sessionId,time:w.time,timeStep:1e-5,
          frameSequence:++w.sequence,pinVoltages:{},componentCurrents:{}};
      }
      throw new Error('Unexpected fake request');
    },
    terminate(){if(w.terminated)return;w.terminated=true;death.reject(new Error('Terminated'));},
    crash(){w.terminate();options.onFailure(new Error('Worker crashed'));}};
  workers.push(w);
  assert.ok(workers.filter(x=>!x.terminated).length<=2,'At most one active and one candidate');
  return w;
}
const changed=value=>{const d=structuredClone(document);d.electrical.components.find(c=>c.id==='r2').parameters.resistance=value;return d;};
const coordinator=CircuitSimulation.create({workerFactory:factory,onFrame:frame=>frames.push(frame)});
await coordinator.setDocument(document);
const firstIdentity=coordinator.getState().accepted;
await coordinator.step(10);
const firstTime=coordinator.getState().frame.time;
const layout=structuredClone(document);layout.layout.components.r1.x+=100;
assert.ok((await coordinator.setDocument(layout)).reused);
assert.equal(workers.length,1); assert.equal(coordinator.getState().accepted.runEpoch,firstIdentity.runEpoch);
assert.equal(coordinator.getState().frame.time,firstTime);
// Drain an old step, suppress its result, and only then stage the new worker.
const old=workers[0];
const gateStep=deferred();
const originalRequest=old.request;
old.request=async (...args)=>{if(args[0]==='step')await gateStep.promise;return originalRequest(...args);};
const pendingStep=coordinator.step(10);
await assert.rejects(coordinator.step(1),e=>e.code==='BUSY');
const candidateGate=deferred();plans.push({installGate:candidateGate});
const replacement=coordinator.setDocument(changed(2000));
assert.equal(coordinator.getState().frame,null);assert.equal(workers.length,1);
gateStep.resolve();assert.equal(await pendingStep,null);
await tick();assert.equal(workers.length,2);assert.equal(old.terminated,false);
candidateGate.resolve();await replacement;
assert.equal(old.terminated,true);assert.equal(frames.length,1,'Stale step was never published');
assert.equal(coordinator.getState().accepted.circuitRevision,2);
await coordinator.step(5);
// Failed candidate retains the old accepted solver, including its time.
const retained=workers.at(-1), retainedTime=retained.time;
plans.push({failInstall:true});
await assert.rejects(coordinator.setDocument(changed(3000)),e=>e.code==='ENGINE_FAILURE');
assert.equal(retained.terminated,false);assert.equal(retained.time,retainedTime);
assert.equal(coordinator.getState().accepted.sessionId,retained.sessionId);
assert.equal(coordinator.getState().frame,null);assert.ok(coordinator.getState().historicalFrame);
await assert.rejects(coordinator.step(1),e=>e.code==='NO_CURRENT_CIRCUIT');
// Invalid document does not create a worker; undo content creates a new version.
const count=workers.length, invalid=changed(0);
await assert.rejects(coordinator.setDocument(invalid),e=>e.code==='INVALID_DOCUMENT');
assert.equal(workers.length,count);assert.equal(retained.terminated,false);
await coordinator.setDocument(changed(2000));
assert.equal(coordinator.getState().accepted.circuitRevision,5);
await coordinator.step(1);
// Latest edit supersedes a candidate waiting on startup.
const startup=deferred();plans.push({readyGate:startup});
const obsolete=coordinator.setDocument(changed(4000));await tick();
const obsoleteWorker=workers.at(-1);
const latest=coordinator.setDocument(changed(5000));
assert.ok((await obsolete).superseded);await latest;
assert.equal(obsoleteWorker.terminated,true);
assert.equal(coordinator.getState().accepted.circuitRevision,7);
// Layout changes during installation neither cancel nor duplicate the candidate.
const install=deferred();plans.push({installGate:install});
const electrical=coordinator.setDocument(changed(6000));await tick();
const during=workers.length, moved=changed(6000);moved.layout.components.r2.y=999;
const layoutWhileLoading=coordinator.setDocument(moved);
assert.equal(workers.length,during);install.resolve();await Promise.all([electrical,layoutWhileLoading]);
// Reset creates a new session/epoch but keeps circuit revision, and clears overlay immediately.
await coordinator.step(10);
const beforeReset=coordinator.getState().accepted;
const resetting=coordinator.reset();assert.equal(coordinator.getState().frame,null);await resetting;
const afterReset=coordinator.getState().accepted;
assert.equal(afterReset.circuitRevision,beforeReset.circuitRevision);
assert.ok(afterReset.runEpoch>beforeReset.runEpoch);assert.notEqual(afterReset.sessionId,beforeReset.sessionId);
assert.equal((await coordinator.step(1)).frameSequence,1);
const preservedAfterReset=workers.at(-1);
plans.push({failInstall:true});
await assert.rejects(coordinator.reset(),e=>e.code==='ENGINE_FAILURE');
assert.equal(preservedAfterReset.terminated,false);
assert.equal(coordinator.getState().frame,null,'Failed reset must not revive old live overlay');
await assert.rejects(coordinator.step(1),e=>e.code==='NO_CURRENT_CIRCUIT');
await coordinator.reset();
workers.at(-1).crash();assert.equal(coordinator.getState().status,'error');assert.equal(coordinator.getState().frame,null);
await coordinator.reset();assert.equal(coordinator.getState().status,'paused');
// Disposal cancels a staged worker and cannot allow late activation.
const finalGate=deferred();plans.push({installGate:finalGate});
const final=coordinator.setDocument(changed(7000));await tick();coordinator.dispose();
assert.ok((await final).superseded);assert.equal(coordinator.getState().status,'disposed');
assert.equal(workers.filter(w=>!w.terminated).length,0);
// An editor observer can immediately commit another edit while notified of load.
let reentrant, followup, triggered=false;
reentrant=CircuitSimulation.create({workerFactory:factory,onState:state=>{
  if(state.status==='loading' && !triggered) {triggered=true;followup=reentrant.setDocument(changed(9000));}
}});
const firstLoad=reentrant.setDocument(document);
assert.ok((await firstLoad).superseded);await followup;
assert.equal(reentrant.getState().accepted.circuitRevision,2);
await reentrant.step(1);reentrant.dispose();
assert.equal(workers.filter(w=>!w.terminated).length,0);
console.log('Revision/coordinator checks passed: protocol guards, projection validation, races, reset, failed candidates and worker lifecycle.');
