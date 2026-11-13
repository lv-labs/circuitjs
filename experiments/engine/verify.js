/* Browser checks for the extraction spike, including optional unchanged-app comparison. */
'use strict';
const report = {status: 'running', checks: [], traces: {}};
report.referenceTraces = {};
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}
function rejects(action, message) {
  let threw = false;
  try { action(); } catch (_) { threw = true; }
  assert(threw, message);
}
function compareTrace(actual, reference) {
  assert(actual.length === reference.length, 'Same number of samples');
  for (let s = 0; s < actual.length; s++) {
    near(actual[s].time, reference[s].time, 1e-12, 'Baseline sample time');
    assert(actual[s].elements.length === reference[s].elements.length, 'Same number of elements');
    actual[s].elements.forEach((elm, i) => {
      near(elm.current, reference[s].elements[i].current, 1e-12, 'Baseline current');
      assert(elm.voltages.length === reference[s].elements[i].voltages.length, 'Same number of pins');
      elm.voltages.forEach((v, pin) => near(v, reference[s].elements[i].voltages[pin], 1e-12,
        'Baseline pin voltage'));
    });
  }
}
function finish(status, error) {
  report.status = status;
  if (error) report.error = String(error.stack || error);
  document.body.dataset.status = status;
  document.getElementById('result').textContent = JSON.stringify(report, null, 2);
}
window.onerror = (_message, _source, _line, _column, error) => finish('failed', error || _message);
window.oncircuitengineready = async engine => {
  try {
    if (new URLSearchParams(location.search).has('capture')) {
      const api = await loadBaseline();
      for (const [name, fixture] of Object.entries(engineCases))
        report.referenceTraces[name] = await baselineTrace(api, fixture);
      finish('passed');
      return;
    }
    assert(engine.snapshot().editorFree, 'Editor managers must not be constructed');
    assert(!document.querySelector('canvas, input, button, .gwt-MenuBar'), 'No editor widgets');
    rejects(() => engine.step(1), 'Stepping before load must fail');
    report.checks.push('No editor managers/widgets; stepping before load rejected');

    for (const [name, fixture] of Object.entries(engineCases)) {
      const {text} = fixture;
      const initial = engine.load(text, dt);
      near(initial.time, 0, 0, 'Load starts at zero');
      assert(initial.error === null && initial.editorFree, 'Engine must be ready without editor');
      const samples = [];
      let previous = 0;
      for (const step of fixture.samples || sampleSteps) {
        const snapshot = engine.step(step - previous);
        near(snapshot.time, step * dt, 1e-12, 'Exact number of steps');
        for (const elm of snapshot.elements) {
          assert(Number.isFinite(elm.current) && elm.voltages.every(Number.isFinite), 'Finite results');
        }
        if (name === 'divider') {
          near(snapshot.elements[2].voltages[0], 2.5, 1e-12, 'Divider voltage');
          near(snapshot.elements[1].current, 0.0025, 1e-12, 'Divider current');
          near(snapshot.elements[3].voltages[0], snapshot.elements[3].voltages[1], 1e-12, 'Wire closure');
        } else if (name === 'rcEuler') {
          const expected = 5 * (1 - Math.pow(1 + dt / 0.001, -step));
          near(snapshot.elements[2].voltages[0], expected, 1e-10, 'Backward Euler RC recurrence');
          near(snapshot.elements[2].voltages[0], 5 * (1 - Math.exp(-snapshot.time / 0.001)), 0.01,
            'RC continuous solution within timestep error');
        } else if (name === 'rlc') {
          const t = snapshot.time, alpha = 500, omega = Math.sqrt(1e7 - alpha * alpha);
          const expected = 5 * (1 - Math.exp(-alpha * t) * (Math.cos(omega * t) + alpha / omega * Math.sin(omega * t)));
          near(snapshot.elements[3].voltages[0], expected, 0.1, 'RLC damped step response within timestep error');
          if (step === 100) assert(snapshot.elements[3].voltages[0] > 7, 'Underdamped RLC overshoot');
        } else if (name === 'rectifier') {
          const output = snapshot.elements[2].voltages[0];
          if (step === 100 || step === 600) assert(output > 3.5, 'Diode passes positive half-cycle');
          if (step === 400 || step === 900) near(output, 0, 0.001, 'Diode blocks negative half-cycle');
        } else if (name === 'switchedRC') {
          const q = 1 / (1 + dt / ((1000 * 10000 / 11000) * 1e-6));
          const equilibrium = 5 * 10000 / 11000;
          const v100 = equilibrium * (1 - Math.pow(q, 100));
          const openQ = 1 / (1 + dt / 0.01);
          const v500 = v100 * Math.pow(openQ, 400);
          const expected = step <= 100 ? equilibrium * (1 - Math.pow(q, step)) :
            step <= 500 ? v100 * Math.pow(openQ, step - 100) :
            equilibrium + (v500 - equilibrium) * Math.pow(q, step - 500);
          near(snapshot.elements[3].voltages[0], expected, 1e-9, 'Switched RC preserves capacitor state');
        }
        samples.push(snapshot);
        for (const event of fixture.events || []) {
          if (event.afterStep === step) {
            const changed = engine.setSwitch(event.id, event.closed);
            near(changed.time, snapshot.time, 0, "Switch event preserves time");
          }
        }
        previous = step;
      }
      report.traces[name] = samples;
      engine.reset();
      let replay;
      let at = 0;
      for (const event of fixture.events || []) {
        engine.step(event.afterStep - at);
        engine.setSwitch(event.id, event.closed);
        at = event.afterStep;
      }
      replay = engine.step(1000 - at);
      assert(JSON.stringify(replay) === JSON.stringify(samples[samples.length - 1]), 'Reset/replay is deterministic');
      const saved = JSON.stringify(engine.snapshot());
      const detached = engine.snapshot();
      detached.elements[0].voltages[0] = 999;
      assert(JSON.stringify(engine.snapshot()) === saved, 'Snapshots do not expose mutable engine arrays');
      for (const count of [0, -1, 0.5, NaN, Infinity, 10001])
        rejects(() => engine.step(count), 'Reject invalid step count');
      for (const badText of ['', 'x 0 0 64 0 0', 'r 0 0 64 0 0 NaN', 'r 0 0 64 0 0 -1',
        'r 0 0 0 0 0 1000', 'v 0 0 0 64 0 6 40 5 0 0 0.5'])
        rejects(() => engine.load(badText, dt), 'Reject invalid or unsupported input');
      rejects(() => engine.load(text, Infinity), 'Reject invalid timestep');
      assert(JSON.stringify(engine.snapshot()) === saved, 'Validation errors preserve existing session');
      report.checks.push(`${name}: stepping, finite results, deterministic reset, detached snapshots, input validation`);
    }

    const response = await fetch('reference.json');
    assert(response.ok, 'Saved numerical reference must be available');
    const savedReference = await response.json();
    for (const name of Object.keys(engineCases)) {
      compareTrace(report.traces[name], savedReference.traces[name]);
      report.checks.push(`${name}: matches saved reference from ${savedReference.provenance.commit} (absolute tolerance 1e-12)`);
    }

    await verifyWorkers(savedReference);
    await verifyDocumentWorker(report);
    await verifyCoordinator(report);
    await verifyContinuousSimulation(report);
    await verifyOpamps(report,engine);
    await verifySineSources(report,engine);
    await verifyWaveformsAndRails(report,engine);
    await verifyScopeSamples(report,engine);

    if (new URLSearchParams(location.search).has('baseline')) {
      const api = await loadBaseline();
      for (const [name, fixture] of Object.entries(engineCases)) {
      const {text} = fixture;
        const reference = await baselineTrace(api, fixture);
        report.referenceTraces[name] = reference;
        compareTrace(report.traces[name], reference);
        report.checks.push(`${name}: matches supplied editor app at all ${reference.length} sample times (absolute tolerance 1e-12)`);
      }
    }
    finish('passed');
  } catch (error) { finish('failed', error); }
};
function loadBaseline() {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Unchanged reference simulator';
    frame.style.cssText = 'width:1000px;height:700px';
    frame.src = '/baseline/index.html?lang=en&running=false&cct=' + encodeURIComponent('$ 0 0.00001 100 50 5 50\n');
    document.body.append(frame);
    let attempts = 0;
    const poll = setInterval(() => {
      const api = frame.contentWindow.CircuitJS1;
      if (api) { clearInterval(poll); api.referenceWindow = frame.contentWindow; resolve(api); }
      else if (++attempts > 300) { clearInterval(poll); reject(new Error('Baseline startup timed out')); }
    }, 20);
  });
}

