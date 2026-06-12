'use strict';

const { scheduleAllScouts, startWorker } = require('./queue');

/**
 * Start the Bull-based job scheduler.
 * Registers all active scouts as repeating jobs and starts the queue worker.
 */
async function startScheduler() {
  console.log('[scheduler] Starting Bull queue scheduler');
  await scheduleAllScouts();
  startWorker();
}

module.exports = { startScheduler };
