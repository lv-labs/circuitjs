import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
export const chipBatchKinds=['counter','latch','halfAdder','fullAdder'];
export const chipOutputs={counter:['Q3','Q2','Q1','Q0'],latch:['O0','O1','O2','O3'],halfAdder:['sum','carry'],fullAdder:['S0','S1','S2','S3','carryOut']};
export function chipBatchCircuit(kind,parameters={},levels={}){
  const M=CircuitEditorModel,d=M.empty();d.id='chip-'+kind;
  const add=(id,kind,parameters)=>{d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});d.layout.components[id]={x:d.electrical.components.length*256,y:0,rotation:0,mirror:false};};
  const wire=(from,fromPin,to,toPin)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:from,pinId:fromPin},to:{kind:'pin',componentId:to,pinId:toPin}});d.layout.wires[id]={bends:[]};};
  add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});add('g','ground',{});
  for(const pin of Object.keys(M.definitions[kind].pins)){
    if(chipOutputs[kind].includes(pin)){
      add('out'+pin,'resistor',{resistance:1000});wire('part',pin,'out'+pin,'a');wire('out'+pin,'b','g','g');
    }else{
      const value=levels[pin]??(kind==='counter'&&pin==='reset'?5:0);
      add('in'+pin,'voltageRail',{waveform:typeof value==='number'?{kind:'dc',voltage:value}:value});wire('in'+pin,'p','part',pin);
    }
  }
  return CircuitEditorModel.alignGrid(d);
}
