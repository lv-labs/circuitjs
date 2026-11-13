'use strict';
async function verifyContinuousSimulation(report) {
  const response=await fetch('examples/switched-rc.json');
  assert(response.ok,'Saved switched-RC document available');
  const document=await response.json();
  const reference=await (await fetch('reference.json')).json();
  const exact=CircuitSimulation.create();
  try {
    await exact.setDocument(document);
    const original=exact.getState().accepted;
    let previous=0;
    const publicPins={v1:['n','p'],r1:['a','b'],s1:['a','b'],c1:['a','b'],r2:['a','b'],g1:['g']};
    const indices={v1:0,r1:1,s1:2,c1:3,r2:4,g1:6};
    for(const sample of reference.traces.switchedRC) {
      const step=Math.round(sample.time/dt);
      const frame=await exact.step(step-previous);
      near(frame.time,sample.time,1e-12,'Document switch trace time');
      assert(frame.sessionId===original.sessionId && frame.runEpoch===original.runEpoch,'Live switch preserves worker/run');
      for(const [id,pins] of Object.entries(publicPins)) {
        const expected=sample.elements[indices[id]];
        pins.forEach((pin,post)=>near(frame.pinVoltages[id][pin],expected.voltages[post],1e-12,'Switched reference pin '+id+'.'+pin));
        if(id!=='g1')near(frame.componentCurrents[id],expected.current*(id==='v1'?-1:1),1e-12,'Switched reference current '+id);
      }
      if(step===100 || step===500) {
        const ack=await exact.setSwitch('s1',step===500);
        near(ack.appliedAtTime,frame.time,0,'Switch acts between completed steps');
        assert(exact.getState().frame===null,'Restamping is not advertised as a solved frame');
      }
      previous=step;
    }
    const before=exact.getState().accepted;
    await exact.setSwitch('s1',false);const revision=exact.getState().accepted.circuitRevision;
    await exact.reset();const reset=await exact.step(1);
    assert(reset.runEpoch>before.runEpoch && reset.circuitRevision===revision,'Reset advances run, retains switch revision');
    near(reset.pinVoltages.c1.a,0,1e-12,'Reset uses latest open switch and initial capacitor voltage');
    const initiallyCharged=structuredClone(document);
    initiallyCharged.electrical.components.find(d=>d.id==='s1').parameters.closed=false;
    initiallyCharged.electrical.components.find(d=>d.id==='c1').parameters.initialVoltage=1;
    await exact.setDocument(initiallyCharged);
    near((await exact.step(1)).pinVoltages.c1.a,1/(1+dt/0.01),1e-12,'Explicit nonzero initial charge used');
  } finally {exact.dispose();}

  const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
  let count=0,stopAt=3,finished=deferred(),pausePromise,changePromise,lastClosed=null,livePhase=false;
  const run=CircuitSimulation.create({batchSteps:20,intervalMs:0,onFrame:frame=>{
    count++;
    if(livePhase) {
      if(!changePromise) {
        lastClosed=frame;changePromise=run.setSwitch('s1',false);
      } else if(frame.circuitRevision>lastClosed.circuitRevision) {
        pausePromise=run.pause();finished.resolve();
      }
    } else if(count===stopAt) {pausePromise=run.pause();finished.resolve();}
  }});
  const timeout=setTimeout(()=>finished.resolve('timeout'),10000);
  try {
    await run.setDocument(document);
    const original=run.getState().accepted;
    run.run();
    assert(await finished.promise!=='timeout','Continuous batches completed');await pausePromise;
    assert(count===3 && run.getState().status==='paused','Pause stops after requested in-flight batch');
    near(run.getState().frame.time,60*dt,1e-12,'Three bounded automatic batches');
    const pausedTime=run.getState().frame.time;
    await new Promise(resolve=>setTimeout(resolve,60));
    near(run.getState().frame.time,pausedTime,0,'No automatic steps after pause acknowledgement');
    stopAt=5;finished=deferred();run.run();await finished.promise;await pausePromise;
    near(run.getState().frame.time,100*dt,1e-12,'Resume continues previous state');
    assert(run.getState().accepted.sessionId===original.sessionId,'Resume does not replace worker');
    livePhase=true;finished=deferred();run.run();await finished.promise;await pausePromise;
    const ack=await changePromise, frame=run.getState().frame;
    near(ack.appliedAtTime,lastClosed.time,0,'Continuous switch priority at next boundary');
    assert(frame.sessionId===original.sessionId && frame.runEpoch===original.runEpoch,'Running switch edit keeps session/epoch');
    near(frame.pinVoltages.c1.a,lastClosed.pinVoltages.c1.a*Math.pow(1/(1+dt/0.01),20),1e-12,'Continuous live switch retains capacitor charge');
    assert(frame.circuitRevision===lastClosed.circuitRevision+1,'New frames carry switch revision');
    report.checks.push('Document RC switching matches unchanged CircuitJS traces at all sample times (pins/currents within 1e-12)');
    report.checks.push('Continuous run: bounded batches, acknowledged pause, stateful resume and live switch before next batch');
  } finally {clearTimeout(timeout);run.dispose();}
}
