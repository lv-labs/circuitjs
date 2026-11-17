'use strict';
(async () => {
  const worker = createDocumentWorker();
  try {
    const environment = await worker.ready;
    const response = await fetch('examples/voltage-divider.json');
    if (!response.ok) throw new Error('Could not load saved divider');
    const loaded = await worker.loadDocument(await response.json());
    const frame = await worker.step(100);
    document.getElementById('result').textContent = JSON.stringify({environment, loaded, frame}, null, 2);
    document.body.dataset.status = 'passed';
  } catch (error) {
    document.getElementById('result').textContent = String(error.stack || error);
    document.body.dataset.status = 'failed';
  } finally {worker.terminate();}
})();
