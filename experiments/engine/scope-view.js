'use strict';
(() => {
  const S=CircuitScopeModel,M=CircuitEditorModel;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function format(n,unit=''){
    if(!Number.isFinite(n))return '—';if(Math.abs(n)<1e-15)n=0;
    const [scale,prefix]=[[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']].find(([s])=>Math.abs(n)>=s)||[1,''];
    return `${Number((n/scale).toPrecision(4))} ${prefix}${unit}`;
  }
  function create({onRunToggle}) {
    const $=id=>document.getElementById(id),buffer=S.create(),plot=$('scope-plot'),hidden=new Set();
    let channels=[],unresolved=[],overflow=0,state=null,open=false,scheduled=false,cursor=null,legendSignature='';
    const panes=[{id:1,plot,hidden,volts:$('scope-volts'),rows:$('scope-channels'),readings:$('scope-cursor-readings')}];
    let nextPane=2;
    const renderSoon=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}};
    const controls=()=>{
      $('scope-toggle').setAttribute('aria-expanded',String(open));$('scope-body').hidden=!open;
      $('scope-toggle').textContent=(open?'▾':'▸')+' Oscilloscope';renderSoon();
    };
    $('scope-toggle').onclick=()=>{open=!open;controls();};
    $('scope-time').innerHTML=[1e-5,2e-5,5e-5,1e-4,2e-4,5e-4,.001,.002,.005,.01,.02].map(t=>`<option value="${t}">${format(t,'s')}/div</option>`).join('');$('scope-time').value='0.0002';
    $('scope-volts').innerHTML='<option value="auto">Auto</option>'+[.001,.002,.005,.01,.02,.05,.1,.2,.5,1,2,5,10].map(v=>`<option value="${v}">${format(v,'V')}/div</option>`).join('');
    $('scope-time').onchange=$('scope-volts').onchange=()=>{cursor=null;renderSoon();};
    $('scope-clear').onclick=()=>{buffer.clear();cursor=null;renderSoon();};
    $('scope-run').onclick=onRunToggle;
    const observer=new ResizeObserver(renderSoon);
    function bindPlot(plot){
      plot.addEventListener('pointermove',event=>{const r=plot.getBoundingClientRect();cursor=Math.max(0,Math.min(1,(event.clientX-r.left-55)/(r.width-72)));renderSoon();});
      plot.addEventListener('pointerleave',()=>{cursor=null;renderSoon();});observer.observe(plot);
    }
    bindPlot(plot);
    $('scope-layout').onchange=()=>{$('scope-panes').dataset.layout=$('scope-layout').value;renderSoon();};
    $('scope-add').onclick=()=>{
      if(panes.length>=4)return;
      const id=nextPane++,host=document.createElement('section');host.className='scope-pane';host.dataset.pane=id;
      host.innerHTML=`<div class="scope-pane-heading">Pane ${id}<label>Voltage <select aria-label="Pane ${id} volts per division">${$('scope-volts').innerHTML}</select></label><button aria-label="Remove pane ${id}">Remove</button></div><div class="scope-content"><svg role="img" aria-label="Pane ${id} voltage waveforms"></svg><div class="scope-channels"></div></div><div class="scope-readings"></div>`;
      $('scope-panes').append(host);
      const pane={id,plot:host.querySelector('svg'),hidden:new Set(),volts:host.querySelector('select'),rows:host.querySelector('.scope-channels'),readings:host.querySelector('.scope-readings')};
      panes.push(pane);bindPlot(pane.plot);pane.volts.onchange=renderSoon;
      host.querySelector('button').onclick=()=>{observer.unobserve(pane.plot);panes.splice(panes.indexOf(pane),1);host.remove();$('scope-add').disabled=false;renderSoon();};
      populate(pane);$('scope-add').disabled=panes.length>=4;renderSoon();
    };
    function populate(pane){
      pane.rows.innerHTML=channels.map(c=>`<div class="scope-channel" data-scope-channel="${esc(c.id)}"><label><input type="checkbox" data-channel="${esc(c.id)}" ${pane.hidden.has(c.id)?'':'checked'}><span class="scope-swatch" style="background:${S.color(c.id)}"></span><span>${esc(c.label)}</span></label><span class="scope-last"></span><small class="scope-range"></small></div>`).join('');
      for(const input of pane.rows.querySelectorAll('input'))input.onchange=()=>{input.checked?pane.hidden.delete(input.dataset.channel):pane.hidden.add(input.dataset.channel);renderSoon();};
    }
    function setDocument(d){
      const result=M.scopeChannels(d);unresolved=result.unresolved;overflow=Math.max(0,result.channels.length-32);
      channels=result.channels.slice(0,32);const descriptors=buffer.setChannels(channels);
      const signature=JSON.stringify(channels.map(c=>[c.id,c.label]));
      if(signature!==legendSignature){
        legendSignature=signature;
        panes.forEach(populate);
      }
      renderSoon();return descriptors;
    }
    function onState(next){
      state=next;
      buffer.followState(next);
      renderSoon();
    }
    function onFrame(frame){if(buffer.append(frame))renderSoon();}
    function render(){const view=buffer.window(Number($('scope-time').value)*10);for(const pane of panes)renderPane(pane,view);}
    function renderPane(pane,view){
      const plot=pane.plot,hidden=pane.hidden;
      const $=id=>id==='scope-volts'?pane.volts:id==='scope-channels'?pane.rows:id==='scope-cursor-readings'?pane.readings:document.getElementById(id);
      const visible=view.channels.filter(c=>!hidden.has(c.id));
      const running=!!state?.runRequested,invalid=['error','empty','disposed'].includes(state?.status);
      $('scope-run').textContent=running?'Ⅱ Pause':'▶ Run';$('scope-run').disabled=!state?.accepted||invalid||state?.status==='loading';
      $('scope-status').textContent=`${channels.length} voltage ${channels.length===1?'probe':'probes'} · ${view.stored.toLocaleString()} samples · ${invalid?'Waiting for valid circuit':state?.status==='loading'?'Resetting':running?'Running':'Paused'}`;
      $('scope-panel').dataset.samples=String(view.stored);$('scope-panel').dataset.channels=String(channels.length);
      for(const row of $('scope-channels').children){const c=view.channels.find(c=>c.id===row.dataset.scopeChannel);if(!c)continue;
        row.querySelector('.scope-last').textContent=format(c.last,'V');row.querySelector('.scope-range').textContent=`min ${format(c.min,'V')} · max ${format(c.max,'V')}`;
      }
      if(!open)return;
      const width=Math.max(120,plot.getBoundingClientRect().width),height=Math.max(160,plot.getBoundingClientRect().height),left=55,right=width-17,top=14,bottom=height-28,pw=right-left,ph=bottom-top;
      const vdiv=$('scope-volts').value==='auto'?S.autoScale(visible):Number($('scope-volts').value),limit=vdiv*4;
      const x=t=>left+(t-view.start)/(view.end-view.start)*pw,y=v=>Math.max(top-2,Math.min(bottom+2,top+ph/2-v/(limit*2)*ph));
      const parts=[`<defs><clipPath id="scope-clip-${pane.id}"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs><rect width="100%" height="100%" fill="#101720"/>`];
      for(let i=0;i<=10;i++){
        const gx=left+pw*i/10;parts.push(`<path d="M${gx} ${top}V${bottom}" stroke="#26313e" stroke-width="1"/>`);
        if(i%2===0)parts.push(`<text x="${gx}" y="${height-9}" fill="#8797ab" text-anchor="middle" font-size="10">${esc(format(view.start+(view.end-view.start)*i/10,'s'))}</text>`);
      }
      for(let i=0;i<=8;i++){
        const gy=top+ph*i/8;parts.push(`<path d="M${left} ${gy}H${right}" stroke="${i===4?'#526071':'#26313e'}" stroke-width="1"/>`);
        if(i%2===0)parts.push(`<text x="${left-8}" y="${gy+4}" fill="#8797ab" text-anchor="end" font-size="10">${esc(format((4-i)*vdiv,'V'))}</text>`);
      }
      parts.push(`<g clip-path="url(#scope-clip-${pane.id})">`);
      for(const c of visible){const points=S.envelope(view.times,c.values,view.start,view.end,Math.floor(pw));
        if(points.length)parts.push(`<path data-scope-trace="${esc(c.id)}" d="${points.map(([t,v],i)=>`${i?'L':'M'}${x(t).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${x(points.at(-1)[0])}" cy="${y(points.at(-1)[1])}" r="2" fill="${c.color}"/>`);
      }
      parts.push('</g>');
      let index=view.times.length-1;
      if(cursor!==null&&view.times.length){const t=view.start+cursor*(view.end-view.start);index=0;for(let i=1;i<view.times.length;i++)if(Math.abs(view.times[i]-t)<Math.abs(view.times[index]-t))index=i;
        parts.push(`<path data-scope-cursor d="M${x(view.times[index])} ${top}V${bottom}" stroke="#d4deeb" stroke-dasharray="3 3"/>`);
      }
      if(!channels.length||!visible.length||!view.times.length){const text=!channels.length?'Place voltage probes on the input and output':!visible.length?'Enable a probe channel to plot it':'Run or Step to capture waveforms';
        parts.push(`<text x="${left+pw/2}" y="${top+ph/2-8}" text-anchor="middle" fill="#a0afc2" font-size="12">${text}</text>`);
      }
      plot.setAttribute('viewBox',`0 0 ${width} ${height}`);plot.innerHTML=parts.join('');
      $('scope-cursor-readings').textContent=index>=0?`${cursor===null?'Latest':'Cursor'} t=${format(view.times[index],'s')}  ·  `+visible.map(c=>`${c.label} ${format(c.values[index],'V')}`).join('  ·  '):'Place a Probe, then Run. Hover the plot for synchronized voltage readings.';
      if(index>=0&&visible.length===2)$('scope-cursor-readings').textContent+=`  ·  Δ (${visible[1].label} − ${visible[0].label}) ${format(visible[1].values[index]-visible[0].values[index],'V')}`;
      const warnings=[overflow?`First 32 probes shown (${overflow} more).`:'',unresolved.length?`${unresolved.length} unconnected probe target(s).`:''];
      $('scope-info').textContent=`Linked time/cursor · ${format(state?.frame?.timeStep,'s')} sample interval · ${view.capacity.toLocaleString()} sample buffer. ${warnings.join(' ')}`;
    }
    controls();return {setDocument,onState,onFrame};
  }
  globalThis.CircuitScopeView=Object.freeze({create});
})();
