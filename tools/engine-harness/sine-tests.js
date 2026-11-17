'use strict';
async function verifySineSources(report,engine) {
  const base=await (await fetch('examples/opamp-sine.json')).json(),worker=createDocumentWorker(),session=CircuitDocumentAdapter.createSession(engine);
  try{
    await worker.ready;
    for(const values of [{amplitude:.5,frequency:1000,offset:.25},{amplitude:0,frequency:123,offset:-1.25},{amplitude:2,frequency:250,offset:-.1},{amplitude:10,frequency:1000,offset:0}]){
      const d=structuredClone(base);Object.assign(d.electrical.components.find(c=>c.id==='vin').parameters.waveform,values);
      await worker.loadDocument(d);session.loadDocument(d);let first;
      for(const count of [1,24,25,25,25,100]){
        const frame=await worker.step(count),main=session.step(count);
        // Legacy sources evaluate at the start of the last completed timestep.
        const voltage=values.offset+values.amplitude*Math.sin(2*Math.PI*values.frequency*(frame.time-frame.timeStep));
        near(frame.pinVoltages.vin.p,voltage,1e-10,'Sine source analytic voltage at legacy sample time');
        near(frame.pinVoltages.vin.n,0,1e-12,'Sine source negative reference');
        const expected=voltage*200000/100002;
        if(Math.abs(expected)>15)near(frame.pinVoltages.u1.out,Math.sign(expected)*15,.01,'Sine-driven op-amp clipping');
        else near(frame.pinVoltages.u1.out,expected,1e-9,'Sine-driven op-amp finite gain');
        near(frame.pinVoltages.u1.out,main.pinVoltages.u1.out,1e-10,'Sine worker/main agreement');
        near(frame.componentCurrents.vin,0,1e-12,'Op-amp input draws no sine-source current');
        if(!first)first=frame;
      }
      await worker.reset();near((await worker.step(1)).pinVoltages.vin.p,first.pinVoltages.vin.p,1e-12,'Sine reset starts at zero phase');
    }
    const before=JSON.stringify(await worker.snapshot()),invalid=structuredClone(base);
    invalid.electrical.components.find(c=>c.id==='vin').parameters.waveform.frequency=-100;
    let rejected=false;try{await worker.loadDocument(invalid);}catch(error){rejected=error.code==='INVALID_DOCUMENT';}
    assert(rejected&&JSON.stringify(await worker.snapshot())===before,'Invalid sine parameters preserve worker state');
    report.checks.push('Sine source: amplitude/frequency/DC offset, analytic phase/time, zero amplitude, op-amp AC gain/clipping, reset and worker/main agreement');
  }finally{worker.terminate();}
}
