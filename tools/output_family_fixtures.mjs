import {editing as CircuitEditorModel} from '../packages/circuit-core/index.mjs';
// This fixture covers the output/control family; other models have their own circuits.
export const outputFamilyKinds=['variableVoltage','lamp','text','box','line','labeledNode','voltmeter','ohmmeter','ammeter','wattmeter','testPoint','decimalDisplay','instructionDisplay','ledArray','dataExport','audioOutput','stopTrigger','dcMotor','threePhaseMotor'];
export function outputFamilyCircuit(kind,parameters={},voltage=5){
 const M=CircuitEditorModel,d=M.empty();d.id='outputs-'+kind;
 const add=(id,kind,parameters)=>{d.electrical.components.push({id,kind,modelVersion:1,reference:id,parameters});d.layout.components[id]={x:d.electrical.components.length*512,y:0,rotation:0,mirror:false};};
 const wire=(a,ap,b,bp)=>{const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};};
 const load=(id,from,pin,r=1000)=>{add(id,'resistor',{resistance:r});wire(from,pin,id,'a');wire(id,'b','g','g');};
 add('part',kind,{...structuredClone(M.definitions[kind].parameters),...parameters});add('g','ground',{});
 if(['text','box','line'].includes(kind)){add('r','resistor',{resistance:1000});wire('r','a','g','g');wire('r','b','g','g');}
 else if(kind==='variableVoltage'){load('load','part','p');}
 else if(['lamp','dcMotor','ammeter'].includes(kind)){
  add('vin','voltageRail',{waveform:{kind:'dc',voltage}});wire('vin','p','part','a');load('load','part','b');
 }else if(kind==='ohmmeter'){wire('part','a','g','g');load('load','part','b');}
 else if(kind==='voltmeter'){
  add('vin','voltageRail',{waveform:{kind:'dc',voltage}});wire('vin','p','part','a');wire('part','b','g','g');
 }else if(kind==='wattmeter'){
  add('vin','voltageRail',{waveform:{kind:'dc',voltage}});wire('vin','p','part','currentIn');load('load','part','currentOut');wire('part','returnIn','g','g');
 }else if(['decimalDisplay','instructionDisplay'].includes(kind)){
  for(let bit=0;bit<4;bit++){add('bit'+bit,'voltageRail',{waveform:{kind:'dc',voltage:((voltage>>bit)&1)*5}});wire('bit'+bit,'p','part','I'+bit);}
 }else if(kind==='ledArray'){
  for(let i=0;i<8;i++){add('row'+i,'voltageRail',{waveform:{kind:'dc',voltage:i===0?voltage:0}});add('limit'+i,'resistor',{resistance:1000});wire('row'+i,'p','limit'+i,'a');wire('limit'+i,'b','part','R'+i);wire('part','C'+i,'g','g');}
 }else if(kind==='threePhaseMotor'){
  for(const [i,phase] of ['U','V','W'].entries()){add('phase'+i,'voltageRail',{waveform:{kind:'sine',amplitude:voltage,frequency:50,offset:0,phase:-2*Math.PI*i/3}});wire('phase'+i,'p','part',phase+'1');wire('part',phase+'2','g','g');}
 }else{
  add('vin','voltageRail',{waveform:{kind:'dc',voltage}});wire('vin','p','part','in');
 }
 return CircuitEditorModel.alignGrid(d);
}
