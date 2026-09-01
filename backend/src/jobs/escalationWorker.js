const { runEscalationSweep } = require('../services/escalationService');
const logger = require('../utils/logger');
const env = require('../config/environment');

let running = false;

function startEscalationWorker() {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runEscalationSweep();
    } catch (err) {
      logger.error('Escalation sweep failed:', err.message);
    } finally {
      running = false;
    }
  }, env.ESCALATION_POLL_INTERVAL_MS);

  logger.info(
    `Escalation worker started (poll ${env.ESCALATION_POLL_INTERVAL_MS}ms, ack window ${env.ESCALATION_ACK_WINDOW_MS}ms)`
  );
}

module.exports = { startEscalationWorker };
