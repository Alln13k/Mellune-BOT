const { prisma } = require('../../../../../../database/client');
const { featureRoute, readBody, response } = require('../../../../../../lib/featureApi');
const {
  cancelEvent,
  deleteEvent,
  duplicateEvent,
  endEvent,
  getEvent,
  publishEvent,
  sendReminderNow,
  setAttendee,
  updateEvent,
} = require('../../../../../../services/events/eventService');

const GET = featureRoute(async ({ guildId, params }) => {
  const event = await getEvent(prisma, guildId, params.eventId);
  if (!event) return response({ error: 'Event not found.' }, 404);
  return response({ event });
});

const POST = featureRoute(async ({ request, guildId, session, params }) => {
  const body = await readBody(request);
  const eventId = Number(params.eventId);
  const actorId = session.user.id;
  try {
    if (body.action === 'publish') {
      return response({ event: await publishEvent(prisma, null, { guildId, eventId, actorId }) });
    }
    if (body.action === 'cancel') {
      await cancelEvent(prisma, null, { guildId, eventId, actorId, scope: body.scope });
      return response({ event: await getEvent(prisma, guildId, eventId) });
    }
    if (body.action === 'end') {
      await endEvent(prisma, null, { guildId, eventId, actorId });
      return response({ event: await getEvent(prisma, guildId, eventId) });
    }
    if (body.action === 'duplicate') {
      return response({ event: await duplicateEvent(prisma, { guildId, eventId, actorId }) });
    }
    if (body.action === 'delete') {
      return response(await deleteEvent(prisma, { guildId, eventId }));
    }
    if (body.action === 'remind') {
      return response(await sendReminderNow(prisma, null, { guildId, eventId, actorId }));
    }
    if (body.action === 'attendee') {
      await setAttendee(prisma, null, {
        guildId,
        eventId,
        actorId,
        userId: body.userId,
        status: body.status,
      });
      return response({ event: await getEvent(prisma, guildId, eventId) });
    }
    await updateEvent(prisma, null, { guildId, eventId, actorId, body });
    return response({ event: await getEvent(prisma, guildId, eventId) });
  } catch (error) {
    return response({ error: error.message }, error.status || 400);
  }
});

module.exports = { GET, POST };
