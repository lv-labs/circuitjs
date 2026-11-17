import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
export const passiveMenuKinds=['pushSwitch','mbbSwitch','tappedTransformer','customTransformer','transmissionLine'];
export function passiveMenuCircuit(kind,parameters={},options={}){
 const M=CircuitEditorModel,d=M.empty();d.id='passive-menu-'+kind;if(options.timeStep)d.simulation.timeStep=options.timeStep;
 const add=(id,kind,parameters)=>{d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});d.layout.components[id]={x:d.electrical.components.length*256,y:0,rotation:0,mirror:false};};
 const wire=(from,fp,to,tp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:from,pinId:fp},to:{kind:'pin',componentId:to,pinId:tp}});d.layout.wires[id]={bends:[]};};
 const load=(id,pin,resistance=1000)=>{add(id,'resistor',{resistance});wire('part',pin,id,'a');wire(id,'b','g','g');};
 add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});add('g','ground',{});add('vin','voltageRail',{waveform:{kind:'dc',voltage:5}});
 if(kind==='pushSwitch'){wire('vin','p','part','a');load('load','b');}
 if(kind==='mbbSwitch'){wire('vin','p','part','common');load('loadA','a');load('loadB','b',2000);}
 if(kind==='tappedTransformer'){wire('vin','p','part','p1');wire('part','p2','g','g');wire('part','tap','g','g');load('loadA','s1');load('loadB','s2',2000);}
 if(kind==='customTransformer'){
  const driven=options.driven??0,pairs=[['p1a','p1b'],['p2a','p2b'],['sa','sb']];
  pairs.forEach(([a,b],i)=>{wire('part',b,'g','g');if(i===driven)wire('vin','p','part',a);else load('load'+i,a,1000*(i+1));});
 }
 if(kind==='transmissionLine'){
  const impedance=d.electrical.components[0].parameters.impedance;
  add('sourceR','resistor',{resistance:impedance});wire('vin','p','sourceR','a');wire('sourceR','b','part','left');
  wire('part','leftReturn','g','g');wire('part','rightReturn','g','g');load('load','right',options.load??impedance);
 }
 return CircuitEditorModel.alignGrid(d);
}
