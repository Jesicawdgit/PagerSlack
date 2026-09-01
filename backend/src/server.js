const http = require('http');
const app = require('./app');
const env = require('./config/environment');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { initSocketServer } = require('./sockets/socketServer');
const { startEscalationWorker } = require('./jobs/escalationWorker');

const server = http.createServer(app);
initSocketServer(server);

async function start() {
  await connectDB();
  startEscalationWorker();
  server.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
  });
}

start();