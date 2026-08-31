const connectDB = require('../backend/src/config/database');
const logger = require('../backend/src/utils/logger');
const authService = require('../backend/src/services/authService');
const User = require('../backend/src/models/User');
const Team = require('../backend/src/models/Team');
const Channel = require('../backend/src/models/Channel');

const SEED_PASSWORD = 'PagerSlack2026!';
const TEAM_NAME = 'Engineering';
const CHANNEL_NAMES = ['general', 'backend', 'incidents'];
const SEED_USERS = [
  { name: 'John', email: 'employee@pagerslack.dev', role: 'EMPLOYEE' },
  { name: 'Sarah', email: 'lead@pagerslack.dev', role: 'TEAM_LEAD' },
  { name: 'Mike', email: 'manager@pagerslack.dev', role: 'MANAGER' },
];

async function seed() {
  await connectDB();

  let team = await Team.findOne({ name: TEAM_NAME });

  const users = [];
  for (const seedUser of SEED_USERS) {
    let user = await User.findOne({ email: seedUser.email });
    if (!user) {
      user = await authService.registerUser({
        name: seedUser.name,
        email: seedUser.email,
        password: SEED_PASSWORD,
        role: seedUser.role,
      });
    } else {
      user.password = await authService.hashPassword(SEED_PASSWORD);
    }
    user.role = seedUser.role;
    if (team) user.team = team._id;
    await user.save();
    users.push(user);
  }

  if (!team) {
    team = await Team.create({ name: TEAM_NAME, createdBy: users[0]._id });
    await User.updateMany({ _id: { $in: users.map((user) => user._id) } }, { team: team._id });
  }

  for (const name of CHANNEL_NAMES) {
    const existingChannel = await Channel.findOne({ team: team._id, name });
    if (!existingChannel) {
      await Channel.create({ team: team._id, name });
    }
  }

  logger.info(`Seed complete. Team "${team.name}" (${team._id})`);
  SEED_USERS.forEach((seedUser) => {
    logger.info(`  ${seedUser.role}: ${seedUser.email} / ${SEED_PASSWORD}`);
  });
  logger.info(`  Channels ensured: ${CHANNEL_NAMES.join(', ')}`);

  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err.message);
  process.exit(1);
});