async function rejectsAsync(action, message) {
  let threw = false;
  try { await action(); } catch (error) {
    assert(!/timed out/i.test(String(error)), message + ': unexpected timeout');
    threw = true;
  }
  assert(threw, message);
}

async function workerTrace(worker, fixture) {
  await worker.load(fixture.text, dt);
  const samples = [];
  let at = 0;
  for (const step of fixture.samples || sampleSteps) {
    samples.push(await worker.step(step - at));
    for (const event of fixture.events || [])
      if (event.afterStep === step) await worker.setSwitch(event.id, event.closed);
    at = step;
  }
  return samples;
}

async function verifyWorkers(reference) {
  const worker = createCircuitWorker();
  let other;
  try {
    const ready = await worker.ready;
    assert(ready.dedicatedWorker && !ready.hasDocument && !ready.hasWindow,
      'Engine executes in dedicated worker without document/window shims');
    await rejectsAsync(() => worker.step(1), 'Worker rejects stepping before load');
    for (const [name, fixture] of Object.entries(engineCases)) {
      const trace = await workerTrace(worker, fixture);
      compareTrace(trace, reference.traces[name]);
      compareTrace(trace, report.traces[name]);
      await worker.reset();
      let at = 0;
      for (const event of fixture.events || []) {
        await worker.step(event.afterStep - at);
        await worker.setSwitch(event.id, event.closed);
        at = event.afterStep;
      }
      const replay = await worker.step(1000 - at);
      assert(JSON.stringify(replay) === JSON.stringify(trace[trace.length - 1]), 'Worker reset/replay');
      report.checks.push(`${name}: dedicated worker matches saved reference and main-thread engine; reset/replay passes`);
    }
    const beforeErrors = JSON.stringify(await worker.snapshot());
    await rejectsAsync(() => worker.step(0), 'Worker rejects invalid steps');
    await rejectsAsync(() => worker.load('unsupported', dt), 'Worker rejects invalid circuits');
    await rejectsAsync(() => worker.setSwitch(0, true), 'Worker rejects wrong element type');
    await rejectsAsync(() => worker.request('unknown'), 'Worker rejects unknown operation');
    assert(JSON.stringify(await worker.snapshot()) === beforeErrors, 'Worker errors preserve session');

    other = createCircuitWorker();
    await other.ready;
    await Promise.all([worker.load(engineCases.divider.text, dt), other.load(engineCases.rcEuler.text, dt)]);
    const [first, second] = await Promise.all([worker.step(10), other.step(100)]);
    near(first.time, 10 * dt, 1e-12, 'First worker time');
    near(second.time, 100 * dt, 1e-12, 'Second worker independent time');
    near(first.elements[2].voltages[0], 2.5, 1e-12, 'First worker independent circuit');
    assert(second.elements[2].voltages[0] > 3, 'Second worker RC state');
    near((await worker.snapshot()).time, first.time, 0, 'Second worker did not modify first');
    report.checks.push('Worker request errors recover; two simultaneous sessions stay isolated');

    await worker.load(engineCases.rectifier.text, dt);
    let heartbeats = 0;
    const heartbeat = setInterval(() => heartbeats++, 1);
    try {
      await Promise.all(Array.from({length: 10}, () => worker.step(10000)));
    } finally { clearInterval(heartbeat); }
    assert(heartbeats > 0, 'Main-thread heartbeat runs while worker requests are pending');
    near((await worker.snapshot()).time, 100000 * dt, 1e-9, 'Queued requests execute once in order');
    report.checks.push('100000 nonlinear steps execute in worker while main-thread heartbeat continues');
    worker.terminate();
    await rejectsAsync(() => worker.snapshot(), 'Terminated worker rejects requests');
  } finally { worker.terminate(); if (other) other.terminate(); }
}
function baselineTrace(api, fixture) {
  const {text} = fixture;
  return new Promise((resolve, reject) => {
    api.setSimRunning(false);
    api.importCircuit('$ 0 0.00001 100 50 5 50\n' + text, false);
    const win = api.referenceWindow;
    const proto = win.CanvasRenderingContext2D.prototype;
    if (!proto.originalSetTransform) {
      proto.originalSetTransform = proto.setTransform;
      proto.setTransform = function(a, b, c, d, e, f) {
        if (arguments.length === 6 && a > 0 && a === d && b === 0 && c === 0 && (e || f))
          this.canvas.circuitTransform = {a, d, e, f};
        return this.originalSetTransform(...arguments);
      };
    }
    const samples = [];
    let steps = 0;
    const timeout = setTimeout(() => { api.setSimRunning(false); reject(new Error('Baseline stepping timed out')); }, 10000);
    api.ontimestep = () => {
      try {
        steps++;
        if ((fixture.samples || sampleSteps).includes(steps)) {
          // Wire-current calculation can be deferred to the end of an editor frame.
          // Pause at the sample step, then read after that frame has finished.
          api.setSimRunning(false);
          setTimeout(() => {
            try {
              samples.push({time: api.getTime(), elements: api.getElements().map(elm => ({
                current: elm.getCurrent(),
                voltages: Array.from({length: elm.getPostCount()}, (_, pin) => elm.getVoltage(pin))
              }))});
              for (const event of fixture.events || [])
                if (event.afterStep === steps) clickBaselineSwitch(api, event);
              if (steps === 1000) {
                api.ontimestep = null;
                clearTimeout(timeout);
                resolve(samples);
              } else api.setSimRunning(true);
            } catch (error) { clearTimeout(timeout); reject(error); }
          }, 0);
        }
      } catch (error) { clearTimeout(timeout); api.setSimRunning(false); reject(error); }
    };
    api.setSimRunning(true);
  });
}

