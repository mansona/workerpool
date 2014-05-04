var Promise = require('bluebird'),
    WorkerHandler = require('./WorkerHandler');

/**
 * A pool to manage workers
 * @param {Object} [options]
 * @constructor
 */
function Pool(options) {
  // configuration
  if (options && 'maxWorkers' in options) {
    if (!isNumber(options.maxWorkers) || !isInteger(options.maxWorkers) || options.maxWorkers < 1) {
      throw new TypeError('Option maxWorkers must be a positive integer number');
    }
    this.maxWorkers = options.maxWorkers;
  }
  else {
    var numCPUs = require('os').cpus().length; // TODO: this is not available on the browser
    this.maxWorkers = Math.max(numCPUs - 1, 1);
  }

  this.workers = [];  // queue with all workers
  this.tasks = [];    // queue with tasks awaiting execution
}

/**
 * Offload execution of a function to a worker.
 *
 * Example usage:
 *
 *   function add(a, b) {
 *     return a + b
 *   };
 *   var pool = new Pool()
 *   pool.run(add, [2, 4])
 *       .then(function (result) {
 *         console.log(result); // outputs 6
 *       })
 *       .catch(function(error) {
 *         console.log(error);
 *       });
 *
 * @param {Function} fn    The function to be executed. The function must be
 *                         serializable and must not depend on external
 *                         variables.
 * @param {Array} [args]   Arguments applied when calling the function
 * @return {Promise.<*, Error>} result
 */
Pool.prototype.run = function (fn, args) {
  // validate type of arguments
  if (typeof fn !== 'function') {
    throw new TypeError('Function expected as argument "fn"');
  }
  if (args && !Array.isArray(args)) {
    throw new TypeError('Array expected as argument "args"');
  }

  var me = this;
  return new Promise(function (resolve, reject) {
    // create a request
    var request = {
      method: 'run',
      params: {
        fn: fn + '', // stringify the function
        args: args || []
      }
    };

    // add the task to the queue
    var task = {
      request: request,
      resolve: resolve,
      reject: reject
    };
    me.tasks.push(task);

    // trigger task execution
    me._next();
  });
};

/**
 * Grab the first task from the queue, find a free worker, and assign the
 * worker to the task.
 * @private
 */
Pool.prototype._next = function () {
  if (this.tasks.length > 0) {
    // there are tasks in the queue

    // find an available worker
    var worker = this._getWorker();
    if (worker) {
      // get the first task from the queue
      var me = this;
      var task = this.tasks.shift();

      // send the request to the worker
      worker.exec(task.request.method, task.request.params)
          .then(function (result) {
            task.resolve(result);
            me._next(); // trigger next task in the queue
          })
          .catch(function (error) {
            task.reject(error);
            me._next(); // trigger next task in the queue
          });
    }
  }
};

/**
 * Get an available worker. If no worker is available and the maximum number
 * of workers isn't yet reached, a new worker will be created and returned.
 * If no worker is available and the maximum number of workers is reached,
 * null will be returned.
 *
 * @return {WorkerHandler | null} worker
 * @private
 */
Pool.prototype._getWorker = function() {
  // find a non-busy worker
  for (var i = 0, ii = this.workers.length; i < ii; i++) {
    var worker = this.workers[i];
    if (!worker.busy()) {
      return worker;
    }
  }

  if (this.workers.length < this.maxWorkers) {
    // create a new worker
    worker = new WorkerHandler();
    this.workers.push(worker);
    return worker;
  }

  return null;
};

/**
 * Close all active workers. Tasks currently being executed will be finished first.
 */
Pool.prototype.clear = function () {
  this.workers.forEach(function (worker) {
    worker.terminate();
  });

  this.workers = [];
};

/**
 * Test whether a variable is a number
 * @param {*} value
 * @returns {boolean} returns true when value is a number
 */
function isNumber(value) {
  return typeof value === 'number';
}

/**
 * Test whether a number is an integer
 * @param {number} value
 * @returns {boolean} Returns true if value is an integer
 */
function isInteger(value) {
  return Math.round(value) == value;
}

module.exports = Pool;