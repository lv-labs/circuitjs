'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const clone=value=>structuredClone(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function create(initial,onChange=()=>{},{prepare=value=>value}={}) {
    let document=prepare(clone(initial));
    let undo = [], redo = [];
    function transaction(label, change) {
      const next = clone(document); if (change(next) === false || same(next, document)) return false;
      prepare(next); undo.push({ label, document }); undo = undo.slice(-100); redo = []; document = next; onChange(clone(document), label); return true;
    }
    function history(from, to) {
      if (!from.length) return false; const item = from.pop(); to.push({ label: item.label, document }); document = item.document;
      onChange(clone(document), item.label); return true;
    }
    return {get document(){return clone(document);},get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;},transaction,undo:()=>history(undo,redo),redo:()=>history(redo,undo)};
  }
  const api=Object.freeze({create});

  registry.history=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
