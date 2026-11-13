'use strict';
async function verifyDocumentWorker(report) {
  const response = await fetch('examples/voltage-divider.json');
  assert(response.ok, 'Saved divider example available');
  const document = await response.json();
  const worker = createDocumentWorker();
  async function rejectsCode(action, code) {
    try { await action(); } catch (error) {
      assert(error.code === code, `Expected ${code}, received ${error.code}: ${error.message}`);
      return;
    }
    throw new Error('Expected rejection: ' + code);
  }
  function divider(frame, upper=1000, lower=1000) {
    const current=5/(upper+lower), output=current*lower;
    assert(frame.documentId===document.id,'Document identity preserved');
    assert(Object.keys(frame.pinVoltages).sort().join(',')==='g1,r1,r2,v1','Only public component IDs returned');
    assert(!Object.hasOwn(frame,'elements'),'No legacy index/element arrays');
    near(frame.pinVoltages.v1.p,5,1e-12,'Positive source pin');
    near(frame.pinVoltages.v1.n,0,1e-12,'Negative source pin');
    near(frame.pinVoltages.r1.a,5,1e-12,'R1 a');
    near(frame.pinVoltages.r1.b,output,1e-12,'R1 b');
    near(frame.pinVoltages.r2.a,output,1e-12,'R2 a');
    near(frame.pinVoltages.r2.b,0,1e-12,'R2 b');
    near(frame.pinVoltages.g1.g,0,1e-12,'Ground pin');
    near(frame.componentCurrents.v1,-current,1e-12,'Source passive current sign');
    near(frame.componentCurrents.r1,current,1e-12,'R1 current');
    near(frame.componentCurrents.r2,current,1e-12,'R2 current');
    assert(!Object.hasOwn(frame.componentCurrents,'g1'),'Unknown ground current is omitted');
    near(5*frame.componentCurrents.v1+(5-output)*frame.componentCurrents.r1+
      output*frame.componentCurrents.r2,0,1e-12,'Power balance');
  }
  try {
    const ready=await worker.ready;
    assert(ready.documentAdapterVersion===1 && ready.dedicatedWorker && !ready.hasDocument,'Document adapter runs in worker');
    await rejectsCode(()=>worker.step(1),'NO_DOCUMENT');
    const loaded=await worker.loadDocument(document);
    assert(loaded.netCount===3 && !loaded.frameAvailable,'Saved graph compiles to three nets; no fabricated frame at load');
    await rejectsCode(()=>worker.snapshot(),'NO_FRAME');
    const original=await worker.step(100);
    divider(original);
    near(original.time,0.001,1e-12,'Document timestep used');
    assert(original.frameSequence===1,'First completed frame');
    assert(JSON.stringify(await worker.snapshot())===JSON.stringify(original),'Snapshot is latest completed frame');

    const moved=structuredClone(document);
    moved.electrical.components.reverse(); moved.electrical.wires.reverse(); moved.electrical.junctions.reverse();
    for (const pose of Object.values(moved.layout.components)) Object.assign(pose,{x:0,y:0,rotation:270,mirror:true});
    for (const route of Object.values(moved.layout.wires)) route.bends=[{x:0,y:0},{x:64,y:64}];
    await worker.loadDocument(moved);
    assert(JSON.stringify(await worker.step(100))===JSON.stringify(original),'Geometry and serialization order do not affect results');
    const invalid=structuredClone(document);
    invalid.electrical.wires[0].from.pinId='nonexistent';
    await rejectsCode(()=>worker.loadDocument(invalid),'INVALID_DOCUMENT');
    await rejectsCode(()=>worker.step(0),'INVALID_DOCUMENT');
    assert(JSON.stringify(await worker.snapshot())===JSON.stringify(original),'Validation failures preserve running document');

    const rewired=structuredClone(document);
    rewired.electrical.wires.find(w=>w.id==='w3').from={kind:'pin',componentId:'v1',pinId:'p'};
    await worker.loadDocument(rewired);
    const reconnected=await worker.step(1);
    near(reconnected.pinVoltages.r2.a,5,1e-12,'Explicit reconnection changes net');
    near(reconnected.componentCurrents.r2,0.005,1e-12,'Reconnected resistor current');
    near(reconnected.componentCurrents.r1,0,1e-12,'Open-ended branch carries no current');
    assert(reconnected.diagnostics.some(d=>d.code==='UNCONNECTED_PIN'),'Dangling pin diagnostic');

    const shorted=structuredClone(document);
    shorted.electrical.wires.find(w=>w.id==='w2').to={kind:'pin',componentId:'r1',pinId:'a'};
    await worker.loadDocument(shorted);
    const shortFrame=await worker.step(1);
    near(shortFrame.pinVoltages.r1.a,shortFrame.pinVoltages.r1.b,1e-12,'Explicitly shorted device has equal pin voltages');
    near(shortFrame.componentCurrents.r1,0,1e-12,'Shorted resistor current');

    const groundedOutput=structuredClone(document);
    groundedOutput.electrical.components.push({id:'g2',kind:'ground',modelVersion:1,reference:'GND2',parameters:{}});
    groundedOutput.electrical.wires.push({id:'w-ground-out',from:{kind:'pin',componentId:'g2',pinId:'g'},to:{kind:'junction',junctionId:'j-out'}});
    groundedOutput.layout.components.g2={x:500,y:500,rotation:0,mirror:false};
    groundedOutput.layout.wires['w-ground-out']={bends:[]};
    await worker.loadDocument(groundedOutput);
    const grounded=await worker.step(1);
    near(grounded.pinVoltages.r2.a,0,1e-12,'Separate ground symbols share global ground');
    near(grounded.pinVoltages.g2.g,0,1e-12,'Second ground public pin');
    near(grounded.componentCurrents.r1,0.005,1e-12,'Globally grounded output current');

    const renamed=structuredClone(document);
    renamed.electrical.components.find(c=>c.id==='r1').id='__proto__';
    for (const wire of renamed.electrical.wires) for (const ref of [wire.from,wire.to])
      if(ref.componentId==='r1') ref.componentId='__proto__';
    renamed.layout.components=Object.fromEntries(Object.entries(renamed.layout.components).map(([k,v])=>[k==='r1'?'__proto__':k,v]));
    renamed.probes.find(p=>p.kind==='current').componentId='__proto__';
    await worker.loadDocument(renamed);
    const renamedFrame=await worker.step(1);
    assert(Object.hasOwn(renamedFrame.pinVoltages,'__proto__'),'Opaque IDs are safe object keys');
    near(renamedFrame.pinVoltages.__proto__.b,2.5,1e-12,'Renamed component pin identity');
    near(renamedFrame.componentCurrents.__proto__,0.0025,1e-12,'Renamed current identity');

    const changed=structuredClone(document);
    changed.electrical.components.find(c=>c.id==='r2').parameters.resistance=2000;
    await worker.loadDocument(changed);
    divider(await worker.step(20),1000,2000);
    await worker.reset();
    await rejectsCode(()=>worker.snapshot(),'NO_FRAME');
    const replay=await worker.step(1);
    divider(replay,1000,2000);
    near(replay.time,dt,1e-12,'Reset restarts latest document');
    report.checks.push('Saved divider document: stable component/pin IDs, source sign, three nets and power balance');
    report.checks.push('Document worker: layout/order independence, explicit reconnection/shorts, safe opaque IDs, invalid-input preservation and latest-document reset');
  } finally {worker.terminate();}
}
