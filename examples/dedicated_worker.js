var workerpool = require('./../index');

// create a worker pool using an external worker script
var pool = workerpool.pool(__dirname + '/workers/crossWorker.js');

// run functions on the worker via exec
pool.exec('multiply', [3, 4])
    .then(function (result) {
      console.log('Result: ' + result); // outputs 12

      pool.clear(); // clear all workers when done
    });