function clickBaselineSwitch(api, event) {
  const win = api.referenceWindow;
  const elm = api.getElements()[event.id];
  // Reference-build instrumentation only; no engine API depends on compiled fields.
  const fields = Object.keys(elm).filter(key => /^position(_\d+)?$/.test(key));
  assert(fields.length === 1, 'Reference switch position field available');
  const position = fields[0];
  assert(elm[position] === (event.closed ? 1 : 0), 'Reference switch starts in expected position');
  const canvas = [...win.document.querySelectorAll('canvas')].find(c => c.circuitTransform);
  assert(canvas, 'Reference transformed canvas available: ' + JSON.stringify([...win.document.querySelectorAll('canvas')].map(c => ({width:c.width,height:c.height,tr:c.circuitTransform}))));
  const tr = canvas.circuitTransform;
  assert(tr, 'Reference canvas transform available');
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const clientX = rect.left + (96 * tr.a + tr.e) / scale;
  const clientY = rect.top + (64 * tr.d + tr.f) / scale;
  for (const type of ['mousemove', 'mousedown', 'mouseup'])
    canvas.dispatchEvent(new win.MouseEvent(type, {bubbles: true, clientX, clientY, button: 0, buttons: type === 'mousedown' ? 1 : 0}));
  assert(elm[position] === (event.closed ? 0 : 1), 'Reference UI toggled switch');
}
