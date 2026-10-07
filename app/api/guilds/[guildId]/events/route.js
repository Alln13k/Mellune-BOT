const { prisma } = require('../../../../../database/client');
const { botFetch } = require('../../../../../lib/discordRest');
const {
  featureRoute,
  getResources,
  readBody,
  response,
} = require('../../../../../lib/featureApi');
const { listEvents, createEvent, saveTemplate } = require('../../../../../services/events/eventService');

function memberCard(member) {
  const avatar = member.user?.avatar
    ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=96`
    : null;
  return {
    id: member.user.id,
    username: member.user.username,
    displayName: member.nick || member.user.global_name || member.user.username,
    avatar,
  };
}

const GET = featureRoute(async ({ request, guildId }) => {
  const params = new URL(request.url).searchParams;
  if (params.get('members') === '1') {
    const query = (params.get('q') || '').trim().slice(0, 64);
    if (query.length < 2) return response({ members: [] });
    const members = await botFetch(
      `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=8`,
    ).catch(() => []);
    return response({
      members: (Array.isArray(members) ? members : [])
        .filter((member) => member.user && member.user.bot !== true)
        .slice(0, 8)
        .map(memberCard),
    });
  }
  const [listed, resources, templates] = await Promise.all([
    listEvents(prisma, guildId, {
      bucket: params.get('bucket') || 'upcoming',
      page: params.get('page'),
      query: (params.get('q') || '').trim().slice(0, 80),
      month: /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : null,
    }),
    getResources(guildId),
    prisma.communityEventTemplate.findMany({ where: { guildId }, orderBy: { name: 'asc' } }),
  ]);
  return response({
    ...listed,
    templates,
    channels: resources.channels.filter((channel) => channel.type === 0 || channel.type === 5 || channel.type === 2),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  try {
    if (body.action === 'template') {
      const template = await saveTemplate(prisma, {
        guildId,
        actorId: session.user.id,
        body,
      });
      return response({ template });
    }
    const event = await createEvent(prisma, null, {
      guildId,
      actorId: session.user.id,
      body: { ...body, organizerId: body.organizerId || session.user.id },
    });
    return response({ event });
  } catch (error) {
    return response({ error: error.message }, error.status || 400);
  }
});

module.exports = { GET, POST };
