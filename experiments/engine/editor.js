'use strict';
(async () => {
  const M = CircuitEditorModel, P = M.placementDefinitions, $ = id => document.getElementById(id), svg = $('canvas'), surface = $('surface');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = value => structuredClone(value), selection = new Set();
  let model, camera = { x: 0, y: 0, scale: 1 }, size = { width: 0, height: 0 }, tool = 'select', rotation = 0, mirror = false, mouse = { x: 0, y: 0 }, hover = null;
  let gesture = null, preview = null, wireDraft = null, space = false, scheduled = false, ready = false, syncToken = 0, simState = null;
  let lastBodyClick = null, clipboard = null, pressedPush = null;
  let compiled = null, compileDocument = null;
  const chooser = $('component-chooser'), propertyDialog = $('component-properties');
  const icons = { inductor:'∿',diode:'▷',currentSource:'→',potentiometer:'↗',resistor:'⊟',capacitor:'⊣',voltageSource:'⊕',voltageRail:'⊕',acSource:'∿',acRail:'∿',switch:'⤴',ground:'⏚',opamp:'▷',output:'out',logicOutput:'L/H',logicInput:'H',dFlipFlop:'D',jkFlipFlop:'JK',tFlipFlop:'T' };
  $('parts').innerHTML = Object.entries(P).map(([kind, def]) => { const name = /^(.*) \((.*)\)$/.exec(def.name); return `<button data-tool="${kind}"><span>${icons[kind] || '◇'}</span><span class="part-name">${name ? esc(name[1]) + '<small>' + esc(name[2]) + '</small>' : esc(def.name)}</span></button>`; }).join('');
  const menuEntries = CircuitComponentMenu.entries(P);
  let menuPath = [];
  function menuPanel(entries, depth) {
    const panel = document.createElement('div'); panel.className = 'component-menu-panel'; panel.setAttribute('role','menu');
    if(!entries.length){const empty=document.createElement('p');empty.textContent='No saved subcircuits';panel.append(empty);}
    entries.forEach((entry,index)=>{
      const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');
      button.textContent=entry.label;button.dataset.menuIndex=index;button.tabIndex=-1;
      if(entry.children){button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');}
      else {button.dataset.kind=entry.tool||'';button.setAttribute('aria-disabled',String(!entry.available));if(!entry.available)button.title=entry.reason;}
      const open=()=>{
        while($('component-list').children.length>depth+1)$('component-list').lastElementChild.remove();
        for(const sibling of panel.querySelectorAll('button')){sibling.classList.toggle('active',sibling===button);if(sibling.hasAttribute('aria-expanded'))sibling.setAttribute('aria-expanded','false');}
        menuPath=menuPath.slice(0,depth);menuPath[depth]=button;
        $('component-menu-status').textContent=entry.reason||'Arrow keys navigate · Enter chooses · Escape closes';
        if(entry.children){button.setAttribute('aria-expanded','true');$('component-list').append(menuPanel(entry.children,depth+1));}
      };
      button.addEventListener('pointerenter',open);
      button.addEventListener('focus',()=>{for(const sibling of panel.querySelectorAll('button'))sibling.classList.toggle('active',sibling===button);});
      button.onclick=()=>{
        if(entry.children){open();$('component-list').lastElementChild.querySelector('button')?.focus();return;}
        if(!entry.available){$('component-menu-status').textContent=entry.reason;return;}
        chooser.close();setTool(entry.tool);
        svg.focus();
      };
      button.onkeydown=event=>{
        const buttons=[...panel.querySelectorAll('button')];let handled=true;
        if(event.key==='ArrowDown'||event.key==='ArrowUp')buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
        else if(event.key==='Home')buttons[0].focus();
        else if(event.key==='End')buttons.at(-1).focus();
        else if(event.key==='ArrowRight'&&entry.children){open();$('component-list').lastElementChild.querySelector('button')?.focus();}
        else if(event.key==='ArrowLeft'&&depth>0){const parent=menuPath[depth-1];while($('component-list').children.length>depth)$('component-list').lastElementChild.remove();parent?.setAttribute('aria-expanded','false');parent?.focus();}
        else handled=false;
        if(handled){event.preventDefault();event.stopPropagation();}
      };
      panel.append(button);
    });
    return panel;
  }
  function addComponent() {
    setTool('select');menuPath=[];$('component-list').replaceChildren(menuPanel(menuEntries,0));
    const bounds=svg.getBoundingClientRect();
    chooser.style.left=Math.max(8,Math.min(bounds.left+mouse.x,innerWidth-Math.min(620,innerWidth-16)-8))+'px';
    chooser.style.top=Math.max(8,Math.min(bounds.top+mouse.y,innerHeight-Math.min(560,innerHeight-16)-8))+'px';
    chooser.showModal();$('component-list').querySelector('button')?.focus();
  }
  chooser.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();chooser.close();}});
  chooser.addEventListener('click',event=>{if(event.target===chooser){const b=chooser.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)chooser.close();}});
  chooser.addEventListener('close',()=>svg.focus());$('add-component').onclick=addComponent;
  const chipKinds=['dFlipFlop','jkFlipFlop','tFlipFlop','counter','latch','halfAdder','fullAdder'];
  const chipHalf=c=>Math.max(...Object.values(M.definitions[c.kind].pins).map(p=>Math.abs(p[1])))+16;
  function outputReading(c,m){
    if(!m)return null;
    if(m.text!==undefined)return m.text;
    if(['dataExport','audioOutput'].includes(c.kind))return (m.samples||0)+' samples';
    if(c.kind==='stopTrigger')return m.stopped?'Stopped':'Armed';
    if(['dcMotor','threePhaseMotor'].includes(c.kind))return format(m.speed,'rad/s');
    if(c.kind==='lamp')return format(m.temperature,'K');
    if(c.kind==='variableVoltage')return format(m.voltage,'V');
    if(['voltmeter','testPoint'].includes(c.kind)&&c.parameters.mode===5)return String(m.value);
    const unit={voltmeter:'V',testPoint:'V',ohmmeter:'Ω',ammeter:'A',wattmeter:'W'}[c.kind];
    return unit?(m.value===null?(c.kind==='ohmmeter'?'∞ '+unit:'—'):format(m.value,unit)):null;
  }
  function symbol(c, current = 0, measured = {}) {
    const leads = '<path d="M-48 0H-24M24 0H48"/>';

    const p=c.parameters;
    if(M.graphic(c.kind)){
      const b=M.graphicSize(c);
      if(c.kind==='text')return `<text x="${-b.width/2}" y="${-b.height/2+p.size}" font-size="${p.size}" font-family="system-ui,sans-serif" stroke="none" fill="currentColor">${p.text.split('\n').map((line,i)=>`<tspan x="${-b.width/2}" dy="${i?p.size*1.3:0}">${esc(line)}</tspan>`).join('')}</text>`;
      if(c.kind==='box')return `<rect x="${-p.width/2}" y="${-p.height/2}" width="${p.width}" height="${p.height}" fill="none" stroke-dasharray="8 4"/>`;
      return `<path d="M${-p.width/2} ${-p.height/2}L${p.width/2} ${p.height/2}"/>`;
    }
    if(c.kind==='variableVoltage')return '<circle r="20"/><path d="M0 20V32"/><g data-upright-icon><path d="M-12 12L12-12M3-12H12V-3"/></g>';
    if(c.kind==='lamp')return leads+`<circle r="24" fill="rgba(255,175,55,${Math.max(0,Math.min(1,((measured.temperature||300)-700)/2000))})"/><path d="M-16-16L16 16M-16 16L16-16"/>`;
    if(['ammeter','ohmmeter','voltmeter'].includes(c.kind))return leads+`<circle r="24"/><text y="6" text-anchor="middle" font-size="16" stroke="none" fill="currentColor">${{ammeter:'A',ohmmeter:'Ω',voltmeter:'V'}[c.kind]}</text>`;
    if(['testPoint','labeledNode','dataExport','audioOutput','stopTrigger'].includes(c.kind)){
      const text=c.kind==='labeledNode'?p.name:c.kind==='testPoint'?p.label:c.kind==='dataExport'?'DATA':c.kind==='audioOutput'?'AUDIO':'TRIG';
      return `<path d="M-48 0H-24M-24-16H24V16H-24Z"/><text y="4" text-anchor="middle" font-size="10" stroke="none" fill="currentColor">${esc(text)}</text>`;
    }
    if(c.kind==='wattmeter')return '<path d="M-48-16H-24M24-16H48M-48 16H-24M24 16H48M-24-28H24V28H-24Z"/><text y="5" text-anchor="middle" font-size="14" stroke="none" fill="currentColor">W</text>';
    if(['decimalDisplay','instructionDisplay'].includes(c.kind))return '<path d="M-48-48H-24M-48-16H-24M-48 16H-24M-48 48H-24M-24-64H48V64H-24Z"/>'+`<text x="12" y="5" text-anchor="middle" font-size="12" stroke="none" fill="currentColor">${esc(String(measured.text??'—').length>8?String(measured.text).slice(0,8)+'…':measured.text??'—')}</text>`+Array.from({length:4},(_,i)=>`<text x="-20" y="${52-32*i}" font-size="8" fill="currentColor" stroke="none">${i}</text>`).join('');
    if(c.kind==='ledArray')return '<rect x="-128" y="-128" width="256" height="256"/>'+Array.from({length:8},(_,i)=>`<path d="M${-112+32*i} 128V160M-160 ${-112+32*i}H-128"/><text x="${-107+32*i}" y="148" font-size="8" stroke="none" fill="currentColor">C${i}</text><text x="-152" y="${-117+32*i}" font-size="8" stroke="none" fill="currentColor">R${i}</text>`).join('')+Array.from({length:64},(_,i)=>`<circle cx="${-112+32*(i%8)}" cy="${-112+32*Math.floor(i/8)}" r="7" stroke="#607064" fill="rgba(255,75,45,${Math.max(.04,Math.min(1,(measured.currents?.[i]||0)/.01))})"/>`).join('');
    if(['dcMotor','threePhaseMotor'].includes(c.kind)){
      const angle=Number.isFinite(measured.angle)?measured.angle:0;
      return Object.entries(M.definitions[c.kind].pins).map(([name,[x,y]])=>`<text x="${x<0?-44:44}" y="${y-5}" text-anchor="${x<0?'start':'end'}" font-size="8" stroke="none" fill="currentColor">${esc(name)}</text><path d="M${x} ${y}L${x<0?-24:24} ${y/2}"/>`).join('')+`<circle r="24"/><path d="M0 0L${Math.cos(angle)*17} ${Math.sin(angle)*17}"/><text x="0" y="5" text-anchor="middle" font-size="10" stroke="none" fill="currentColor">${c.kind==='dcMotor'?'M':'3~'}</text>`;
    }
    if(c.kind==='transmissionLine')return '<path d="M-48-16H-24M-48 16H-24M24-16H48M24 16H48M-24-24H24V24H-24ZM-24-8H24M-24 8H24"/>';
    if(c.kind==='customTransformer')return '<path d="M-32-64V-56C-8-56-8-40-32-40V-32M-32 0V12C-8 12-8 28-32 28C-8 28-8 44-32 44V64M32-64V-48C8-48 8-24 32-24C8-24 8 0 32 0C8 0 8 24 32 24C8 24 8 48 32 48V64M-5-64V64M5-64V64"/>';
    if(c.kind==='pushSwitch')return `<path d="M-48 0H-20M20 0H48M-20 0L20 ${c.parameters.normallyClosed?0:-16}M0-32V-16M-12-32H12"/>`;
    if(c.kind==='mbbSwitch'){const p=c.parameters.position;return '<path d="M-48 0H-20M20-16H48M20 16H48"/>'+((p===0||p%2)?'<path d="M-20 0L20-16"/>':'')+((p===2||p%2)?'<path d="M-20 0L20 16"/>':'');}
    if (c.kind === 'transformer'||c.kind==='tappedTransformer') return '<path d="M-32-48V-24C-10-24-10-12-32-12C-10-12-10 0-32 0C-10 0-10 12-32 12C-10 12-10 24-32 24V48M32-48V-24C10-24 10-12 32-12C10-12 10 0 32 0C10 0 10 12 32 12C10 12 10 24 32 24V48M-5-28V28M5-28V28"/>';
    if (['spdtSwitch', 'dpdtSwitch', 'mbbSwitch'].includes(c.kind)) {
      const rows = c.kind === 'spdtSwitch' ? [0] : [-32, 16], reverse = c.kind === 'dpdtSwitch' ? 1 : -1;
      return rows.map(y => `<path d="M-48 ${y}H-20M20 ${y - 16}H48M20 ${y + 16}H48M-20 ${y}L18 ${y + (c.parameters.position === 2 ? 0 : (c.parameters.position === 0 ? 16 : -16) * reverse)}"/><circle cx="20" cy="${y - 16}" r="2"/><circle cx="20" cy="${y + 16}" r="2"/>`).join('') + (rows.length === 2 ? '<path d="M0-32V16" stroke-dasharray="3 3"/>' : '');
    }
    if (c.kind === 'led') return leads + `<path d="M-24 0H-16M16 0H24M-16-16V16L16 0ZM16-16V16" fill="rgba(255,80,64,${Math.min(1, Math.max(0, current / c.parameters.maxCurrent))})"/><path d="M0-22L12-34M6-34H12V-28M12-14L24-26M18-26H24V-20"/>`;
    if (c.kind === 'zener') return leads + '<path d="M-24 0H-16M16 0H24M-16-16V16L16 0ZM10-20H16V20H22"/>';
    if (c.kind === 'resistor') return leads + '<path d="M-24-8H24V8H-24Z"/>';
    if (['npn', 'pnp'].includes(c.kind)) {
      const sign = c.kind === 'npn' ? 1 : -1;
      return `<path d="M-48 0H-12M-12-20V20M-12-8L16 ${-16 * sign}H48M-12 8L16 ${16 * sign}H48"/><path d="${sign === 1 ? 'M7 8L16 16L5 17' : 'M3 0L-7 8L4 10'}"/>`;
    }
    if (['nmos', 'pmos', 'njfet', 'pjfet'].includes(c.kind)) return '<path d="M-48 0H-16M-16-20V20M-8-20V20M-8-16H48M-8 16H48"/><text x="0" y="5" stroke="none" fill="currentColor" font-size="9">' + esc(c.kind.toUpperCase()) + '</text>';
    if (c.kind.endsWith('Gate')) return '<path d="M-48-16H-24M-48 16H-24M24 0H48M-24-28H24V28H-24Z"/><text x="0" y="4" text-anchor="middle" stroke="none" fill="#e0e9f6" font-size="11">' + esc(c.kind.slice(0, -4).toUpperCase()) + '</text>';
    if (c.kind === 'inverter') return '<path d="M-48 0H-24M-24-24V24L20 0ZM28 0H48"/><circle cx="24" cy="0" r="4"/>';
    if (c.kind === 'inductor') return '<path d="M-48 0H-24C-24-22-12-22-12 0C-12-22 0-22 0 0C0-22 12-22 12 0C12-22 24-22 24 0H48"/>';
    if (c.kind === 'diode') return leads + '<path d="M-24 0H-16M16 0H24M-16-16V16L16 0ZM16-16V16"/>';
    if (c.kind === 'currentSource') return '<circle r="24"/><path d="M-48 0H-24M24 0H48M-12 0H12M4-7L12 0L4 7"/>';
    if (c.kind === 'potentiometer') return leads + '<path d="M-24-8H24V8H-24ZM0 32V12M-6 20L0 12L6 20"/>';
    if (c.kind === 'analogSwitch') return '<path d="M-48 0H-20L18-12M20 0H48M0-32V-20"/><path d="M0-20V-4" stroke-dasharray="3 3"/><text x="7" y="-22" font-size="9" stroke="none" fill="currentColor">C</text>';
    if (c.kind === 'analogSpdtSwitch') return '<path d="M-48 0H-20L18-16M20-16H48M20 16H48M0 32V20"/><path d="M0 20V0" stroke-dasharray="3 3"/><text x="7" y="26" font-size="9" stroke="none" fill="currentColor">C</text>';
    if (c.kind === 'polarizedCapacitor') return '<path d="M-48 0H-5M8 0H48M-5-16V16M12-16Q4 0 12 16M-24-14H-12M-18-20V-8"/>';
    if(['counter','latch','halfAdder','fullAdder'].includes(c.kind))return format(c.parameters.highVoltage,'V')+(['counter','latch'].includes(c.kind)?' · starts '+c.parameters.initialValue:'')+(c.kind==='counter'&&c.parameters.modulus?' · mod '+c.parameters.modulus:'');
    if (c.kind === 'output') return '<path d="M-48 0H-24M-24-16H24V16H-24Z"/><text x="0" y="5" text-anchor="middle" stroke="none" fill="currentColor" font-size="10">out</text>';
    if (c.kind === 'logicOutput') return '<path d="M-48 0H-24M-24-16H24V16H-24Z"/><text x="0" y="5" text-anchor="middle" stroke="none" fill="currentColor" font-size="10">L/H</text>';
    if (c.kind === 'logicInput') return `<circle r="20"/><path d="M20 0H48"/><text x="0" y="7" text-anchor="middle" stroke="none" fill="currentColor" font-size="14">${c.parameters.mode === 'logic' ? (c.parameters.state === 0 ? 'L' : 'H') : String(c.parameters.state)}</text>`;
    if (chipKinds.includes(c.kind)) {
      const labels=Object.entries(M.definitions[c.kind].pins),half=chipHalf(c);
      return `<path d="M-24-${half}H24V${half}H-24Z"/>`+labels.map(([pin,[x,y]])=>{
        const text=pin==='clock'?((c.kind==='jkFlipFlop'&&!c.parameters.positiveEdge||c.kind==='counter'&&c.parameters.negativeEdge)?'○▷':'▷'):pin==='reset'&&c.parameters.invertReset?'R̅':pin==='load'?(c.parameters.edgeTriggered?'▷':'Ld'):pin==='Qn'?'Q̅':pin==='carryIn'?'Cin':pin==='carryOut'?'Cout':pin;
        return `<path d="M${x} ${y}H${x<0?-24:24}"/><text x="${x<0?-20:20}" y="${y+4}" text-anchor="${x<0?'start':'end'}" stroke="none" fill="#e0e9f6" font-size="10">${text}</text>`;
      }).join('');
    }
    if (c.kind === 'capacitor') return '<path d="M-48 0H-5M5 0H48M-5-16V16M5-16V16"/>';
    if (c.kind === 'switch') return '<path d="M-48 0H-20M20 0H48"/><circle cx="-20" cy="0" r="2.5"/><circle cx="20" cy="0" r="2.5"/>' + `<path d="M-18 0L18 ${c.parameters.closed ? 0 : -18}"/>`;
    if (c.kind === 'opamp') return '<path d="M-48-16H-24M-48 16H-24M32 0H48M-24-32V32L32 0ZM-18-16H-10M-18 16H-10M-14 12V20"/>';
    if (isSource(c)) {
      const w = c.parameters.waveform, shapes = {
        sine: 'M-16 0C-12-20-4-20 0 0S12 20 16 0', square: 'M-16 10V-10H0V10H16V-10',
        triangle: 'M-16 10L-8-10L8 10L16-10', sawtooth: 'M-16 10L0-10V10L16-10', pulse: 'M-16 10H-8V-10H0V10H16'
      };
      const icon=w.kind==='dc'?'<text x="0" y="-9" dominant-baseline="central" text-anchor="middle" font-size="17" stroke="none" fill="currentColor">+</text><text x="0" y="10" dominant-baseline="central" text-anchor="middle" font-size="17" stroke="none" fill="currentColor">−</text>':`<g data-upright-icon><path d="${shapes[w.kind]}"/></g>`;
      return `<circle r="${c.kind === 'voltageRail' ? 20 : 24}"/><path d="${c.kind === 'voltageRail' ? 'M0 20V32' : 'M0-48V-24M0 24V48'}"/>`+icon;
    }
    return '<path d="M0-32V0M-18 0H18M-12 7H12M-5 14H5"/>';
  }
  function orientedSymbol(c,pose,current=0,measured={}){
    const markup=symbol(c,current,measured);
    // Standalone text annotations retain their explicitly chosen orientation.
    return c.kind==='text'?markup:CircuitSymbolOrientation.upright(markup,pose);
  }
  function format(n, unit = '') {
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) < 1e-15) n = 0;
    const scale = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']].find(([s]) => Math.abs(n) >= s) || [1, ''];
    return `${Number((n / scale[0]).toPrecision(4))} ${scale[1]}${unit}`.trim();
  }
  function value(c) {
    if(M.outputSpecs[c.kind])return c.kind==='variableVoltage'?format(c.parameters.voltage,'V'):c.kind==='lamp'?format(c.parameters.nominalPower,'W')+' · '+format(c.parameters.nominalVoltage,'V'):c.kind==='labeledNode'?c.parameters.name:M.graphic(c.kind)?'Annotation':M.definitions[c.kind].name;
    if(c.kind==='pushSwitch')return pressedPush?.id===c.id?'Pressed':c.parameters.normallyClosed?'Normally closed':'Normally open';
    if(c.kind==='mbbSwitch')return ['A','A + B','B','A + B'][c.parameters.position];
    if(c.kind==='customTransformer')return `${c.parameters.turns1},${c.parameters.turns2}:${c.parameters.turns3} · ${format(c.parameters.inductance,'H')}`;
    if(c.kind==='transmissionLine')return format(c.parameters.impedance,'Ω')+' · '+format(c.parameters.delay,'s');
    if (c.kind === 'resistor') return format(c.parameters.resistance, 'Ω');
    if (c.kind === 'transformer'||c.kind==='tappedTransformer') return `1:${c.parameters.ratio} · ${format(c.parameters.inductance, 'H')}`;
    if (['spdtSwitch', 'dpdtSwitch', 'mbbSwitch'].includes(c.kind)) return c.parameters.position === 2 ? 'Off' : c.parameters.position === 0 ? 'A' : 'B';
    if (c.kind === 'led') return format(c.parameters.forwardVoltage, 'V');
    if (c.kind === 'zener') return format(c.parameters.breakdownVoltage, 'V') + ' Zener';
    if (c.kind === 'inductor') return format(c.parameters.inductance, 'H');
    if (c.kind === 'currentSource') return format(c.parameters.current, 'A');
    if (c.kind === 'potentiometer') return format(c.parameters.resistance, 'Ω') + ' · ' + Number((c.parameters.position * 100).toPrecision(4)) + '%';
    if (['analogSwitch', 'analogSpdtSwitch'].includes(c.kind)) return format(c.parameters.onResistance, 'Ω') + ' · ' + format(c.parameters.threshold, 'V') + (c.parameters.inverted ? ' inverted' : '');
    if (['capacitor', 'polarizedCapacitor'].includes(c.kind)) return format(c.parameters.capacitance, 'F');
    if (isSource(c)) { const w = c.parameters.waveform; return w.kind !== 'dc' ? `${format(w.amplitude, 'V')} pk · ${format(w.frequency, 'Hz')} · ${format(w.offset, 'V')} offset` : format(w.voltage, 'V'); }
    if (c.kind === 'switch') return c.parameters.closed ? 'Closed' : 'Open';
    if (c.kind === 'output') return c.parameters.showVoltage ? 'Shows voltage' : 'Marker only';
    if (c.kind === 'logicOutput') return `${c.parameters.mode === 'numeric' ? 'Numeric' : c.parameters.mode === 'ternary' ? 'Ternary' : 'Logic'} · ${format(c.parameters.threshold, 'V')}`;
    if (c.kind === 'logicInput') return `${c.parameters.mode === 'logic' ? (c.parameters.state === 0 ? 'L' : 'H') : String(c.parameters.state)} · ${format(c.parameters.highVoltage, 'V')} / ${format(c.parameters.lowVoltage, 'V')}`;
    if (['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind)) return `${format(c.parameters.highVoltage, 'V')} · Q starts ${c.parameters.initialState ? 'high' : 'low'}${c.kind === 'jkFlipFlop' && c.parameters.positiveEdge ? ' · rising edge' : ''}`;
    if (c.kind === 'opamp') return `${format(c.parameters.minOutput, 'V')} … ${format(c.parameters.maxOutput, 'V')}`; return '';
  }
  function logicLevel(parameters, voltage) {
    if (!Number.isFinite(voltage)) return '—';
    if (parameters.mode === 'ternary') return voltage > parameters.threshold * 1.5 ? '2' : voltage > parameters.threshold * .5 ? '1' : '0';
    if (parameters.mode === 'numeric') return voltage < parameters.threshold ? '0' : '1';
    return voltage < parameters.threshold ? 'L' : 'H';
  }
  function isSource(c) { return c.kind === 'voltageSource' || c.kind === 'voltageRail'; }
  function componentName(c) { return isSource(c) ? `${c.parameters.waveform.kind === 'dc' ? 'DC' : 'AC'} source (${c.kind === 'voltageRail' ? '1 terminal' : '2 terminals'})` : M.definitions[c.kind].name; }
  function local(event) { const r = svg.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function world(p) { return { x: (p.x - camera.x) / camera.scale, y: (p.y - camera.y) / camera.scale }; }
  function selected(kind, id) { return selection.has(M.token(kind, id)); }
  function requestRender() { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); } }
  function message(text) { $('notice').textContent = text; }
  function friendly(error) {
    const text = error?.message || String(error);
    if (/ground is required/i.test(text)) return 'Add a ground connection to simulate.';
    if (/floating circuit/i.test(text)) return 'Connect the remaining parts to a ground-referenced circuit.';
    if (/must contain components/i.test(text)) return 'Choose a component to start building.';
    if (/ideal .*loop/i.test(text)) return 'This connection creates an unsupported ideal loop. Undo or change the wiring.';
    return text;
  }
  function updateReadings() {
    const host = $('readings'); if (!host) return;
    const c = model.document.electrical.components.find(c => selected('component', c.id));
    if (!c) return;
    const frame = CircuitSimulation.presentationFrame(simState), pins = frame?.pinVoltages[c.id];
    host.innerHTML = Object.keys(M.definitions[c.kind].pins).map(p => `<div class="reading"><span>Pin ${esc(p)}</span><span>${pins ? format(pins[p], 'V') : '—'}</span></div>`).join('') +
      (frame&&Object.hasOwn(frame.componentCurrents,c.id)?`<div class="reading"><span>Current</span><span>${format(frame.componentCurrents[c.id],'A')}</span></div>`:'')+(outputReading(c,frame?.componentMeasurements?.[c.id])?`<div class="reading"><span>Reading</span><span>${esc(outputReading(c,frame.componentMeasurements[c.id]))}</span></div>`:'');
  }
  function cancelBodyClick() { if (lastBodyClick?.timer) clearTimeout(lastBodyClick.timer); lastBodyClick = null; }
  function inspector() {
    const d = model.document, components = d.electrical.components.filter(c => selected('component', c.id)), host = $('inspector');
    if (selection.size === 1 && components.length === 1) {
      const c = components[0];
      host.innerHTML = `<h2>${esc(c.reference)}</h2><p class="subtle">${componentName(c)}<br>${esc(value(c))}</p><button id="edit-component" class="wide">Edit properties · E</button><div class="readings" id="readings"></div>`;
      $('edit-component').onclick = () => editComponent(c.id);
      if(c.kind==='variableVoltage'){
        const p=c.parameters,control=document.createElement('div');control.className='variable-control';control.innerHTML=`<label for="variable-slider">${esc(p.label||c.reference)}</label><input id="variable-slider" type="range" min="${p.minVoltage}" max="${p.maxVoltage}" step="${(p.maxVoltage-p.minVoltage)/1000}" value="${p.voltage}"><output id="variable-value">${esc(format(p.voltage,'V'))}</output>`;host.append(control);
        const slider=$('variable-slider');
        slider.oninput=()=>{voltageSlider.input(c.id,Number(slider.value));$('variable-value').textContent=format(Number(slider.value),'V');requestRender();};
        slider.onchange=()=>voltageSlider.finish();
        slider.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();voltageSlider.cancel();const value=model.document.electrical.components.find(item=>item.id===c.id)?.parameters.voltage;slider.value=String(value);$('variable-value').textContent=format(value,'V');requestRender();}};
        slider.addEventListener('pointercancel',()=>{voltageSlider.cancel();inspector();requestRender();});
      }
      if(['dataExport','audioOutput'].includes(c.kind)){
        const exportButton=document.createElement('button');exportButton.textContent='Download voltage data · CSV';exportButton.onclick=()=>act(async()=>{const capture=await simulation.readCapture(c.id);download(CircuitOutputTools.csv(capture),c.reference+'.csv','text/csv');});host.append(exportButton);
        if(c.kind==='audioOutput'){
          const play=document.createElement('button');play.textContent='Play captured audio';play.onclick=()=>act(async()=>{const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error('Audio playback is unavailable in this browser');const ctx=new AudioContext();try{await ctx.resume();const capture=await simulation.readCapture(c.id);if(!capture.values.length)throw new Error('Run the circuit to capture audio first');const values=CircuitOutputTools.normalized(capture.values),buffer=ctx.createBuffer(1,values.length,Math.round(1/capture.timeStep));buffer.copyToChannel(values,0);const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.onended=()=>ctx.close();source.start();}catch(error){await ctx.close();throw error;}});host.append(play);
          const wav=document.createElement('button');wav.textContent='Download audio · WAV';wav.onclick=()=>act(async()=>{const capture=await simulation.readCapture(c.id);download(CircuitOutputTools.wav(capture),c.reference+'.wav','audio/wav');});host.append(wav);
        }
      }
      if(['voltmeter','testPoint'].includes(c.kind)){
        const scopeButton=document.createElement('button');scopeButton.textContent='Plot in oscilloscope';scopeButton.onclick=()=>model.transaction('Plot meter',next=>{const id=crypto.randomUUID(),probe=c.kind==='voltmeter'?{id,kind:'voltage',label:c.reference,positive:{kind:'pin',componentId:c.id,pinId:'a'},negative:{kind:'pin',componentId:c.id,pinId:'b'}}:{id,kind:'voltage',label:c.reference,positive:{kind:'pin',componentId:c.id,pinId:'in'},reference:'ground'};next.probes.push(probe);(next.layout.probes||={})[id]={x:0,y:-32};});host.append(scopeButton);
      }
      updateReadings(); return;
    }
    const probe = d.probes.find(p => selected('probe', p.id));
    host.innerHTML = probe ? `<h2>${esc(probe.label || 'Voltage probe')}</h2><p class="subtle">Voltage probe · plotted in Oscilloscope.<br>Drag the label to reposition it. Delete removes the marker.</p><form id="probe-properties" class="probe-name-form"><label for="probe-label">Probe name</label><input id="probe-label" value="${esc(probe.label || probe.id)}" maxlength="40" required><button type="submit">Rename probe</button></form>` :
      selection.size ? `<h2>${selection.size} selected</h2><p class="subtle">M moves · G drags connected wires.<br>R rotates · X/Y flip.<br>Delete removes selected items.</p>` :
        '<h2>Your workspace</h2><p class="subtle">A adds a component or voltage probe.<br><br>Double-click a component or press E to edit its properties.<br><br>Single-click a switch or logic input to change its state. Double-click edits without toggling.</p>';
    if (probe) $('probe-properties').onsubmit = event => { event.preventDefault(); const label = $('probe-label').value.trim(); if (!label) { message('Enter a probe name.'); return; } model.transaction('Rename probe', next => { next.probes.find(p => p.id === probe.id).label = label; }); };
  }
  function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function releaseVariable(){voltageSlider.finish();requestRender();}
  function effectiveDocument(){const variableDraft=voltageSlider.draft;let d=pressedPush?M.momentaryDocument(model.document,pressedPush.id):model.document;if(variableDraft){d=clone(d);const c=d.electrical.components.find(c=>c.id===variableDraft.id&&c.kind==='variableVoltage');if(c)c.parameters.voltage=variableDraft.voltage;}return d;}
  function parseNumber(input) {
    const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([pnuµmkKMG]?)$/.exec(input.trim());
    if (!match) throw new Error('Use a number, optionally followed by p, n, u, m, k, M or G.');
    const number = Number(match[1]) * ({ p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, '': 1 }[match[2]]);
    if (!Number.isFinite(number)) throw new Error('Enter a finite number.'); return number;
  }
  function editComponent(id) {
    cancelBodyClick(); setTool('select');
    if (!id) { if (!commandSelection()) return; id = model.document.electrical.components.find(c => selected('component', c.id))?.id; }
    const c = model.document.electrical.components.find(c => c.id === id); if (!c) return;
    selection.clear(); selection.add(M.token('component', id)); inspector(); controls(); requestRender();
    const source = isSource(c), wave = c.parameters.waveform;
    const raw = source ? { voltage: String(wave.voltage ?? 0), amplitude: String(wave.amplitude ?? Math.abs(wave.voltage ?? 1)), frequency: String(wave.frequency ?? 1000), offset: String(wave.offset ?? 0), phase:String((wave.phase??0)*180/Math.PI), dutyCycle: String((wave.dutyCycle ?? .5) * 100) } : {};
    const sourceFields = kind => kind === 'dc' ? [['voltage', 'DC voltage · V']] : [['amplitude', 'Amplitude · V peak'], ['frequency', 'Frequency · Hz'], ['offset', 'DC offset · V'], ['phase','Phase · degrees'], ...(['square', 'pulse'].includes(kind) ? [['dutyCycle', 'Duty cycle · %']] : [])];
    let fields = source ? sourceFields(wave.kind) : ['transformer','tappedTransformer'].includes(c.kind) ? [['inductance', 'Primary inductance · H'], ['ratio', 'Turns ratio · secondary / primary'], ['coupling', 'Coupling · greater than 0, less than 1']] : c.kind === 'led' ? [['forwardVoltage', 'Forward voltage at 1 A · V'], ['maxCurrent', 'Full-brightness current · A']] : c.kind === 'zener' ? [['forwardVoltage', 'Forward voltage at 1 A · V'], ['breakdownVoltage', 'Breakdown voltage · V']] : c.kind === 'resistor' ? [['resistance', 'Resistance · Ω']] : ['analogSwitch', 'analogSpdtSwitch'].includes(c.kind) ? [['onResistance', 'On resistance · Ω'], ['offResistance', 'Off / pulldown resistance · Ω'], ['threshold', 'Control threshold · V']] : ['capacitor', 'polarizedCapacitor'].includes(c.kind) ? [['capacitance', 'Capacitance · F'], ['initialVoltage', 'Initial voltage · V'], ...(c.kind === 'polarizedCapacitor' ? [['maxReverseVoltage', 'Maximum reverse voltage · V']] : [])] :
      ['npn', 'pnp'].includes(c.kind) ? [['beta', 'Current gain · β']] : ['nmos', 'pmos', 'njfet', 'pjfet'].includes(c.kind) ? [['threshold', 'Threshold · V (signed model value)'], ['beta', 'Transconductance parameter · A/V²']] : c.kind.endsWith('Gate') ? [['highVoltage', 'Logic high · V']] : c.kind === 'inverter' ? [['highVoltage', 'Logic high · V'], ['slewRate', 'Slew rate · V/ns']] : c.kind === 'inductor' ? [['inductance', 'Inductance · H'], ['initialCurrent', 'Initial current · A']] : c.kind === 'currentSource' ? [['current', 'Current a → b · A'], ['maxVoltage', 'Compliance voltage · V (0 = ideal)']] : c.kind === 'potentiometer' ? [['resistance', 'Total resistance · Ω'], ['position', 'Wiper position · 0 to 1']] : c.kind === 'opamp' ? [['gain', 'Open-loop gain'], ['minOutput', 'Minimum output · V'], ['maxOutput', 'Maximum output · V']] : c.kind === 'logicOutput' ? [['threshold', 'Logic threshold · V']] : c.kind === 'logicInput' ? [['highVoltage', 'High level · V'], ['lowVoltage', 'Low level · V']] : ['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind) ? [['highVoltage', 'Logic high · V']] : [];
    if(['counter','latch','halfAdder','fullAdder'].includes(c.kind))fields=[['highVoltage','Logic high · V'],...(['counter','latch'].includes(c.kind)?[['initialValue','Initial value · 0 to 15']]:[]),...(c.kind==='counter'?[['modulus','Modulus · 0 = 16, or 1 to 16']]:[])];
    if(c.kind==='customTransformer')fields=[['inductance','Base inductance · H'],['coupling','Coupling · 0 to 1 exclusive'],['turns1','First primary turns · signed'],['turns2','Second primary turns · signed'],['turns3','Secondary turns · signed']];
    if(c.kind==='transmissionLine')fields=[['delay','Delay · s (1 to 100000 timesteps)'],['impedance','Characteristic impedance · Ω']];
    const extra=M.outputSpecs[c.kind];
    if(extra){fields=Object.entries(extra.fields).map(([key,f])=>[key,f.label]);if(c.kind==='variableVoltage')fields.sort(([a],[b])=>a==='voltage'?-1:b==='voltage'?1:0);}
    const numericFields = (entries, values) => entries.map(([key,label],i)=>{const id=i===0?'value':key,f=extra?.fields[key];return `<label for="${id}">${esc(label)}</label>`+(f?.type==='string'?`<textarea id="${id}" name="${key}" rows="${['text','lookup'].includes(key)?5:2}" maxlength="${f.maxLength}">${esc(values[key])}</textarea>`:`<input id="${id}" name="${key}" value="${esc(values[key])}" required>`);}).join('');
    $('properties-title').textContent = `${c.reference} · ${componentName(c)}`;
    $('property-fields').innerHTML = `<label for="reference">Reference</label><input id="reference" name="reference" value="${esc(c.reference)}" maxlength="80" required>` +
      (source ? `<label for="waveform">Waveform</label><select id="waveform" name="waveform">${Object.entries(M.waveformNames).map(([kind, name]) => `<option value="${kind}">${name}</option>`).join('')}</select><div id="waveform-fields">${numericFields(fields, raw)}</div><p id="waveform-note"></p>` : numericFields(fields, c.parameters)) +
      (['spdtSwitch', 'dpdtSwitch', 'mbbSwitch'].includes(c.kind) ? `<label for="position">Position</label><select id="position" name="position">${c.kind==='mbbSwitch'?'<option value="0">A</option><option value="1">A + B</option><option value="2">B</option><option value="3">A + B</option>':'<option value="0">A</option><option value="1">B</option>'+(c.kind==='spdtSwitch'?'<option value="2">Off</option>':'')}</select>` : '') +
      (['logicOutput', 'logicInput'].includes(c.kind) ? `<label for="mode">Mode</label><select id="mode" name="mode"><option value="logic">Logic (L/H)</option><option value="numeric">Numeric (0/1)</option><option value="ternary">Ternary (0/1/2)</option></select>` : '') +
      (c.kind === 'logicInput' ? `<label for="state">State</label><select id="state" name="state"><option value="0">Low / 0</option><option value="1">High / 1</option><option value="2">Ternary 2</option></select>` : '') +
      (c.kind === 'logicOutput' ? `<label class="checkbox"><input name="pulldown" type="checkbox" ${c.parameters.pulldown ? 'checked' : ''}>1 MΩ pulldown to ground</label>` : '') +
      (['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind) ? `<label class="checkbox"><input name="initialState" type="checkbox" ${c.parameters.initialState ? 'checked' : ''}>Q starts high</label>` : '') +
      (c.kind === 'jkFlipFlop' ? `<label class="checkbox"><input name="positiveEdge" type="checkbox" ${c.parameters.positiveEdge ? 'checked' : ''}>Positive-edge clock</label>` : '') +
      (c.kind==='counter'?`<label class="checkbox"><input name="invertReset" type="checkbox" ${c.parameters.invertReset?'checked':''}>Active-low reset</label><label class="checkbox"><input name="negativeEdge" type="checkbox" ${c.parameters.negativeEdge?'checked':''}>Falling-edge clock</label>`:'')+
      (c.kind==='latch'?`<label class="checkbox"><input name="edgeTriggered" type="checkbox" ${c.parameters.edgeTriggered?'checked':''}>Edge-triggered register (off = transparent latch)</label>`:'')+
      (c.kind === 'output' ? `<label class="checkbox"><input name="showVoltage" type="checkbox" ${c.parameters.showVoltage ? 'checked' : ''}>Show voltage</label>` : '') +
      (['analogSwitch', 'analogSpdtSwitch'].includes(c.kind) ? `<label class="checkbox"><input name="inverted" type="checkbox" ${c.parameters.inverted ? 'checked' : ''}>Invert control</label><label class="checkbox"><input name="pulldown" type="checkbox" ${c.parameters.pulldown ? 'checked' : ''}>Pulldown resistors</label>` : '') +
      (c.kind==='pushSwitch'?`<label class="checkbox"><input name="normallyClosed" type="checkbox" ${c.parameters.normallyClosed?'checked':''}>Normally closed</label><p>Hold the symbol to press; release or Escape returns it to rest. Contacts update while simulation runs.</p>`:'')+
      (c.kind === 'switch' ? `<label class="checkbox"><input name="closed" type="checkbox" ${c.parameters.closed ? 'checked' : ''}>Closed</label>` : '') +
      (['capacitor', 'polarizedCapacitor', 'inductor', 'transformer', 'tappedTransformer', 'customTransformer'].includes(c.kind) ? `<label for="integration">Integration</label><select id="integration" name="integration"><option value="backwardEuler">Backward Euler</option><option value="trapezoidal">Trapezoidal</option></select>` : '') +
      (c.kind === 'opamp' ? '<p>Three-pin model with implicit supply limits. Input current is zero; output is limited by the minimum and maximum above.</p>' : '');
    if (source) {
      $('waveform').value = wave.kind;
      const note = () => { $('waveform-note').textContent = $('waveform').value === 'dc' ? (c.kind === 'voltageRail' ? 'Voltage is relative to ground.' : 'Voltage is measured from the negative to positive terminal.') : $('waveform').value === 'pulse' ? 'Pulse ranges from DC offset to offset + amplitude.' : 'Waveform swings about its DC offset; amplitude is peak volts.'; };
      note(); $('waveform').onchange = () => {
        const form = $('properties'); for (const [key] of fields) raw[key] = form.elements.namedItem(key).value;
        fields = sourceFields($('waveform').value); $('waveform-fields').innerHTML = numericFields(fields, raw); $('property-error').textContent = ''; note(); $('value').focus(); $('value').select();
      };
    }
    if (['spdtSwitch', 'dpdtSwitch', 'mbbSwitch'].includes(c.kind)) $('position').value = String(c.parameters.position);
    if (['logicOutput', 'logicInput'].includes(c.kind)) $('mode').value = c.parameters.mode;
    if (c.kind === 'logicInput') $('state').value = String(c.parameters.state);
    if (['capacitor', 'polarizedCapacitor', 'inductor', 'transformer', 'tappedTransformer', 'customTransformer'].includes(c.kind)) $('integration').value = c.parameters.integration;
    $('property-error').textContent = '';
    $('properties').onsubmit = event => {
      event.preventDefault(); try {
        const form = new FormData($('properties')), reference = String(form.get('reference')).trim(); if (!reference) throw new Error('Enter a component reference.');
        const parameters = clone(c.parameters);
        if (source) { parameters.waveform = { kind: form.get('waveform') }; for (const [key] of fields) parameters.waveform[key] = parseNumber(String(form.get(key))) * (key==='phase'?Math.PI/180:1) / (key === 'dutyCycle' ? 100 : 1); }
        else for (const [key] of fields) parameters[key] = extra?.fields[key]?.type==='string'?String(form.get(key)):parseNumber(String(form.get(key)));
        if (['spdtSwitch', 'dpdtSwitch', 'mbbSwitch'].includes(c.kind)) parameters.position = Number(form.get('position'));
        if (['logicOutput', 'logicInput'].includes(c.kind)) parameters.mode = form.get('mode');
        if (c.kind === 'logicOutput') parameters.pulldown = form.get('pulldown') === 'on';
        if(c.kind==='counter')for(const key of ['invertReset','negativeEdge'])parameters[key]=form.get(key)==='on';
        if(c.kind==='latch')parameters.edgeTriggered=form.get('edgeTriggered')==='on';
        if (c.kind === 'output') parameters.showVoltage = form.get('showVoltage') === 'on';
        if (c.kind === 'logicInput') {
          parameters.state = Number(form.get('state'));
          if (parameters.state === 2 && parameters.mode !== 'ternary') throw new Error('Ternary state requires ternary mode.');
        }
        if (['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind)) parameters.initialState = form.get('initialState') === 'on';
        if (c.kind === 'jkFlipFlop') parameters.positiveEdge = form.get('positiveEdge') === 'on';
        if (['analogSwitch', 'analogSpdtSwitch'].includes(c.kind)) for (const key of ['inverted', 'pulldown']) parameters[key] = form.get(key) === 'on';
        if(c.kind==='pushSwitch')parameters.normallyClosed=form.get('normallyClosed')==='on';
        if (c.kind === 'switch') parameters.closed = form.get('closed') === 'on';
        if (['capacitor', 'polarizedCapacitor', 'inductor', 'transformer', 'tappedTransformer', 'customTransformer'].includes(c.kind)) parameters.integration = form.get('integration');
        model.transaction('Edit ' + c.reference, next => { const item = next.electrical.components.find(item => item.id === id); if (!item) throw new Error('Component no longer exists.'); item.reference = reference; item.parameters = parameters; });
        propertyDialog.close();
      } catch (error) { $('property-error').textContent = friendly(error); }
    };
    propertyDialog.showModal(); const primary = $('value') || $('reference'); primary.focus(); primary.select();
  }
  $('cancel-properties').onclick = () => propertyDialog.close();
  propertyDialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); propertyDialog.close(); } event.stopPropagation(); });
  propertyDialog.addEventListener('close', () => svg.focus());
  function toggleRun(){const run=!simState?.runRequested;void act(()=>run?simulation.run():simulation.pause());}
  const scope = CircuitScopeView.create({ onRunToggle: toggleRun });
  const simulation = CircuitSimulation.create({
    batchSteps: 10, intervalMs: 16, onFrame: frame => { scope.onFrame(frame); requestRender(); }, onState: state => {
      scope.onState(state);
      simState = state;
      const label = state.status === 'error' ? 'Editing' : state.status === 'stepping' ? (state.runRequested ? 'Running' : 'Stepping') : state.status[0].toUpperCase() + state.status.slice(1);
      $('sim-state').textContent = label; $('sim-state').className = 'state' + (state.runRequested ? ' running' : '');
      $('run').textContent = state.runRequested ? 'Ⅱ Pause' : '▶ Run'; $('run').classList.toggle('running', state.runRequested);
      $('run').disabled = !ready || state.status === 'disposed';
      $('step').disabled = $('run').disabled || state.runRequested || ['updating', 'stepping', 'pausing'].includes(state.status);
      $('reset').disabled = !ready || !state.accepted || state.status === 'loading';
      if (state.error) message(friendly(state.error));
      updateReadings(); requestRender();
    }
  });
  const voltageSlider=CircuitVoltageSlider.create({
    preview: value => {const d=clone(model.document);if(value){const c=d.electrical.components.find(c=>c.id===value.id&&c.kind==='variableVoltage');if(c)c.parameters.voltage=value.voltage;}return sync(d);},
    commit: value => model.transaction('Adjust variable voltage',next=>{const c=next.electrical.components.find(c=>c.id===value.id&&c.kind==='variableVoltage');if(c)c.parameters.voltage=value.voltage;}),
    onError: error=>message(friendly(error))
  });
  async function sync(d, label) {
    const token = ++syncToken;
    try {
      const pending = simulation.setDocument(d);
      // Parameter-only updates keep the same terminals. Keep the last sampled
      // readings visible while the worker applies the new target value.
      try {compiled = CircuitDocumentAdapter.compile(d); compileDocument = JSON.stringify(d.electrical);}
      catch {compiled=null;compileDocument=null;}
      const result = await pending;
      if (token !== syncToken) return;
      compiled = CircuitDocumentAdapter.compile(d); compileDocument = JSON.stringify(d.electrical);
      if (result.activated && !simulation.getState().runRequested) await simulation.step(1);
      if (label) message(result.reused ? label + ' · connections unchanged' : result.appliedAtTime !== undefined ? label + ' · simulation state preserved' : label + ' · simulation restarted');
    } catch (error) { if (token === syncToken) message(friendly(error)); }
    requestRender();
  }
  function changed(d, label) {
    pressedPush=null;voltageSlider.clear();
    preview = null; hover = null; wireDraft = null; cancelBodyClick();
    simulation.setSampleChannels(scope.setDocument(d));
    const valid = new Set([...d.electrical.components.map(c => M.token('component', c.id)), ...d.electrical.wires.map(w => M.token('wire', w.id)), ...d.electrical.junctions.map(j => M.token('junction', j.id)), ...d.probes.map(p => M.token('probe', p.id))]);
    for (const key of selection) if (!valid.has(key)) selection.delete(key);
    try { localStorage.setItem('circuit-editor-prototype.v1', JSON.stringify(d)); $('save-status').textContent = 'Saved locally'; } catch { $('save-status').textContent = 'Save JSON to keep your work'; }
    $('project-title').textContent = d.title;
    // Preserve the native range element/focus after a slider commit (especially
    // keyboard changes); other edits rebuild the Inspector as before.
    if(label!=='Adjust variable voltage')inspector();
    else {const c=d.electrical.components.find(c=>selected('component',c.id)),summary=$('inspector').querySelector('p.subtle');if(c&&summary)summary.innerHTML=esc(componentName(c))+'<br>'+esc(value(c));}
    controls(); sync(d, label); requestRender();
  }
  function controls() { $('undo').disabled = !model?.canUndo; $('redo').disabled = !model?.canRedo; $('rotate').disabled = ![...selection].some(k => JSON.parse(k)[0] === 'component'); $('delete').disabled = !selection.size; }
  function releasePush(){if(!pressedPush)return;pressedPush=null;void sync(model.document,'Push switch released');requestRender();}
  function cancelGesture() {
    releasePush();releaseVariable();
    if (gesture?.paste) { selection.clear(); for (const key of gesture.prior) selection.add(key); }
    gesture?.dragSession?.cancel();
    gesture = null; preview = null;
  }
  function setTool(next) {
    cancelGesture(); tool = next; wireDraft = null; gesture = null; preview = null; cancelBodyClick();
    if(P[next]){rotation=next==='opampPlusTop'?180:0;mirror=next==='opampPlusTop';}
    document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    $('tool-hint').textContent = tool === 'select' ? 'Select · box → encloses · box ← touches · Shift adds' : tool === 'wire' ? 'Click a pin/wire to start · click for bends · double-click empty space or Enter to finish · Escape cancels' : tool === 'pan' ? 'Drag to pan the workspace' : tool === 'probe' ? 'Click a wire, pin or junction to place a voltage probe · Escape finishes' : `Place ${P[tool].name.toLowerCase()} · R rotates · Escape finishes`;
    svg.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'; requestRender();
  }
  function fit() {
    if (!model || !size.width) return;
    const d = model.document, points = [];
    for (const c of d.electrical.components) { const b = M.bounds(d, c); points.push({ x: b.x, y: b.y }, { x: b.right, y: b.bottom }); }
    for (const j of d.electrical.junctions) points.push(d.layout.junctions[j.id]);
    for (const probe of d.probes) if (d.layout.probes?.[probe.id]) points.push(M.probePoint(d, probe));
    for (const w of d.electrical.wires) points.push(...M.route(d, w));
    if (!points.length) { camera = { x: size.width / 2, y: size.height / 2, scale: 1 }; requestRender(); return; }
    const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
    const scale = Math.max(.2, Math.min(1.3, (size.width - 150) / (right - left + 50), (size.height - 150) / (bottom - top + 50)));
    camera = { scale, x: size.width / 2 - (left + right) / 2 * scale, y: size.height / 2 - (top + bottom) / 2 * scale }; requestRender();
  }
  function endpointPoint(target, d) { return target.kind === 'wire' ? target.point : M.pin(d, target); }
  function toggle(id) { model.transaction('Toggle switch', d => { const c = d.electrical.components.find(c => c.id === id); if (c.kind === 'switch') c.parameters.closed = !c.parameters.closed; else if (c.kind === 'logicInput') c.parameters.state = (c.parameters.state + 1) % (c.parameters.mode === 'ternary' ? 3 : 2); else c.parameters.position = (c.parameters.position + 1) % (c.kind === 'spdtSwitch' ? 3 : c.kind==='mbbSwitch'?4:2); }); }
  function commandSelection() {
    if (selection.size) return true;
    const found = M.hit(model.document, world(mouse), camera.scale);
    if (!found) return false;
    const kind = found.kind === 'pin' ? 'component' : found.kind, id = found.componentId || found.id || found.junctionId;
    selection.add(M.token(kind, id)); inspector(); controls(); return true;
  }
  function copyItems() {
    if (gesture || wireDraft) return false;
    if (!commandSelection()) return false;
    const fragment = M.copySelection(model.document, selection);
    if (!fragment.electrical.components.length && !fragment.electrical.wires.length && !fragment.electrical.junctions.length) { message('Select components or wires to copy. Probes copy with their targets.'); return false; }
    clipboard = fragment; message('Copied selection · Ctrl/⌘ V to paste within this editor.'); return true;
  }
  function pasteItems() {
    if (!clipboard || gesture || wireDraft) return;
    setTool('select'); const base = model.document, prior = new Set(selection), copied = M.pasteSelection(base, clipboard);
    const points = [...clipboard.electrical.components.map(c => clipboard.layout.components[c.id]), ...clipboard.electrical.junctions.map(j => clipboard.layout.junctions[j.id])];
    const anchor = { x: M.snap(Math.min(...points.map(p => p.x))), y: M.snap(Math.min(...points.map(p => p.y))) };
    selection.clear(); for (const key of copied) selection.add(key);
    gesture = { type: 'transform', paste: true, prior, base, startWorld: anchor, selection: copied, disconnect: false, rotation: 0, orientations: [], dx: 0, dy: 0 };
    updateTransform(world(mouse)); message('Paste · click to place · R rotates · Escape cancels'); svg.focus();
  }
  function updateTransform(p) {
    gesture.dx = M.snap(p.x - gesture.startWorld.x); gesture.dy = M.snap(p.y - gesture.startWorld.y);
    preview = clone(gesture.base);
    if (!gesture.disconnect && !gesture.paste) {
      gesture.dragSession ||= M.createDragSession(gesture.base, gesture.selection, gesture.routeHit ? {wireId:gesture.routeHit.id,segment:gesture.routeHit.segment} : {});
      preview=gesture.dragSession.update(gesture.dx,gesture.dy);
      if(gesture.rotation||gesture.orientations.length)M.transformSelection(preview,gesture.selection,0,0,{rotation:gesture.rotation,orientations:gesture.orientations});
    } else M.transformSelection(preview, gesture.selection, gesture.dx, gesture.dy, { disconnect: gesture.disconnect, rotation: gesture.rotation, orientations: gesture.orientations });
    requestRender();
  }
  function beginTransform(disconnect) {
    if (gesture || wireDraft) return;
    setTool('select'); if (!commandSelection()) return;
    gesture = { type: 'transform', base: model.document, startWorld: world(mouse), selection: new Set(selection), disconnect, rotation: 0, orientations: [], dx: 0, dy: 0 };
    const found = M.hit(model.document, world(mouse), camera.scale);
    if (!disconnect && selection.size === 1 && [...selection].every(k => JSON.parse(k)[0] === 'wire')) {
      const id = JSON.parse([...selection][0])[1]; gesture.routeHit = found?.kind === 'wire' && found.id === id ? found : { id, segment: 0 };
    }
    updateTransform(world(mouse)); message(`${disconnect ? 'Move · wires stay behind' : 'Drag · wires stay connected'} · click to place · R rotates · Escape cancels`);
  }
  function commitTransform() {
    const operation = gesture; gesture = null; preview = null;
    try {
      if (operation?.paste) {
        model.transaction('Paste selection', d => {
          const pasted = clone(operation.base); M.transformSelection(pasted, operation.selection, operation.dx, operation.dy, { rotation: operation.rotation, orientations: operation.orientations, contacts: true });
          Object.assign(d, pasted);
        });
      } else if (operation && (operation.dx || operation.dy || operation.rotation || operation.orientations?.length)) model.transaction(operation.disconnect ? 'Move selection' : 'Drag selection', d => {
        if(operation.dragSession){
          const next=operation.dragSession.finish({normalize:true,contacts:true,rotation:operation.rotation,orientations:operation.orientations});
          Object.assign(d,next);
        }else M.transformSelection(d, operation.selection, operation.dx, operation.dy, { disconnect: operation.disconnect, rotation: operation.rotation, orientations: operation.orientations, contacts: !!(operation.dx || operation.dy || operation.disconnect) });
      });
    } catch (error) { if (operation?.paste) { selection.clear(); for (const key of operation.prior) selection.add(key); } message(friendly(error)); }
    setTool('select'); inspector(); controls();
  }
  function rotate(amount = -90) {
    if (P[tool]) { rotation = (rotation + amount + 360) % 360; requestRender(); return; }
    if (gesture?.type === 'transform') {
      if (gesture.routeHit) return;
      gesture.dragSession?.cancel();delete gesture.dragSession;
      gesture.disconnect=true;gesture.orientations.push({rotate:amount});updateTransform(world(mouse));return;
    }
    if (!commandSelection()) return;
    try { model.transaction('Rotate selection', d => M.transformSelection(d, selection, 0, 0, { rotation: amount, contacts: true })); } catch (error) { message(friendly(error)); }
  }
  function flip(axis) {
    if (P[tool]) { const pose = { rotation, mirror }; M.flipPose(pose, axis); ({ rotation, mirror } = pose); requestRender(); return; }
    if (gesture?.type === 'transform') {
      if (gesture.routeHit) return;
      // Reorienting changes a connected Drag into a detached Move from its original
      // pick-up position, so temporary drag wires cannot survive the pose change.
      gesture.dragSession?.cancel();delete gesture.dragSession;
      gesture.disconnect=true;gesture.orientations.push({axis});updateTransform(world(mouse));return;
    }
    if (gesture || !commandSelection()) return;
    try { model.transaction(axis === 'x' ? 'Flip horizontally' : 'Flip vertically', d => M.transformSelection(d, selection, 0, 0, { orientations: [{ axis }] })); } catch (error) { message(friendly(error)); }
  }
  function target(hit) { return hit && ['pin', 'junction', 'wire'].includes(hit.kind) ? hit : null; }
  function finishWire(endpoint) {
    if (!wireDraft) return;
    const draft = wireDraft, end = endpoint || { kind: 'point', point: { x: M.snap(world(mouse).x), y: M.snap(world(mouse).y) } };
    const bends = clone(draft.bends);
    if (end.kind === 'point' && bends.length && bends.at(-1).x === end.point.x && bends.at(-1).y === end.point.y) bends.pop();
    try { model.connect(draft.from, end, bends); wireDraft = null; message(end.kind === 'point' ? 'Wire finished with a loose end.' : 'Wire connected. Crossings without a junction remain separate.'); }
    catch (error) { message(friendly(error)); wireDraft = null; }
    requestRender();
  }
  $('grid-mode').onchange = () => requestRender();
  function render() {
    if (!model) return; const d = preview || effectiveDocument(), frame = CircuitSimulation.presentationFrame(simState);
    const scale = camera.scale, grid = M.grid * scale;
    const gridMode = $('grid-mode').value;
    const parts = [`<defs><pattern id="dots" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse" x="${camera.x % grid}" y="${camera.y % grid}">${gridMode === 'lines' ? `<path d="M${grid} 0H0V${grid}" fill="none" stroke="#303c4c" stroke-width=".7"/>` : '<circle cx="0" cy="0" r="1" fill="#526174"/>'}</pattern></defs><rect width="100%" height="100%" fill="#11151c"/><rect width="100%" height="100%" fill="${gridMode === 'off' ? 'none' : 'url(#dots)'}"/><g transform="translate(${camera.x} ${camera.y}) scale(${scale})">`];
    let terminalValues = new Map();
    if (frame && compiled && compileDocument === JSON.stringify(d.electrical)) for (const net of compiled.nets) {
      const [id, p] = net.terminals[0], voltage = frame.pinVoltages[id]?.[p];
      for (const [cid, pid] of net.terminals) terminalValues.set(JSON.stringify(['pin', cid, pid]), voltage);
    }
    function voltage(ref) {
      if (ref.kind === 'pin') return terminalValues.get(JSON.stringify(['pin', ref.componentId, ref.pinId]));
      const visited = new Set(), queue = [ref];
      for (let i = 0; i < queue.length; i++) {
        const r = queue[i], k = M.referenceKey(r); if (visited.has(k)) continue; visited.add(k);
        if (r.kind === 'pin') return voltage(r);
        for (const w of d.electrical.wires) if (M.referenceKey(w.from) === k) queue.push(w.to); else if (M.referenceKey(w.to) === k) queue.push(w.from);
      }
    }
    const tint = v => !Number.isFinite(v) ? '#bbc9db' : Math.abs(v) < 1e-6 ? '#8f9fb3' : v > 0 ? '#91d6ba' : '#e8b17b';
    for (const w of d.electrical.wires) {
      const points = M.route(d, w), path = points.map(p => `${p.x},${p.y}`).join(' '), active = selected('wire', w.id);
      parts.push(`<polyline data-wire="${esc(w.id)}" points="${path}" fill="none" stroke="${active ? '#91e8c1' : tint(voltage(w.from))}" stroke-width="${active ? 3 : 2}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    for (const c of d.electrical.components) {
      const p = d.layout.components[c.id], active = selected('component', c.id), def = M.definitions[c.kind];
      if (active) { const b = M.bounds(d, c); parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.right - b.x}" height="${b.bottom - b.y}" rx="7" fill="#91e8c10b" stroke="#91e8c1" stroke-width="${1 / scale}" stroke-dasharray="4 3"/>`); }
      parts.push(`<g data-component="${esc(c.id)}" transform="translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.mirror ? -1 : 1} 1)" stroke="${active ? '#91e8c1' : '#e0e9f6'}" stroke-width="2" fill="#11151c" stroke-linecap="round" stroke-linejoin="round">${orientedSymbol(c, p, compileDocument === JSON.stringify(d.electrical) ? frame?.componentCurrents[c.id] : 0,compileDocument===JSON.stringify(d.electrical)?frame?.componentMeasurements?.[c.id]||{}:{})}</g>`);
      if(M.graphic(c.kind))continue;
      const vertical = isSource(c) ? p.rotation % 180 === 0 : p.rotation % 180 !== 0;
      const side = vertical || c.kind === 'ground';
      const railBelow = c.kind === 'voltageRail' && M.pin(d, { kind: 'pin', componentId: c.id, pinId: 'p' }).y >= p.y;
      const x = p.x + (side ? 31 : 0), y = p.y + (c.kind === 'ground' ? 5 : c.kind === 'voltageRail' && vertical ? (railBelow ? -38 : 9) : vertical ? -7 : c.kind === 'dpdtSwitch' ? -65 : ['transformer','tappedTransformer'].includes(c.kind) ? -65 : c.kind==='customTransformer'?-80 : c.kind === 'opamp' ? -44 : c.kind==='ledArray'?-180:['decimalDisplay','instructionDisplay'].includes(c.kind)?-78:chipKinds.includes(c.kind)?-chipHalf(c)-12:-23), anchor = side ? 'start' : 'middle';
      const w = c.parameters.waveform, lines = isSource(c) && w.kind !== 'dc' ? [format(w.amplitude, 'V') + ' pk', format(w.frequency, 'Hz'), format(w.offset, 'V') + ' offset'] : [value(c)];
      const live = compileDocument === JSON.stringify(d.electrical) ? frame?.pinVoltages[c.id] : null;
      const reading = outputReading(c,compileDocument===JSON.stringify(d.electrical)?frame?.componentMeasurements?.[c.id]:null) || (c.kind === 'output' && c.parameters.showVoltage && Number.isFinite(live?.in) ? format(live.in, 'V') : c.kind === 'logicOutput' && Number.isFinite(live?.in) ? `${logicLevel(c.parameters, live.in)} · ${format(live.in, 'V')}` : ['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind) && Number.isFinite(live?.Q) ? `Q ${live.Q >= c.parameters.highVoltage / 2 ? 'H' : 'L'} · ${format(live.Q, 'V')}` : null);
      if (reading) lines.push(reading);
      if (scale > .45) parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#d1dbea" font-family="system-ui,sans-serif" font-size="12">${esc(c.reference)}</text><text x="${x}" y="${vertical ? y + 18 : p.y + (['transformer','tappedTransformer'].includes(c.kind) ? 65 : c.kind==='customTransformer'?80 : c.kind === 'dpdtSwitch' ? 54 : c.kind === 'opamp' ? 47 : c.kind==='ledArray'?180:['decimalDisplay','instructionDisplay'].includes(c.kind)?82:chipKinds.includes(c.kind)?chipHalf(c)+18:31)}" text-anchor="${anchor}" fill="#8292a8" font-family="system-ui,sans-serif" font-size="11">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 15 : 0}">${esc(line)}</tspan>`).join('')}</text>`);
      for (const pinId of Object.keys(def.pins)) {
        const ref = { kind: 'pin', componentId: c.id, pinId }, point = M.pin(d, ref);
        parts.push(`<circle data-pin="${esc(c.id + ':' + pinId)}" cx="${point.x}" cy="${point.y}" r="3" fill="transparent" stroke="none" pointer-events="none"/>`);
      }
    }
    for (const dot of M.junctionDots(d)) parts.push(`<circle data-connection-dot cx="${dot.point.x}" cy="${dot.point.y}" r="3.5" fill="#c5dfd5"/>`);
    for (const j of d.electrical.junctions) if (d.electrical.wires.filter(w => w.from.junctionId === j.id || w.to.junctionId === j.id).length === 1) {
      const p = d.layout.junctions[j.id]; parts.push(`<rect data-loose-end="${esc(j.id)}" x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" fill="#11151c" stroke="#bbc9db"/>`);
    }
    for (const j of d.electrical.junctions) if (selected('junction', j.id)) {
      const p = d.layout.junctions[j.id]; parts.push(`<rect data-junction="${esc(j.id)}" x="${p.x - 6}" y="${p.y - 6}" width="12" height="12" fill="none" stroke="#91e8c1"/>`);
    }
    for (const probe of d.probes) if (probe.kind === 'voltage' && d.layout.probes?.[probe.id]) {
      const anchor = M.pin(d, probe.positive), label = M.probePoint(d, probe), active = selected('probe', probe.id);
      const color = CircuitScopeModel.color(probe.id), reading = M.probeVoltage(d, probe, compileDocument === JSON.stringify(d.electrical) ? frame : null);
      parts.push(`<g data-probe="${esc(probe.id)}"><path d="M${anchor.x} ${anchor.y}L${label.x} ${label.y + 4}" stroke="${color}" fill="none"/><circle cx="${anchor.x}" cy="${anchor.y}" r="3" fill="${color}"/><rect x="${label.x - 5}" y="${label.y - 14}" width="135" height="28" rx="4" fill="#25271f" stroke="${active ? '#91e8c1' : color}"/><text x="${label.x}" y="${label.y + 4}" fill="${color}" font-size="12" font-family="system-ui,sans-serif">${esc(probe.label || 'V')} · ${esc(format(reading, 'V'))}</text></g>`);
    }
    if (target(hover)) {
      const p = endpointPoint(hover, d); parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${10 / scale}" stroke="#91e8c1" stroke-width="${1 / scale}" fill="#91e8c11a"/>`);
    }
    if (P[tool]) {
      const p = M.placementPose(tool, world(mouse), rotation, mirror), ghost = { kind: P[tool].kind || tool, parameters: P[tool].parameters };
      parts.push(`<g transform="translate(${p.x} ${p.y}) rotate(${rotation}) scale(${mirror ? -1 : 1} 1)" stroke="#91e8c1" stroke-width="2" fill="none" opacity=".5" pointer-events="none">${orientedSymbol(ghost,{rotation,mirror})}</g>`);
    }
    if (wireDraft) {
      const start = endpointPoint(wireDraft.from, d), end = target(hover) ? endpointPoint(hover, d) : { x: M.snap(world(mouse).x), y: M.snap(world(mouse).y) };
      const anchors = [start, ...wireDraft.bends, end], points = [start];
      for (const p of anchors.slice(1)) { const last = points.at(-1); if (last.x !== p.x && last.y !== p.y) points.push({ x: p.x, y: last.y }); points.push(p); }
      parts.push(`<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="#91e8c1" stroke-width="2" fill="none" stroke-dasharray="5 4"/>`);
    }
    if (gesture?.type === 'marquee') {
      const a = gesture.startWorld, b = world(mouse); parts.push(`<rect x="${Math.min(a.x, b.x)}" y="${Math.min(a.y, b.y)}" width="${Math.abs(a.x - b.x)}" height="${Math.abs(a.y - b.y)}" fill="${b.x < a.x ? '#91e8c118' : '#8abfff10'}" stroke="${b.x < a.x ? '#91e8c1' : '#8abfff'}" stroke-dasharray="${b.x < a.x ? '5 3' : 'none'}" stroke-width="${1 / scale}"/>`);
    }
    parts.push('</g>'); svg.innerHTML = parts.join('');
    $('zoom-value').textContent = Math.round(camera.scale * 100) + '%'; $('empty-hint').hidden = d.electrical.components.length > 0;
    $('counts').textContent = `${d.electrical.components.length} parts · ${d.electrical.wires.filter(w => M.route(d, w).length > 1).length} wires`;
  }
  function selectHit(found, add) {
    const key = M.token(found.kind, found.id || found.junctionId);
    if (add) { if (selection.has(key)) selection.delete(key); else selection.add(key); }
    else if (!selection.has(key)) { selection.clear(); selection.add(key); }
    inspector(); controls(); requestRender(); return selection.has(key);
  }
  svg.addEventListener('pointerdown', event => {
    if (!ready || event.button === 2 || pressedPush) return;
    event.preventDefault(); svg.focus(); mouse = local(event); const p = world(mouse), d = model.document, found = M.hit(d, p, camera.scale);
    if (gesture?.type === 'transform') { if (event.button === 0) commitTransform(); return; }
    if (event.button === 1 || space || tool === 'pan') {
      gesture = { type: 'pan', start: mouse, camera: { ...camera } }; svg.setPointerCapture(event.pointerId); svg.style.cursor = 'grabbing'; return;
    }
    if (event.button !== 0) return;
    if (P[tool]) { try { const id = model.addComponent(tool, p.x, p.y, rotation, mirror); selection.clear(); selection.add(M.token('component', id)); inspector(); controls(); requestRender(); } catch (error) { message(friendly(error)); } return; }
    if(tool==='select'&&found?.kind==='component'&&d.electrical.components.find(c=>c.id===found.id)?.kind==='pushSwitch'&&!event.shiftKey){selectHit(found,false);pressedPush={id:found.id,pointerId:event.pointerId};svg.setPointerCapture(event.pointerId);void sync(M.momentaryDocument(model.document,found.id),'Push switch pressed');requestRender();return;}
    if (tool === 'probe') { const endpoint = target(found); if (endpoint) { try { const id = model.addProbe(endpoint); selection.clear(); selection.add(M.token('probe', id)); inspector(); controls(); } catch (error) { message(friendly(error)); } } else message('Place the voltage probe on a wire, pin or junction.'); requestRender(); return; }
    if (tool === 'wire' || wireDraft || found?.kind === 'pin') {
      const endpoint = target(found);
      if (!wireDraft) { if (endpoint) wireDraft = { from: clone(endpoint), bends: [] }; else message('Start a wire on a pin, junction or existing wire.'); }
      else if (endpoint) finishWire(endpoint);
      else {
        const now = performance.now(), last = wireDraft.lastClick;
        if (last && now - last.time < 450 && Math.hypot(mouse.x - last.x, mouse.y - last.y) < 8) finishWire();
        else { wireDraft.bends.push({ x: M.snap(p.x), y: M.snap(p.y) }); wireDraft.lastClick = { ...mouse, time: now }; }
      }
      requestRender(); return;
    }
    if (found) {
      const collapse = !event.shiftKey && selection.size > 1 && selected(found.kind, found.id || found.junctionId);
      if (!selectHit(found, event.shiftKey)) return;
      gesture = { type: found.kind === 'junction' && selection.size === 1 && M.looseEndpoint(d, found.junctionId) ? 'wire-end' : found.kind === 'wire' ? 'wire-route' : 'move', base: d, startWorld: p, hit: found, dx: 0, dy: 0, collapse };
      gesture.dragSession=M.createDragSession(d,gesture.type==='wire-end'?new Set([M.token('junction',found.junctionId)]):selection,gesture.type==='wire-route'?{wireId:found.id,segment:found.segment}:{});
    } else {
      const prior = event.shiftKey ? new Set(selection) : new Set(); if (!event.shiftKey) selection.clear();
      gesture = { type: 'marquee', startWorld: p, prior }; inspector(); controls();
    }
    svg.setPointerCapture(event.pointerId); requestRender();
  });
  svg.addEventListener('pointermove', event => {
    if (!ready) return; mouse = local(event); if(pressedPush)return;const p = world(mouse);
    if (gesture?.type === 'transform') { updateTransform(p); return; }
    if (gesture?.type === 'pan') { camera.x = gesture.camera.x + mouse.x - gesture.start.x; camera.y = gesture.camera.y + mouse.y - gesture.start.y; }
    else if (gesture && ['move', 'wire-route', 'wire-end'].includes(gesture.type)) {
      const dx = M.snap(p.x - gesture.startWorld.x), dy = M.snap(p.y - gesture.startWorld.y);
      if (dx || dy) cancelBodyClick();
      gesture.dx = dx; gesture.dy = dy; preview = clone(gesture.base);
      if (gesture.type === 'wire-end') {
        gesture.target = M.reconnectTarget(gesture.base, gesture.hit.junctionId, p, camera.scale);
        const dest = gesture.target ? endpointPoint(gesture.target, gesture.base) : { x: M.snap(p.x), y: M.snap(p.y) }, origin = gesture.base.layout.junctions[gesture.hit.junctionId];
        preview=gesture.dragSession.update(dest.x-origin.x,dest.y-origin.y);
      } else preview=gesture.dragSession.update(dx,dy);
    }
    hover = gesture?.type === 'wire-end' ? gesture.target : gesture ? null : M.hit(model.document, p, camera.scale); requestRender();
  });
  svg.addEventListener('dblclick',event=>{const found=M.hit(model.document,world(local(event)),camera.scale);if(found?.kind==='component'&&model.document.electrical.components.find(c=>c.id===found.id)?.kind==='pushSwitch'){event.preventDefault();editComponent(found.id);}});
  svg.addEventListener('lostpointercapture',event=>{if(pressedPush?.pointerId===event.pointerId)releasePush();});
  svg.addEventListener('pointerup', event => {
    if(pressedPush){if(event.pointerId!==pressedPush.pointerId)return;releasePush();if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);return;}
    if (gesture?.type === 'transform') return;
    const operation = gesture; gesture = null; preview = null;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    svg.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
    if (operation?.collapse && !operation.dx && !operation.dy) {
      selection.clear(); selection.add(M.token(operation.hit.kind, operation.hit.id || operation.hit.junctionId)); inspector(); controls();
    }
    // Resolve click versus drag on release: clicking starts a fresh route,
    // while moving the same endpoint retains the reconnect gesture.
    if (operation?.type === 'wire-end' && !operation.dx && !operation.dy && !event.shiftKey) {
      wireDraft = { from: clone(operation.hit), bends: [] };
      message('Click to add wire bends or connect · Enter finishes · Escape cancels');
    }
    try {
      if (operation?.type === 'wire-end' && (operation.dx || operation.dy)) model.transaction('Reconnect wire end', d => {
        Object.assign(d,operation.dragSession.finish({normalize:false}));
        if (operation.target) M.reconnect(d, operation.hit.junctionId, operation.target);
      });
      if (operation?.type === 'move' && (operation.dx || operation.dy)) model.transaction('Drag selection', d => {
        Object.assign(d,operation.dragSession.finish({normalize:true}));
        M.connectContacts(d, new Set(d.electrical.components.filter(c => selected('component', c.id)).map(c => c.id)));
      });
    } catch (error) { message(friendly(error)); }
    if (operation?.type === 'wire-route' && (operation.dx || operation.dy)) model.transaction('Reroute wire', d => Object.assign(d,operation.dragSession.finish({normalize:true})));
    if (operation?.type === 'move' && !operation.dx && !operation.dy && operation.hit.kind === 'component' && !event.shiftKey) {
      const now = performance.now(), point = local(event), id = operation.hit.id;
      if (lastBodyClick?.id === id && now - lastBodyClick.time < 450 && Math.hypot(point.x - lastBodyClick.x, point.y - lastBodyClick.y) < 8) {
        cancelBodyClick(); editComponent(id);
      } else {
        cancelBodyClick(); lastBodyClick = { id, time: now, ...point };
        if (['switch', 'spdtSwitch', 'dpdtSwitch', 'mbbSwitch', 'logicInput'].includes(model.document.electrical.components.find(c => c.id === id)?.kind)) lastBodyClick.timer = setTimeout(() => {
          lastBodyClick = null; if (model.document.electrical.components.some(c => c.id === id)) toggle(id);
        }, 450);
      }
    } else cancelBodyClick();
    if (operation?.type === 'marquee') {
      const picked = M.boxSelection(model.document, operation.startWorld, world(local(event)));
      selection.clear(); for (const key of operation.prior) selection.add(key); for (const key of picked) selection.add(key);
      inspector(); controls();
    }
    requestRender();
  });
  svg.addEventListener('pointercancel', () => { cancelGesture(); inspector(); controls(); requestRender(); });
  svg.addEventListener('wheel', event => {
    event.preventDefault(); if (gesture && gesture.type !== 'pan') return;
    if (event.ctrlKey || event.metaKey) camera = M.zoom(camera, local(event), Math.exp(-event.deltaY * .008));
    else { camera.x -= event.deltaX; camera.y -= event.deltaY; }
    requestRender();
  }, { passive: false });
  svg.addEventListener('contextmenu', event => event.preventDefault());
  function save() {
    const d = model.document, url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = (d.title || 'circuit').replace(/[^\w -]/g, '').trim() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Circuit JSON saved.');
  }
  $('save').onclick = save; $('open').onclick = () => $('file').click();
  $('file').onchange = async () => { try { const file = $('file').files[0]; if (!file) return; model.replace(JSON.parse(await file.text())); selection.clear(); inspector(); setTool('select'); fit(); } catch (error) { message(friendly(error)); } finally { $('file').value = ''; } };
  $('new').onclick = () => { selection.clear(); model.replace(M.empty()); setTool('select'); fit(); };
  $('undo').onclick = () => { setTool('select'); model.undo(); }; $('redo').onclick = () => { setTool('select'); model.redo(); };
  $('copy').onclick = copyItems; $('paste').onclick = pasteItems; $('duplicate').onclick = () => { if (copyItems()) pasteItems(); };
  $('move').onclick = () => beginTransform(true); $('drag').onclick = () => beginTransform(false);
  $('flip-horizontal').onclick = () => flip('x'); $('flip-vertical').onclick = () => flip('y');
  $('delete').onclick = () => { setTool('select'); model.remove(selection); }; $('rotate').onclick = () => rotate();
  $('zoom-in').onclick = () => { camera = M.zoom(camera, { x: size.width / 2, y: size.height / 2 }, 1.2); requestRender(); };
  $('zoom-out').onclick = () => { camera = M.zoom(camera, { x: size.width / 2, y: size.height / 2 }, 1 / 1.2); requestRender(); }; $('fit').onclick = fit;
  document.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => setTool(button.dataset.tool));
  async function act(action) { try { await action(); } catch (error) { message(friendly(error)); } }
  $('run').onclick = toggleRun;
  $('step').onclick = () => act(() => simulation.step(10)); $('reset').onclick = () => act(async () => { await simulation.reset(); await simulation.step(1); });
  document.addEventListener('keydown', event => {
    if (chooser.open || propertyDialog.open) return;
    if (!ready || event.target.matches('input,textarea,select') || event.target.isContentEditable) return;
    const key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
    if (command && key === 's') { event.preventDefault(); save(); return; }
    if (command && key === 'o') { event.preventDefault(); $('file').click(); return; }
    if (command && key === 'z') { event.preventDefault(); setTool('select'); event.shiftKey ? model.redo() : model.undo(); return; }
    if (command && ['c', 'v', 'd'].includes(key)) { event.preventDefault(); if (key === 'c') copyItems(); else if (key === 'v') pasteItems(); else if (copyItems()) pasteItems(); return; }
    if (command) return;
    if (key === ' ') { event.preventDefault(); space = true; svg.style.cursor = 'grab'; return; }
    if (key === 'escape') { setTool('select'); inspector(); controls(); return; }
    if (key === 'enter' && wireDraft) { event.preventDefault(); finishWire(target(M.hit(model.document, world(mouse), camera.scale))); return; }
    if (key === 'delete' || key === 'backspace') { event.preventDefault(); if (gesture) return; if (commandSelection()) model.remove(selection); return; }
    if (event.repeat) return;
    if (key === 'a') { event.preventDefault(); addComponent(); return; }
    if (key === 'm' || key === 'g') { event.preventDefault(); beginTransform(key === 'm'); return; }
    if (key === 'r') { if (gesture && gesture.type !== 'transform') return; event.preventDefault(); rotate(event.shiftKey ? 90 : -90); return; }
    if (key === 'x' || key === 'y') { event.preventDefault(); flip(key); return; }
    if (gesture) return;
    if (key === 'e') { event.preventDefault(); editComponent(); return; }
    if (key === 'p') { event.preventDefault(); setTool('ground'); return; }
    if (key === '0') { fit(); return; }
    if (key === '+' || key === '=' || key === '-') { camera = M.zoom(camera, { x: size.width / 2, y: size.height / 2 }, key === '-' ? 1 / 1.2 : 1.2); requestRender(); return; }
    if (key === '1') { setTool('select'); return; }
    if (key === 'w' || key === 'h') { setTool(key === 'w' ? 'wire' : 'pan'); return; }

  });
  window.addEventListener('keyup', event => { if (event.key === ' ') { space = false; svg.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'; } });
  window.addEventListener('blur', () => { space = false; cancelGesture(); cancelBodyClick(); inspector(); controls(); requestRender(); });
  window.addEventListener('pagehide', () => simulation.dispose());
  new ResizeObserver(() => {
    const rect = surface.getBoundingClientRect(), previous = size; size = { width: rect.width, height: rect.height };
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    if (!previous.width && model) fit(); else { camera.x += (size.width - previous.width) / 2; camera.y += (size.height - previous.height) / 2; requestRender(); }
  }).observe(surface);
  try {
    let initial;
    try { const stored = localStorage.getItem('circuit-editor-prototype.v1'); if (stored) initial = M.validate(JSON.parse(stored)); } catch { }
    if (!initial) {
      const response = await fetch('examples/switched-rc.json'); if (!response.ok) throw new Error('Example circuit unavailable'); initial = await response.json();
      initial.layout.components = { v1: { x: 160, y: 240, rotation: 0, mirror: false }, r1: { x: 304, y: 192, rotation: 0, mirror: false }, s1: { x: 464, y: 192, rotation: 0, mirror: false }, c1: { x: 608, y: 272, rotation: 90, mirror: false }, r2: { x: 752, y: 272, rotation: 90, mirror: false }, g1: { x: 304, y: 400, rotation: 0, mirror: false } };
      initial.layout.wires.w3.bends = [{ x: 608, y: 192 }]; initial.layout.wires.w6.bends = [{ x: 304, y: 320 }]; initial.layout.wires.w7.bends = [{ x: 160, y: 376 }];
    }
    model = M.create(initial, changed, {wireSections:true}); ready = true; setTool('select'); changed(model.document); fit(); inspector(); controls(); requestRender();
    document.body.dataset.status = 'ready';
  } catch (error) { message(friendly(error)); document.body.dataset.status = 'failed'; simulation.dispose(); }
})();
