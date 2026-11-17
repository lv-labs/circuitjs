'use strict';
async function verifyWaveformsAndRails(report,engine){
  const base=await (await fetch('examples/opamp-noninverting.json')).json(),worker=createDocumentWorker(),session=CircuitDocumentAdapter.createSession(engine);
  const expected=(w,t)=>{
    if(w.kind==='dc')return w.voltage;
    const p=(t*w.frequency)%1,a=w.amplitude,o=w.offset;
    if(w.kind==='sine')return o+a*Math.sin(2*Math.PI*p);
    if(w.kind==='square')return o+a*(p>w.dutyCycle?-1:1);
    if(w.kind==='pulse')return o+(p<w.dutyCycle?a:0);
    if(w.kind==='triangle')return o+a*(p<.5?4*p-1:3-4*p);
    return o+a*(2*p-1);
  };
  try{
    await worker.ready;
    for(const model of ['voltageSource','voltageRail'])for(const kind of ['dc','sine','square','triangle','sawtooth','pulse']){
      const d=structuredClone(base),source=d.electrical.components.find(c=>c.id==='vin');source.kind=model;
      const w=kind==='dc'?{kind,voltage:2}:{kind,amplitude:.5,frequency:1000,offset:.25,...(['square','pulse'].includes(kind)?{dutyCycle:.3}:{})};source.parameters.waveform=w;
      if(model==='voltageRail')d.electrical.wires=d.electrical.wires.filter(w=>w.id!=='w2');
      await worker.loadDocument(d);session.loadDocument(d);let first;
      for(const count of [1,16,19,21,23,37]){
        const frame=await worker.step(count),main=session.step(count),voltage=expected(w,frame.time-frame.timeStep);
        near(frame.pinVoltages.vin.p,voltage,1e-10,'Selected waveform matches analytic values');
        assert(Object.keys(frame.pinVoltages.vin).length===(model==='voltageRail'?1:2),'Source exposes actual terminal count');
        near(frame.pinVoltages.u1.out,voltage*200000/100002,1e-9,'Selected waveform drives op-amp feedback');
        near(frame.pinVoltages.u1.out,main.pinVoltages.u1.out,1e-10,'Rail/waveform worker-main agreement');if(!first)first=frame;
      }
      await worker.reset();near((await worker.step(1)).pinVoltages.vin.p,first.pinVoltages.vin.p,1e-12,'Waveform/rail reset');
    }
    // Two rails establish the reference without an explicit ground component.
    const rails={schemaVersion:1,id:'two-rails',electrical:{components:[
      {id:'vp',kind:'voltageRail',modelVersion:1,parameters:{waveform:{kind:'dc',voltage:5}}},
      {id:'vn',kind:'voltageRail',modelVersion:1,parameters:{waveform:{kind:'dc',voltage:-2}}},
      {id:'r',kind:'resistor',modelVersion:1,parameters:{resistance:1000}}],junctions:[],wires:[
      {id:'w1',from:{kind:'pin',componentId:'vp',pinId:'p'},to:{kind:'pin',componentId:'r',pinId:'a'}},
      {id:'w2',from:{kind:'pin',componentId:'vn',pinId:'p'},to:{kind:'pin',componentId:'r',pinId:'b'}}]},simulation:{timeStep:1e-5}};
    await worker.loadDocument(rails);const frame=await worker.step(10);
    near(frame.pinVoltages.vp.p,5,1e-12,'Positive rail voltage');near(frame.pinVoltages.vn.p,-2,1e-12,'Negative rail voltage');
    near(frame.componentCurrents.r,.007,1e-12,'Rail-to-rail load current');near(frame.componentCurrents.vp,-.007,1e-12,'Positive rail passive current');near(frame.componentCurrents.vn,.007,1e-12,'Negative rail passive current');
    const before=JSON.stringify(await worker.snapshot()),bad=structuredClone(rails);bad.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'vp',pinId:'p'},to:{kind:'pin',componentId:'vn',pinId:'p'}});
    let rejected=false;try{await worker.loadDocument(bad);}catch(error){rejected=error.code==='INVALID_DOCUMENT';}
    assert(rejected&&JSON.stringify(await worker.snapshot())===before,'Rail ideal loop rejected without disturbing worker');
    report.checks.push('AC waveform/rail sources: six waveforms on one/two terminals, duty cycle, op-amp response, reset, implicit-ground load currents and ideal-loop rejection');
  }finally{worker.terminate();}
}
