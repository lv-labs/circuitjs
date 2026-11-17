'use strict';
const dt = 1e-5;
const sampleSteps = [1, 10, 100, 500, 1000];
const common = 'v 0 0 0 64 0 0 40 5 0 0 0.5\nr 0 64 64 64 0 1000\n';
const tail = '\nw 64 0 0 0 0\ng 0 0 0 -32 0';
const engineCases = {
  divider: {text: common + 'r 64 64 64 0 0 1000' + tail},
  rcEuler: {text: common + 'c 64 64 64 0 2 0.000001 0 0' + tail},
  rcTrapezoidal: {text: common + 'c 64 64 64 0 0 0.000001 0 0' + tail},
  rlc: {text: 'v 0 0 0 64 0 0 40 5 0 0 0.5\nr 0 64 64 64 0 100\n' +
    'l 64 64 128 64 0 0.1 0 0 0\nc 128 64 128 0 0 0.000001 0 0\n' +
    'w 128 0 0 0 0\ng 0 0 0 -32 0'},
  rectifier: {text: 'v 0 0 0 64 0 1 200 5 0 0 0.5\nd 0 64 64 64 0\n' +
    'r 64 64 64 0 0 1000' + tail, samples: [1, 100, 250, 400, 500, 600, 750, 900, 1000]},
  switchedRC: {text: common + 's 64 64 128 64 0 0 false\nc 128 64 128 0 2 0.000001 0 0\n' +
    'r 128 64 128 0 0 10000\nw 128 0 0 0 0\ng 0 0 0 -32 0',
    samples: [1, 10, 100, 101, 250, 500, 501, 750, 1000],
    events: [{afterStep: 100, id: 2, closed: false}, {afterStep: 500, id: 2, closed: true}]}
};
