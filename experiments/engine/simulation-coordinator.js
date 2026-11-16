'use strict';
// Compatibility adapter for the prototype. New frontends use @circuitjs/core.
(() => {
  const core=typeof module==='object'&&module.exports?require('../../packages/circuit-core/index.js'):globalThis.CircuitCore;
  if(!core)throw new Error('Load circuit-core before the prototype adapters');
  const api=Object.freeze({...core.simulation,create:(options={})=>core.simulation.create({...options,workerFactory:options.workerFactory||((settings)=>globalThis.createRevisionWorker(settings))})});
  globalThis.CircuitSimulation=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
