const connectDB = require('../backend/src/config/database');
const logger = require('../backend/src/utils/logger');
const authService = require('../backend/src/services/authService');
const User = require('../backend/src/models/User');
const Team = require('../backend/src/models/Team');
const Channel = require('../backend/src/models/Channel');
const DemoService = require('../backend/src/models/DemoService');
const { SEEDED_TEAM_NAME } = require('../backend/src/config/constants');

const SEED_PASSWORD = 'PagerSlack2026!';
const TEAM_NAME = SEEDED_TEAM_NAME;
const CHANNEL_NAMES = ['general', 'backend', 'frontend', 'qa'];
const DEMO_SERVICE_NAME = 'Order API';
const SEED_USERS = [
  { name: 'John', email: 'employee@pagerslack.dev', role: 'EMPLOYEE' },
  { name: 'Sarah', email: 'lead@pagerslack.dev', role: 'TEAM_LEAD' },
  { name: 'Mike', email: 'manager@pagerslack.dev', role: 'MANAGER' },
];

async function seed() {
  await connectDB();

  const hashedPassword = await authService.hashPassword(SEED_PASSWORD);

  const users = [];
  for (const seedUser of SEED_USERS) {
    let user = await User.findOne({ email: seedUser.email });
    if (!user) {
      user = await User.create({
        name: seedUser.name,
        email: seedUser.email,
        password: hashedPassword,
        role: seedUser.role,
      });
    } else {
      user.password = hashedPassword;
      user.role = seedUser.role;
      await user.save();
    }
    users.push(user);
  }

  let team = await Team.findOne({ name: TEAM_NAME });
  if (!team) {
    team = await Team.create({ name: TEAM_NAME, createdBy: users[0]._id, members: [] });
  }

  for (const user of users) {
    user.team = team._id;
    await user.save();
    if (!team.members.some((memberId) => memberId.equals(user._id))) {
      team.members.push(user._id);
    }
  }
  await team.save();

  for (const name of CHANNEL_NAMES) {
    const existingChannel = await Channel.findOne({ team: team._id, name });
    if (!existingChannel) {
      await Channel.create({ team: team._id, name });
    }
  }

  const existingDemoService = await DemoService.findOne({ name: DEMO_SERVICE_NAME });
  if (!existingDemoService) {
    await DemoService.create({ name: DEMO_SERVICE_NAME, status: 'HEALTHY' });
  }

  logger.info(`Seed complete. Team "${team.name}" (${team._id})`);
  SEED_USERS.forEach((seedUser) => {
    logger.info(`  ${seedUser.role}: ${seedUser.email} / ${SEED_PASSWORD}`);
  });
  logger.info(`  Channels ensured: ${CHANNEL_NAMES.join(', ')}`);
  logger.info(`  Demo service ensured: ${DEMO_SERVICE_NAME}`);

  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err.message);
  process.exit(1);
});
