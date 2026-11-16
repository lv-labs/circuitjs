'use strict';
let session;
self.onmessage = ({data}) => {
  const id = data && data.id;
  try {
    if (!Number.isSafeInteger(id) || !data || !Array.isArray(data.args)) throw new Error('Invalid request');
    if (!['loadDocument', 'step', 'snapshot', 'reset', 'readCapture', 'setVariableVoltage', 'setContact', 'updateProjection'].includes(data.method)) throw new Error('Unknown document operation');
    if (!session) throw new Error('Document engine is not ready');
    self.postMessage({id, ok: true, result: session[data.method](...data.args)});
  } catch (error) {
    self.postMessage({id, ok: false, error: {code: error.code || 'INVALID_OPERATION', message: String(error.message || error)}});
  }
};
self.oncircuitengineready = engine => {
  session = CircuitDocumentAdapter.createSession(engine);
  self.postMessage({type: 'ready', documentAdapterVersion: 1,
    models: ['variableVoltage@1', 'lamp@1', 'text@1', 'box@1', 'line@1', 'labeledNode@1', 'voltmeter@1', 'ohmmeter@1', 'ammeter@1', 'wattmeter@1', 'testPoint@1', 'decimalDisplay@1', 'instructionDisplay@1', 'ledArray@1', 'dataExport@1', 'audioOutput@1', 'stopTrigger@1', 'dcMotor@1', 'threePhaseMotor@1', 'pushSwitch@1', 'mbbSwitch@1', 'tappedTransformer@1', 'customTransformer@1', 'transmissionLine@1', 'counter@1', 'latch@1', 'halfAdder@1', 'fullAdder@1', 'output@1', 'logicOutput@1', 'logicInput@1', 'dFlipFlop@1', 'jkFlipFlop@1', 'tFlipFlop@1', 'polarizedCapacitor@1', 'analogSwitch@1', 'analogSpdtSwitch@1', 'resistor@1', 'transformer@1', 'spdtSwitch@1', 'dpdtSwitch@1', 'led@1', 'zener@1', 'npn@1', 'pnp@1', 'nmos@1', 'pmos@1', 'njfet@1', 'pjfet@1', 'andGate@1', 'nandGate@1', 'orGate@1', 'norGate@1', 'xorGate@1', 'inverter@1', 'inductor@1', 'diode@1', 'currentSource@1', 'potentiometer@1', 'capacitor@1', 'switch@1', 'voltageSource:dc@1', 'voltageSource:periodic@1', 'voltageRail@1', 'opamp@1', 'ground@1'],
    perStepSamples: true, maxSampleChannels: 32, dedicatedWorker: self instanceof DedicatedWorkerGlobalScope,
    hasDocument: typeof document !== 'undefined', hasWindow: typeof window !== 'undefined'});
};
try {
  importScripts('core/catalog.js','core/adapter.js','core/worker-api.js','document-adapter.js', 'circuitjsworker/engine-worker.js');
} catch (error) {
  self.postMessage({type: 'fatal', error: {message: String(error.stack || error)}});
}
