import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
export const expansionKinds=['transformer','spdtSwitch','dpdtSwitch','led','zener'];
export function expansionCircuit(kind,parameters={},voltage=5){
  const M=CircuitEditorModel,d=M.empty();d.id='expansion-'+kind;
  const add=(id,model,parameters)=>{
    d.electrical.components.push({id,kind:model,modelVersion:1,reference:id,parameters});
    d.layout.components[id]={x:d.electrical.components.length*160,y:0,rotation:0,mirror:false};
  };
  const wire=(a,ap,b,bp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};};
  const resistor=(id,from,pin,resistance=1000)=>{add(id,'resistor',{resistance});wire(from,pin,id,'a');wire(id,'b','g','g');};
  add('part',kind,{...structuredClone(M.definitions[kind].parameters),...(kind==='spdtSwitch'?{centerOff:true}:{}),...parameters});
  add('g','ground',{});add('vin','voltageRail',{waveform:{kind:'dc',voltage}});
  if(kind==='transformer'){
    wire('vin','p','part','p1');wire('part','p2','g','g');wire('part','s2','g','g');resistor('load','part','s1');
  }else if(kind==='spdtSwitch'){
    wire('vin','p','part','common');resistor('aLoad','part','a');resistor('bLoad','part','b',2000);
  }else if(kind==='dpdtSwitch'){
    wire('vin','p','part','common1');add('vin2','voltageRail',{waveform:{kind:'dc',voltage:-3}});wire('vin2','p','part','common2');
    resistor('aLoad','part','a1');resistor('bLoad','part','b1',2000);resistor('aLoad2','part','a2',3000);resistor('bLoad2','part','b2',4000);
  }else{
    add('load','resistor',{resistance:1000});wire('vin','p','load','a');wire('load','b','part','anode');wire('part','cathode','g','g');
  }
  return CircuitEditorModel.alignGrid(d);
}
