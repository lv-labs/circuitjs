import '../experiments/engine/editor-model.js';
export const logicDisplayKinds=['output','logicOutput','logicInput'];
export function logicDisplayCircuit(kind,parameters={},voltage=5,load=1000){
  const M=CircuitEditorModel,d=M.empty();d.id='logic-display-'+kind;
  const add=(id,kind,parameters)=>{
    d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});
    d.layout.components[id]={x:d.electrical.components.length*160,y:0,rotation:0,mirror:false};
  };
  const wire=(a,ap,b,bp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};};
  add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});
  add('g','ground',{});add('vin','voltageRail',{waveform:{kind:'dc',voltage}});
  add('load','resistor',{resistance:load});
  if(kind==='logicInput'){
    wire('part','out','load','a');wire('load','b','g','g');
  }else{
    // A 50/50 divider keeps the marker node at half supply while exposing the
    // optional logic-output pulldown as a small loading error.
    add('r1','resistor',{resistance:1000});
    wire('vin','p','r1','a');wire('r1','b','part','in');wire('part','in','load','a');wire('load','b','g','g');
  }
  return d;
}
