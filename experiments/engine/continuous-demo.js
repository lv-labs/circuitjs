'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  let ready=false,closed=true,epoch=null,samples=[];
  const simulation=CircuitSimulation.create({autoRun:false,batchSteps:10,intervalMs:16,
    onFrame(frame) {
      if(epoch!==frame.runEpoch){samples=[];epoch=frame.runEpoch;}
      samples.push({time:frame.time,voltage:frame.pinVoltages.c1.a,revision:frame.circuitRevision});
      samples=samples.slice(-180);
      const from=samples[0].time,to=Math.max(from+1e-5,frame.time),segments=[];
      for(const sample of samples) {
        if(!segments.length || segments.at(-1).revision!==sample.revision)segments.push({revision:sample.revision,points:[]});
        segments.at(-1).points.push(`${35+550*(sample.time-from)/(to-from)},${140-125*sample.voltage/5}`);
      }
      const paths=segments.map(segment=>{
        const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
        line.setAttribute('points',segment.points.join(' '));line.setAttribute('fill','none');
        line.setAttribute('stroke','#2864c7');line.setAttribute('stroke-width','2');return line;
      });
      byId('traces').replaceChildren(...paths);
    },
    onState(state) {
      const blocked=!ready || ['loading','error','empty','disposed'].includes(state.status);
      byId('run').disabled=blocked || state.runRequested;
      byId('pause').disabled=blocked || (!state.runRequested && state.status!=='stepping');
      byId('step').disabled=blocked || state.runRequested || ['stepping','updating','pausing'].includes(state.status);
      byId('switch').disabled=blocked || ['updating','pausing'].includes(state.status);
      byId('reset').disabled=!ready || ['loading','empty','disposed'].includes(state.status);
      const frame=state.frame;
      byId('readout').textContent=`${state.status} · time ${frame ? frame.time.toFixed(6)+' s':'—'} · capacitor ${frame ? frame.pinVoltages.c1.a.toFixed(4)+' V':'awaiting current results'}`;
      byId('result').textContent=JSON.stringify({status:ready?'passed':'loading',simulation:state},null,2);
      if(state.error)byId('error').textContent=state.error.message;
    }});
  async function act(action) {
    byId('error').textContent='';
    try {await action();} catch(error) {byId('error').textContent=error.message;}
  }
  byId('run').onclick=()=>act(()=>simulation.run());
  byId('pause').onclick=()=>act(()=>simulation.pause());
  byId('step').onclick=()=>act(()=>simulation.step(10));
  byId('switch').onclick=()=>act(async()=>{
    const next=!closed;await simulation.setSwitch('s1',next);closed=next;
    byId('switch').textContent=closed?'Open switch':'Close switch';
  });
  byId('reset').onclick=()=>act(()=>simulation.reset());
  window.addEventListener('pagehide',()=>simulation.dispose());
  (async()=>{
    try {
      const response=await fetch('examples/switched-rc.json');if(!response.ok)throw new Error('RC document unavailable');
      await simulation.setDocument(await response.json());ready=true;await simulation.step(1);
      document.body.dataset.status='passed';
    } catch(error) {
      simulation.dispose();
      byId('result').textContent=JSON.stringify({status:'failed',error:String(error.stack||error)},null,2);
      document.body.dataset.status='failed';
    }
  })();
})();
