'use strict';
async function verifyOpamps(report,engine) {
  const base=await (await fetch('examples/opamp-noninverting.json')).json(),worker=createDocumentWorker();
  const gain=100000;
  const session=CircuitDocumentAdapter.createSession(engine);
  try {
    await worker.ready;
    for(const input of [1,-1,20,-20]) {
      const d=structuredClone(base);d.electrical.components.find(c=>c.id==='vin').parameters.waveform.voltage=input;
      await worker.loadDocument(d);const frame=await worker.step(10);
      session.loadDocument(d);const main=session.step(10);
      const out=frame.pinVoltages.u1.out;
      if(Math.abs(input)===1)near(out,input*2*gain/(gain+2),1e-10,'Finite-gain non-inverting output');
      else near(out,input>0?15:-15,.01,'Op-amp output limit');
      for(const pin of ['minus','plus','out'])near(frame.pinVoltages.u1[pin],main.pinVoltages.u1[pin],1e-10,'Worker/main op-amp pin mapping');
      near(frame.componentCurrents.u1,out*(1/10000+1/20000),1e-10,'Positive op-amp output current is delivered into load/feedback');
      await worker.reset();const reset=await worker.step(10);near(reset.pinVoltages.u1.out,out,1e-10,'Op-amp reset');
    }
    const inverted=structuredClone(base);
    inverted.electrical.wires.find(w=>w.id==='w1').from={kind:'pin',componentId:'g1',pinId:'g'};
    inverted.electrical.wires.find(w=>w.id==='w10').to={kind:'pin',componentId:'vin',pinId:'p'};
    await worker.loadDocument(inverted);const inv=await worker.step(10);
    near(inv.pinVoltages.u1.out,-gain/(gain+2),1e-10,'Inverting amplifier finite-gain output');
    const follower=structuredClone(base);
    follower.electrical.wires.find(w=>w.id==='w3').to={kind:'junction',junctionId:'output'};
    await worker.loadDocument(follower);const unity=await worker.step(10);
    near(unity.pinVoltages.u1.out,gain/(gain+1),1e-10,'Voltage follower output');
    const before=JSON.stringify(await worker.snapshot());
    const bad=structuredClone(base);bad.electrical.components.find(c=>c.id==='u1').parameters.gain=0;
    let rejected=false;try{await worker.loadDocument(bad);}catch(error){rejected=error.code==='INVALID_DOCUMENT';}
    assert(rejected&&JSON.stringify(await worker.snapshot())===before,'Invalid op-amp leaves worker session intact');
    rejects(()=>engine.load('a 32 32 64 32 0 15 -15 1000000 0 0 100000',1e-5),'Op-amp text requires explicit gain flag');
    rejects(()=>engine.load('a 32 32 64 32 8 -15 15 1000000 0 0 100000',1e-5),'Op-amp text rejects reversed output limits');
    report.checks.push('Op-amp: real worker/main feedback, positive/negative gain, follower, saturation, output-current sign, reset and invalid-input preservation');
  }finally{worker.terminate();}
}
