'use strict';
async function verifyScopeSamples(report,engine){
  const doc=await (await fetch('examples/opamp-oscilloscope.json')).json(),worker=createDocumentWorker(),session=CircuitDocumentAdapter.createSession(engine);
  const channels=[{id:'Vin',positive:{componentId:'vin',pinId:'p'},negative:null},{id:'Vout',positive:{componentId:'u1',pinId:'out'},negative:null},
    {id:'difference',positive:{componentId:'u1',pinId:'out'},negative:{componentId:'vin',pinId:'p'}}];
  try{
    await worker.ready;await worker.loadDocument(doc);session.loadDocument(doc);
    const sampled=await worker.step(200,channels),main=session.step(200);
    assert(sampled.sampleBatch.times.length===200,'Every step captured within a worker batch');
    for(let i=0;i<200;i++){
      const t=sampled.sampleBatch.times[i],input=.25+.5*Math.sin(2*Math.PI*1000*t),output=input*200000/100002;
      near(sampled.sampleBatch.values.Vin[i],input,1e-10,'Scope input sample time/value');
      near(sampled.sampleBatch.values.Vout[i],output,1e-9,'Scope synchronized output/gain');
      near(sampled.sampleBatch.values.difference[i],output-input,1e-9,'Differential scope sample');
    }
    assert(Math.max(...sampled.sampleBatch.values.Vout)>1.49&&Math.min(...sampled.sampleBatch.values.Vout)<-.49,'Intermediate positive and negative peaks captured');
    near(sampled.pinVoltages.u1.out,main.pinVoltages.u1.out,1e-10,'Sample collection leaves final solver result unchanged');
    near(sampled.time,main.time,1e-12,'Sampling does not add hidden steps');
    const prior=JSON.stringify(await worker.snapshot());
    let rejected=false;try{await worker.step(10,[{id:'bad',positive:{componentId:'missing',pinId:'out'},negative:null}]);}catch(error){rejected=error.code==='INVALID_DOCUMENT';}
    assert(rejected&&JSON.stringify(await worker.snapshot())===prior,'Invalid channel fails before mutation and preserves worker');
    const next=await worker.step(10,channels);assert(next.sampleBatch.times[0]>sampled.sampleBatch.times.at(-1),'Consecutive sample batches strictly increase time');
    await worker.reset();const reset=await worker.step(1,channels);near(reset.sampleBatch.times[0],0,1e-15,'Reset restarts acquisition time');
    // Stateful RC integration also agrees between per-step acquisition and a bounded step call.
    const rc=await (await fetch('examples/switched-rc.json')).json();await worker.loadDocument(rc);session.loadDocument(rc);
    const rcFrame=await worker.step(100,[{id:'Vc',positive:{componentId:'c1',pinId:'a'},negative:{componentId:'c1',pinId:'b'}}]),rcMain=session.step(100);
    near(rcFrame.pinVoltages.c1.a,rcMain.pinVoltages.c1.a,1e-12,'RC sampled and unsampled integration match');
    report.checks.push('Oscilloscope: real worker per-step synchronized input/output/differential peaks, analytic op-amp gain, no hidden steps, RC equivalence, reset and invalid-channel preservation');
  }finally{worker.terminate();}
}
