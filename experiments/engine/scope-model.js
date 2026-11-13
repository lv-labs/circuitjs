'use strict';
(() => {
  const descriptors=channels=>CircuitDocumentAdapter.normalizeSampleChannels(channels.map(({id,positive,negative})=>({id,positive,negative})));
  const key=channels=>JSON.stringify(descriptors(channels));
  function color(id){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `hsl(${(hash>>>0)%360} 72% 72%)`;}
  function create({capacity=20000}={}) {
    if(!Number.isInteger(capacity)||capacity<2||capacity>100000)throw new Error('Invalid scope capacity');
    let channels=[],signature='[]',expected,identity=null,sequence=0,revision=0,lastTime=-Infinity,start=0,length=0;
    const times=new Float64Array(capacity);let values=[];
    function clear(){start=0;length=0;}
    function reset(){clear();identity=null;sequence=0;revision=0;lastTime=-Infinity;}
    function setChannels(next){
      const signatureNext=key(next),labels=new Map(next.map(c=>[c.id,c.label]));
      channels=descriptors(next).map(c=>({...c,label:labels.get(c.id)||c.id,color:color(c.id)}));
      if(signature!==signatureNext){signature=signatureNext;values=channels.map(()=>new Float64Array(capacity));reset();}
      return descriptors(channels);
    }
    function expect(next){
      if(next===null){expected=null;reset();return;}
      const id=JSON.stringify([next.sessionId,next.documentId,next.runEpoch]);
      if(identity!==null&&identity!==id)reset();expected={...next};
    }
    function append(frame){
      if(expected===null||(expected&&['sessionId','documentId','runEpoch','circuitRevision'].some(k=>expected[k]!==frame?.[k])))return false;
      const batch=frame?.sampleBatch;if(!batch||!channels.length)return false;
      try{if(key(batch.channels)!==signature)return false;}catch{return false;}
      if(!Number.isSafeInteger(frame.frameSequence)||frame.frameSequence<1||!Number.isSafeInteger(frame.circuitRevision)||frame.circuitRevision<1||
        !Number.isSafeInteger(frame.runEpoch)||frame.runEpoch<1||typeof frame.sessionId!=='string'||typeof frame.documentId!=='string')return false;
      const nextIdentity=JSON.stringify([frame.sessionId,frame.documentId,frame.runEpoch]);
      if(identity===nextIdentity&&(frame.frameSequence<=sequence||frame.circuitRevision<revision))return false;
      const ts=batch.times,vs=channels.map(c=>batch.values?.[c.id]);
      if(!Array.isArray(ts)||!ts.length||ts.length>10000||vs.some(v=>!Array.isArray(v)||v.length!==ts.length))return false;
      for(let i=0;i<ts.length;i++)if(!Number.isFinite(ts[i])||ts[i]<0||(i&&ts[i]<=ts[i-1])||vs.some(v=>!Number.isFinite(v[i])))return false;
      if(identity===nextIdentity&&ts[0]<=lastTime)return false;
      if(identity!==nextIdentity){reset();identity=nextIdentity;}
      for(let i=0;i<ts.length;i++){
        const index=(start+length)%capacity;times[index]=ts[i];values.forEach((v,j)=>v[index]=vs[j][i]);
        if(length<capacity)length++;else start=(start+1)%capacity;
      }
      sequence=frame.frameSequence;revision=frame.circuitRevision;lastTime=ts.at(-1);return true;
    }
    function window(span){
      const end=length?Math.max(span,times[(start+length-1)%capacity]):span,begin=Math.max(0,end-span),indices=[];
      for(let i=0;i<length;i++){const index=(start+i)%capacity;if(times[index]>=begin)indices.push(index);}
      const ts=indices.map(i=>times[i]);
      return {start:begin,end,stored:length,capacity,times:ts,channels:channels.map((c,j)=>{
        const ys=indices.map(i=>values[j][i]);let min=Infinity,max=-Infinity;for(const y of ys){min=Math.min(min,y);max=Math.max(max,y);}
        return {...c,values:ys,min:ys.length?min:null,max:ys.length?max:null,last:ys.at(-1)};
      })};
    }
    return {setChannels,expect,append,clear,reset,window,get count(){return length;},get signature(){return signature;}};
  }
  // Preserve first/last and min/max within each screen column, never average away peaks.
  function envelope(times,values,start,end,width){
    if(times.length<=width*2)return times.map((t,i)=>[t,values[i]]);
    const output=[];let bucket=-1,indices=[];
    function flush(){if(!indices.length)return;let min=indices[0],max=min;for(const i of indices){if(values[i]<values[min])min=i;if(values[i]>values[max])max=i;}
      for(const i of [...new Set([indices[0],min,max,indices.at(-1)])].sort((a,b)=>a-b))output.push([times[i],values[i]]);}
    for(let i=0;i<times.length;i++){const next=Math.floor((times[i]-start)/(end-start)*width);if(next!==bucket){flush();indices=[];bucket=next;}indices.push(i);}flush();return output;
  }
  function autoScale(channels){let max=.001;for(const c of channels)if(c.min!==null){max=Math.max(max,Math.abs(c.min),Math.abs(c.max));}
    const target=max/3.5,power=10**Math.floor(Math.log10(target)),step=[1,2,5,10].find(n=>n*power>=target);return step*power;}
  globalThis.CircuitScopeModel=Object.freeze({create,color,envelope,autoScale,descriptors});
})();
