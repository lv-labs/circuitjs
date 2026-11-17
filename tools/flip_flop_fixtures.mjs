import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
export const flipFlopKinds=['dFlipFlop','jkFlipFlop','tFlipFlop'];
export function flipFlopCircuit(kind,parameters={},levels={}){
  const M=CircuitEditorModel,d=M.empty();d.id='flip-flop-'+kind;
  const add=(id,kind,parameters)=>{
    d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});
    d.layout.components[id]={x:d.electrical.components.length*160,y:0,rotation:0,mirror:false};
  };
  const wire=(a,ap,b,bp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};};
  add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});
  add('g','ground',{});
  const rail=(id,voltage)=>add(id,'voltageRail',{waveform:{kind:'dc',voltage}});
  const inputs=kind==='jkFlipFlop'?['J','K']:kind==='dFlipFlop'?['D']:['T'];
  for(const pin of inputs){rail('in'+pin,levels[pin]??0);wire('in'+pin,'p','part',pin);}
  rail('clock',levels.clock??0);wire('clock','p','part','clock');
  for(const pin of ['Q','Qn']){add('out'+pin,'output',{showVoltage:true});wire('part',pin,'out'+pin,'in');}
  return CircuitEditorModel.alignGrid(d);
}
