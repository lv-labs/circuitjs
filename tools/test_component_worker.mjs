// Real Node worker thread driving the production adapter and revision protocol.
// This checks the computational worker path, not browser APIs or UI behavior.
import assert from 'node:assert/strict';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import {createEngine} from './engine_node_runtime.mjs';
import {expansionKinds,expansionCircuit} from './component_expansion_fixtures.mjs';
import {passiveSwitchKinds,passiveSwitchCircuit} from './passive_switch_fixtures.mjs';
import {logicDisplayKinds,logicDisplayCircuit} from './logic_display_fixtures.mjs';
import {flipFlopKinds,flipFlopCircuit} from './flip_flop_fixtures.mjs';
import {chipBatchKinds,chipBatchCircuit} from './chip_batch_fixtures.mjs';
import {passiveMenuKinds,passiveMenuCircuit} from './passive_menu_fixtures.mjs';
import {outputFamilyKinds,outputFamilyCircuit} from './output_family_fixtures.mjs';
const kinds=['inductor','diode','currentSource','potentiometer','npn','pnp','nmos','pmos','njfet','pjfet','andGate','nandGate','orGate','norGate','xorGate','inverter'];
if(!isMainThread){
  let protocol;
  parentPort.on('message',message=>{
    try{
      if(message.fresh)protocol=CircuitRevisionProtocol.create(CircuitDocumentAdapter.createSession(createEngine()));
      parentPort.postMessage(protocol.handle(message));
    }catch(error){parentPort.postMessage({ok:false,error:{message:String(error.stack||error)}});}
  });
}else{
  const worker=new Worker(new URL(import.meta.url));
  let sequence=0;
  function request(operation,{base,payload,target,fresh}={}){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{cleanup();reject(new Error('Worker request timed out'));},10000);
      const done=reply=>{cleanup();reply.ok?resolve(reply):reject(new Error(JSON.stringify(reply.error)));};
      const failed=error=>{cleanup();reject(error);};
      function cleanup(){clearTimeout(timer);worker.off('message',done);worker.off('error',failed);}
      worker.once('message',done);worker.once('error',failed);
      worker.postMessage({protocolVersion:1,sessionId:'catalog',requestId:++sequence,operation,base,payload,target,fresh});
    });
  }
  try{
    const cases=[...kinds.map(kind=>({kind})),...expansionKinds.map(kind=>({kind})),...passiveSwitchKinds.map(kind=>({kind})),
      ...logicDisplayKinds.map(kind=>({kind})),...flipFlopKinds.map(kind=>({kind})),...chipBatchKinds.map(kind=>({kind})),...passiveMenuKinds.map(kind=>({kind})),...outputFamilyKinds.map(kind=>({kind})),
      {kind:'dataExport',parameters:{capacity:7},steps:25},{kind:'audioOutput',parameters:{duration:.01},steps:2000},
      {kind:'pushSwitch',parameters:{normallyClosed:true}},...[1,2,3].map(position=>({kind:'mbbSwitch',parameters:{position}})),
      {kind:'tappedTransformer',parameters:{ratio:2,coupling:.8,integration:'trapezoidal'}},
      {kind:'customTransformer',parameters:{turns2:-2,turns3:.5,integration:'trapezoidal'}},
      ...chipBatchKinds.map(kind=>({kind,parameters:{highVoltage:3.3}})),
      {kind:'counter',parameters:{negativeEdge:true,modulus:5,invertReset:false,initialValue:3}},
      {kind:'latch',parameters:{edgeTriggered:false,initialValue:9}},
      {kind:'counter',levels:{clock:{kind:'square',amplitude:2.5,offset:2.5,frequency:1000,dutyCycle:.5}}},
      {kind:'latch',levels:{load:{kind:'square',amplitude:2.5,offset:2.5,frequency:1000,dutyCycle:.5},I0:{kind:'square',amplitude:2.5,offset:2.5,frequency:137,dutyCycle:.5}}},
      {kind:'jkFlipFlop',parameters:{positiveEdge:true,initialState:true,highVoltage:3.3}},
      ...['analogSwitch','analogSpdtSwitch'].flatMap(kind=>[false,true].flatMap(pulldown=>[false,true].flatMap(inverted=>[0,5].map(control=>({kind,parameters:{pulldown,inverted},control}))))),
      {kind:'polarizedCapacitor',parameters:{integration:'trapezoidal',initialVoltage:.25}},
      ...['analogSwitch','analogSpdtSwitch'].map(kind=>({kind,control:{kind:'square',amplitude:5,frequency:1000,offset:0,dutyCycle:.5}})),
      ...[1,2].map(position=>({kind:'spdtSwitch',parameters:{position}})),{kind:'dpdtSwitch',parameters:{position:1}},
      {kind:'transformer',parameters:{ratio:2,coupling:.8,integration:'trapezoidal'}},
      {kind:'led',voltage:-5},{kind:'zener',voltage:-10}];
    for(const {kind,parameters,voltage,control,levels,steps} of cases){
      const M=CircuitEditorModel,isExpansion=expansionKinds.includes(kind)||passiveSwitchKinds.includes(kind)||logicDisplayKinds.includes(kind)||flipFlopKinds.includes(kind)||chipBatchKinds.includes(kind)||passiveMenuKinds.includes(kind)||outputFamilyKinds.includes(kind),d=outputFamilyKinds.includes(kind)?outputFamilyCircuit(kind,parameters,voltage):passiveMenuKinds.includes(kind)?passiveMenuCircuit(kind,parameters):chipBatchKinds.includes(kind)?chipBatchCircuit(kind,parameters,levels):flipFlopKinds.includes(kind)?flipFlopCircuit(kind,parameters):logicDisplayKinds.includes(kind)?logicDisplayCircuit(kind,parameters,voltage):passiveSwitchKinds.includes(kind)?passiveSwitchCircuit(kind,parameters,voltage,control):isExpansion?expansionCircuit(kind,parameters,voltage):M.empty();d.id='worker-'+kind;
      if(!isExpansion){
      d.electrical.components.push({id:'part',kind,modelVersion:1,reference:'part',parameters:structuredClone(M.definitions[kind].parameters)},
        {id:'g',kind:'ground',modelVersion:1,reference:'G',parameters:{}});
      for(const [i,pinId] of Object.keys(M.definitions[kind].pins).entries()){
        const id='r'+i;d.electrical.components.push({id,kind:'resistor',modelVersion:1,reference:'R'+i,parameters:{resistance:1000}});
        d.electrical.wires.push({id:'a'+i,from:{kind:'pin',componentId:'part',pinId},to:{kind:'pin',componentId:id,pinId:'a'}},
          {id:'b'+i,from:{kind:'pin',componentId:id,pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
      }
      }
      const compiled=CircuitDocumentAdapter.compile(d),base={documentId:d.id,circuitRevision:1,runEpoch:1};
      const initialized=await request('initialize',{fresh:true});assert.ok(initialized.result.models.includes(kind+'@1'));
      await request('installCircuit',{base:{documentId:null,circuitRevision:0,runEpoch:0},target:base,payload:{circuit:JSON.parse(compiled.canonical)}});
      const count=steps??(kind==='transmissionLine'?150:levels||typeof control==='object'?250:10),channels=kind==='transmissionLine'?[{id:'right',positive:{componentId:'part',pinId:'right'},negative:null}]:levels?[{id:'q',positive:{componentId:'part',pinId:kind==='counter'?'Q0':'O0'},negative:null}]:typeof control==='object'?[{id:'a',positive:{componentId:'part',pinId:kind==='analogSwitch'?'b':'a'},negative:null}]:undefined;
      const stepped=await request('step',{base,payload:{count,channels}});
      const direct=CircuitDocumentAdapter.createSession(createEngine());direct.loadDocument(d);const expected=direct.step(count,channels);
      if(channels){assert.deepEqual(stepped.result.sampleBatch,expected.sampleBatch);assert.equal(expected.sampleBatch.times.length,count);const values=Object.values(expected.sampleBatch.values)[0];assert.ok(Math.max(...values)>(kind==='transmissionLine'?2:4));assert.equal(Math.min(...values),0);}
      assert.deepEqual(stepped.result.componentMeasurements,expected.componentMeasurements,kind+' worker/direct measurements');
      assert.equal(stepped.result.stopRequested,expected.stopRequested);
      if(['dataExport','audioOutput'].includes(kind)){const capture=await request('readCapture',{base,payload:{componentId:'part'}}),reference=direct.readCapture('part');assert.deepEqual(capture.result.values,reference.values);assert.equal(capture.result.startTime,reference.startTime);assert.equal(capture.result.timeStep,reference.timeStep);}
      if(kind==='variableVoltage'){const next={...base,circuitRevision:2};const applied=await request('setVariableVoltage',{base,target:next,payload:{componentId:'part',voltage:4,statePolicy:'preserve'}});assert.equal(applied.result.appliedAtTime,expected.time);direct.setVariableVoltage('part',4);const advanced=await request('step',{base:next,payload:{count:1}}),directAdvanced=direct.step(1);assert.deepEqual(advanced.result.pinVoltages,directAdvanced.pinVoltages);}
      const contactField={pushSwitch:'normallyClosed',spdtSwitch:'position',dpdtSwitch:'position',mbbSwitch:'position',logicInput:'state'}[kind];
      if(contactField){
        const previous=d.electrical.components.find(c=>c.id==='part').parameters[contactField],value=typeof previous==='boolean'?!previous:previous===0?1:0,next={...base,circuitRevision:2};
        assert.ok(initialized.result.liveChanges.includes('setContact'));
        const applied=await request('setContact',{base,target:next,payload:{componentId:'part',field:contactField,value,statePolicy:'preserve'}});assert.equal(applied.result.appliedAtTime,expected.time);
        direct.setContact('part',contactField,value);const advanced=await request('step',{base:next,payload:{count:10}}),reference=direct.step(10);assert.deepEqual(advanced.result.pinVoltages,reference.pinVoltages);assert.deepEqual(advanced.result.componentCurrents,reference.componentCurrents);assert.equal(advanced.result.time,reference.time);
      }
      const editBase={...base,circuitRevision:kind==='variableVoltage'||contactField?2:1},editTarget={...editBase,circuitRevision:editBase.circuitRevision+1};
      const changed=structuredClone(d);changed.electrical.components.push({id:'aaa-added',kind:'resistor',modelVersion:1,reference:'Rnew',parameters:{resistance:1000}});
      const projection=JSON.parse(CircuitDocumentAdapter.compile(changed).canonical),prior=direct.snapshot();
      const updated=await request('updateCircuit',{base:editBase,target:editTarget,payload:{circuit:projection,statePolicy:'preserve'}});assert.equal(updated.result.appliedAtTime,prior.time);
      direct.updateProjection(projection,d.id);const continued=await request('step',{base:editTarget,payload:{count:1}}),directContinued=direct.step(1);assert.deepEqual(continued.result.pinVoltages,directContinued.pinVoltages);assert.deepEqual(continued.result.componentCurrents,directContinued.componentCurrents);assert.equal(continued.result.time,directContinued.time);
      assert.deepEqual(stepped.result.pinVoltages,expected.pinVoltages,kind+' worker/direct pin agreement');
      assert.deepEqual(stepped.result.componentCurrents,expected.componentCurrents,kind+' worker/direct current agreement');
    }
    const reverse=passiveSwitchCircuit('polarizedCapacitor',{},-5),base={documentId:reverse.id,circuitRevision:1,runEpoch:1};
    await request('initialize',{fresh:true});
    await request('installCircuit',{base:{documentId:null,circuitRevision:0,runEpoch:0},target:base,payload:{circuit:JSON.parse(CircuitDocumentAdapter.compile(reverse).canonical)}});
    await assert.rejects(request('step',{base,payload:{count:1000,channels:[{id:'v',positive:{componentId:'part',pinId:'positive'},negative:null}]}}),/capacitor exceeded max reverse voltage/);
    await assert.rejects(request('snapshot',{base}),/Session faulted/);
    await request('initialize',{fresh:true});
    await request('installCircuit',{base:{documentId:null,circuitRevision:0,runEpoch:0},target:base,payload:{circuit:JSON.parse(CircuitDocumentAdapter.compile(reverse).canonical)}});
    assert.ok((await request('step',{base,payload:{count:1}})).result.time>0);
    console.log('Real Node worker checks passed for the full catalog plus driven variants: capability negotiation, guarded installation, dynamic sampling, direct/worker agreement, reverse-voltage fault reporting and fresh-worker recovery.');
  }finally{await worker.terminate();}
}
