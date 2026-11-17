import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
export const passiveSwitchKinds=['polarizedCapacitor','analogSwitch','analogSpdtSwitch'];
export function passiveSwitchCircuit(kind,parameters={},voltage=5,control=5){
  const M=CircuitEditorModel,d=M.empty();d.id='passive-'+kind;
  const add=(id,kind,parameters)=>{
    d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});
    d.layout.components[id]={x:d.electrical.components.length*160,y:0,rotation:0,mirror:false};
  };
  const wire=(a,ap,b,bp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};};
  add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});
  add('g','ground',{});add('vin','voltageRail',{waveform:{kind:'dc',voltage}});
  add('load','resistor',{resistance:1000});
  if(kind==='polarizedCapacitor'){
    wire('vin','p','load','a');wire('load','b','part','positive');wire('part','negative','g','g');
  }else{
    add('ctl','voltageRail',{waveform:typeof control==='number'?{kind:'dc',voltage:control}:control});
    wire('ctl','p','part','control');
    if(kind==='analogSwitch'){
      wire('vin','p','part','a');wire('part','b','load','a');wire('load','b','g','g');
    }else{
      wire('vin','p','part','common');wire('part','a','load','a');wire('load','b','g','g');
      add('loadB','resistor',{resistance:2000});wire('part','b','loadB','a');wire('loadB','b','g','g');
    }
  }
  return CircuitEditorModel.alignGrid(d);
}
