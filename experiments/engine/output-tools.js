'use strict';
(() => {
  function validate(capture){if(!capture||!Array.isArray(capture.values)||capture.values.length>1000000||!capture.values.every(Number.isFinite)||!Number.isFinite(capture.timeStep)||capture.timeStep<=0||!Number.isFinite(capture.startTime))throw new Error('Invalid capture');}
  function csv(capture){validate(capture);return 'time_s,voltage_V\n'+capture.values.map((v,i)=>String(capture.startTime+i*capture.timeStep)+','+String(v)).join('\n')+'\n';}
  function normalized(values){if(!values.length)return new Float32Array();let scale=0;for(const v of values)scale=Math.max(scale,Math.abs(v));if(!scale)return new Float32Array(values.length);const mean=values.reduce((sum,v)=>sum+v/scale/values.length,0);let peak=0;for(const v of values)peak=Math.max(peak,Math.abs(v/scale-mean));return Float32Array.from(values,v=>peak?(v/scale-mean)/peak*.2:0);}
  function wav(capture){
    validate(capture);const rate=Math.round(1/capture.timeStep),values=normalized(capture.values),buffer=new ArrayBuffer(44+values.length*2),view=new DataView(buffer);
    const text=(offset,string)=>{for(let i=0;i<string.length;i++)view.setUint8(offset+i,string.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,36+values.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,values.length*2,true);
    values.forEach((v,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,v))*(v<0?32768:32767)),true));return buffer;
  }
  globalThis.CircuitOutputTools={csv,wav,normalized};
})();
