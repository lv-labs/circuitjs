// Real Node worker thread driving the production adapter and revision protocol.
// This checks the computational worker path, not browser APIs or UI behavior.
import assert from 'node:assert/strict';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import {createEngine} from './engine_node_runtime.mjs';
import {expansionKinds,expansionCircuit} from './component_expansion_fixtures.mjs';
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
    const cases=[...kinds.map(kind=>({kind})),...expansionKinds.map(kind=>({kind})),
      ...[1,2].map(position=>({kind:'spdtSwitch',parameters:{position}})),{kind:'dpdtSwitch',parameters:{position:1}},
      {kind:'transformer',parameters:{ratio:2,coupling:.8,integration:'trapezoidal'}},
      {kind:'led',voltage:-5},{kind:'zener',voltage:-10}];
    for(const {kind,parameters,voltage} of cases){
      const M=CircuitEditorModel,isExpansion=expansionKinds.includes(kind),d=isExpansion?expansionCircuit(kind,parameters,voltage):M.empty();d.id='worker-'+kind;
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
      const stepped=await request('step',{base,payload:{count:10}});
      const direct=CircuitDocumentAdapter.createSession(createEngine());direct.loadDocument(d);const expected=direct.step(10);
      assert.deepEqual(stepped.result.pinVoltages,expected.pinVoltages,kind+' worker/direct pin agreement');
      assert.deepEqual(stepped.result.componentCurrents,expected.componentCurrents,kind+' worker/direct current agreement');
    }
    console.log('Real Node worker checks passed for all 21 additions and driven variants: capability negotiation, guarded projection installation, stepping and direct/worker voltage-current agreement.');
  }finally{await worker.terminate();}
}
