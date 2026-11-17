'use strict';
(async () => {
  const simulation=CircuitSimulation.create();
  const events=[];
  function record(action) {
    const state=simulation.getState();
    events.push({action,status:state.status,documentRevision:state.documentRevision,
      ...state.accepted,time:state.frame?.time ?? null,outputVoltage:state.frame?.pinVoltages.r2.a ?? null});
  }
  try {
    const response=await fetch('examples/voltage-divider.json');
    if(!response.ok)throw new Error('Saved divider unavailable');
    const circuit=await response.json();
    await simulation.setDocument(circuit);await simulation.step(100);record('Original divider');
    circuit.layout.components.r1.x+=100;
    await simulation.setDocument(circuit);record('Moved R1: same circuit revision, worker and run');
    circuit.electrical.components.find(c=>c.id==='r2').parameters.resistance=2000;
    await simulation.setDocument(circuit);await simulation.step(100);record('R2 = 2 kΩ: replacement worker activated');
    await simulation.reset();await simulation.step(1);record('Reset: same circuit revision, new run');
    document.getElementById('result').textContent=JSON.stringify({status:'passed',events,frame:simulation.getState().frame},null,2);
    document.body.dataset.status='passed';
  } catch(error) {
    document.getElementById('result').textContent=JSON.stringify({status:'failed',error:String(error.stack||error)},null,2);
    document.body.dataset.status='failed';
  } finally {simulation.dispose();}
})();
