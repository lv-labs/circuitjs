'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const geometry=typeof module==='object'&&module.exports?require('./geometry.js'):registry.geometry;
  const document=typeof module==='object'&&module.exports?require('./document.js'):registry.document;
  const history=typeof module==='object'&&module.exports?require('./history.js'):registry.history;
  const drag=typeof module==='object'&&module.exports?require('./drag.js'):registry.drag;
  const commands=typeof module==='object'&&module.exports?require('./commands.js'):registry.commands;
  const adapter=typeof module==='object'&&module.exports?require('./adapter.js'):registry.adapter;
  const protocol=typeof module==='object'&&module.exports?require('./protocol.js'):registry.protocol;
  const simulation=typeof module==='object'&&module.exports?require('./simulation.js'):registry.simulation;
  const signals=typeof module==='object'&&module.exports?require('./signals.js'):registry.signals;
  const browserTransport=typeof module==='object'&&module.exports?require('./browser-transport.js'):registry.browser_transport;
  const api=Object.freeze({version:1,catalog,geometry,document,history,editing:commands,adapter,protocol,simulation,signals,browserTransport});
  globalThis.CircuitCore=api;

  registry.index=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
