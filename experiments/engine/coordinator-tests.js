'use strict';
async function verifyCoordinator(report) {
  const document=await (await fetch('examples/voltage-divider.json')).json();
  const projection=JSON.parse(CircuitDocumentAdapter.compile(document).canonical);
  const direct=createRevisionWorker();
  async function rejectsCode(action,code) {
    try {await action();} catch(error) {assert(error.code===code,`Expected ${code}, got ${error.code}: ${error.message}`);return;}
    throw new Error('Expected rejection: '+code);
  }
  try {
    const ready=await direct.ready;
    assert(ready.protocolVersion===1 && ready.dedicatedWorker && !ready.hasDocument,'Revision protocol runs in real worker');
    assert(ready.capabilities.liveChanges.includes('setSwitch:rc'),'Tested RC switch support advertised');
    const target={documentId:document.id,circuitRevision:10,runEpoch:20};
    const corrupted=structuredClone(projection);corrupted.devices[0].pins.g='invented-net';
    await rejectsCode(()=>direct.request('installCircuit',{target,payload:{circuit:corrupted}}),'INVALID_DOCUMENT');
    assert(direct.state.documentId===null,'Worker revalidates projection before adoption');
    await direct.request('installCircuit',{target,payload:{circuit:projection}});
    await rejectsCode(()=>direct.request('step',{base:{...target,runEpoch:19},payload:{count:100}}),'STALE_BASE');
    await rejectsCode(()=>direct.request('snapshot'),'NO_FRAME');
    const frame=await direct.request('step',{payload:{count:100}});
    near(frame.time,0.001,1e-12,'Stale request did not advance real engine');
    assert(frame.circuitRevision===10 && frame.runEpoch===20 && frame.sessionId===direct.sessionId,'Frame carries accepted identity');
    await direct.request('reset',{target:{...target,runEpoch:21},payload:{statePolicy:'reset'}});
    await rejectsCode(()=>direct.request('step',{base:target,payload:{count:1}}),'STALE_BASE');
    const reset=await direct.request('step',{payload:{count:1}});
    near(reset.time,dt,1e-12,'Protocol reset restarts engine');
    assert(reset.runEpoch===21 && reset.frameSequence===1,'Protocol reset advances epoch and resets frame sequence');
    await rejectsCode(()=>direct.request('setSwitch',{target:{...target,runEpoch:21,circuitRevision:11},payload:{componentId:'s1',closed:false,statePolicy:'preserve'}}),'INVALID_DOCUMENT');
  } finally {direct.terminate();}

  const records=[], published=[];
  let failNextInstall=false, holdStep=null;
  const coordinator=CircuitSimulation.create({autoRun:false,onFrame:frame=>published.push(frame),workerFactory:options=>{
    const client=createRevisionWorker(options), record={client,terminated:false};
    const request=client.request;
    record.client={...client,
      // This block exercises candidate replacement/failure isolation for clients
      // without native updates; native updateCircuit has separate coverage.
      ready:client.ready.then(ready=>({...ready,capabilities:{...ready.capabilities,liveChanges:ready.capabilities.liveChanges.filter(name=>name!=='updateCircuit')}})),
      request:async(operation,args)=>{
        const result=await request(operation,args);
        if(operation==='installCircuit' && failNextInstall) {
          failNextInstall=false;
          throw Object.assign(new Error('Injected failure after candidate loaded'),{code:'ENGINE_FAILURE'});
        }
        if(operation==='step' && holdStep?.record===record) {
          const gate=holdStep;gate.entered();await gate.promise;
        }
        return result;
      },
      terminate:()=>{record.terminated=true;client.terminate();}};
    records.push(record);return record.client;
  }});
  const changed=value=>{const d=structuredClone(document);d.electrical.components.find(c=>c.id==='r2').parameters.resistance=value;return d;};
  try {
    await coordinator.setDocument(document);
    const original=await coordinator.step(100);
    near(original.pinVoltages.r2.a,2.5,1e-12,'Coordinator original output');
    const initial=coordinator.getState();
    const moved=structuredClone(document);moved.layout.components.r1.x+=200;
    assert((await coordinator.setDocument(moved)).reused,'Layout transaction reuses worker');
    assert(records.length===1 && coordinator.getState().documentRevision===2,'Layout increments document revision only');
    assert(coordinator.getState().frame.time===initial.frame.time,'Layout retains current frame/time');

    let release,entered;
    const enteredPromise=new Promise(resolve=>entered=resolve);
    holdStep={record:records[0],entered,promise:new Promise(resolve=>release=resolve)};
    const pending=coordinator.step(100);
    await enteredPromise;
    const replacing=coordinator.setDocument(changed(2000));
    assert(coordinator.getState().frame===null && records.length===1,'Electrical edit immediately hides stale overlay and waits for old step');
    release();assert(await pending===null,'Delayed old frame is dropped');holdStep=null;
    await replacing;
    assert(records.length===2 && records[0].terminated,'Candidate activates before old worker is disposed');
    assert(published.length===1,'Old step never reached renderer');
    const updated=await coordinator.step(100);
    near(updated.pinVoltages.r2.a,10/3,1e-12,'Replacement circuit output');
    assert(updated.circuitRevision===2 && updated.runEpoch>original.runEpoch && updated.sessionId!==original.sessionId,'Replacement identity advances');
    assert(!CircuitSimulation.isCurrentFrame(original,coordinator.getState().accepted),'Old session frames rejected');

    const retained=records[1], before=await retained.client.request('snapshot');
    failNextInstall=true;
    await rejectsCode(()=>coordinator.setDocument(changed(3000)),'ENGINE_FAILURE');
    const after=await retained.client.request('snapshot');
    assert(!retained.terminated && JSON.stringify(after)===JSON.stringify(before),'Failed loaded candidate leaves old engine state untouched');
    assert(coordinator.getState().status==='error' && coordinator.getState().frame===null,'Failed edit is not shown with old live results');
    assert(coordinator.getState().historicalFrame.sessionId===retained.client.sessionId,'Old result remains explicitly historical');
    await rejectsCode(()=>coordinator.step(1),'NO_CURRENT_CIRCUIT');
    await coordinator.setDocument(changed(2000));
    const restored=await coordinator.step(1);
    assert(restored.circuitRevision===4,'Undo content uses new revision, not old counter');
    const accepted=coordinator.getState().accepted;
    const resetPromise=coordinator.reset();assert(coordinator.getState().frame===null,'Reset invalidates live overlay immediately');
    await resetPromise;
    const reset=await coordinator.step(1);
    assert(reset.circuitRevision===accepted.circuitRevision && reset.runEpoch>accepted.runEpoch && reset.sessionId!==accepted.sessionId,'Safe reset uses new candidate run with same electrical revision');
    near(reset.time,dt,1e-12,'Coordinator reset time');near(reset.pinVoltages.r2.a,10/3,1e-12,'Coordinator resets latest document');
    assert(!CircuitSimulation.isCurrentFrame(restored,coordinator.getState().accepted),'Pre-reset frames rejected');
    report.checks.push('Revision worker: negotiated protocol, guarded requests, stamped frames and reset epochs');
    report.checks.push('Coordinator: layout reuse, stale in-flight rejection, real candidate activation/failure isolation, undo versions and safe reset');
  } finally {coordinator.dispose();}
}
