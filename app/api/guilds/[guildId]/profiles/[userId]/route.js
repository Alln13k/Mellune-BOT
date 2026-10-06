const { prisma } = require('../../../../../../database/client');
const { guildRoute } = require('../../../../../../lib/guildRoute');
const { response } = require('../../../../../../lib/featureApi');
const { getProfile } = require('../../../../../../services/profile/profileService');

const GET = guildRoute(async ({ guildId, params }) => {
  const profile = await getProfile(prisma, guildId, params.userId);
  return profile
    ? response({ profile })
    : response({ error: 'Profile not found.' }, 404);
});

module.exports = { GET };
