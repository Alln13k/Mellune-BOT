const { NextResponse } = require('next/server');
const { guildRoute } = require('./guildRoute');
const { guildResources } = require('./discordRest');
const { color, nullableText, snowflake, text } = require('./validate');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('./constants');

function featureRoute(handler) {
  return guildRoute(async ({ request, guildId, session }) =>
    handler({ request, guildId, session }),
  );
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function response(data, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanEmbed(input = {}) {
  const embed = {
    title: text(input.title, 256),
    description: text(input.description, 4096),
    url: cleanUrl(input.url),
    color: color(input.color, MELLUNE_DEFAULT_EMBED_COLOR),
    timestamp: input.timestamp === true,
    author: input.author?.name
      ? {
          name: text(input.author.name, 256),
          iconUrl: cleanUrl(input.author.iconUrl),
          url: cleanUrl(input.author.url),
        }
      : null,
    footer: input.footer?.text
      ? {
          text: text(input.footer.text, 2048),
          iconUrl: cleanUrl(input.footer.iconUrl),
        }
      : null,
    thumbnail: cleanUrl(input.thumbnail?.url)
      ? { url: cleanUrl(input.thumbnail.url) }
      : null,
    image: cleanUrl(input.image?.url)
      ? { url: cleanUrl(input.image.url) }
      : null,
    fields: Array.isArray(input.fields)
      ? input.fields
          .slice(0, 25)
          .map((field) => ({
            name: text(field.name, 256, 'Field'),
            value: text(field.value, 1024, ' '),
            inline: field.inline === true,
          }))
          .filter((field) => field.name && field.value)
      : [],
  };
  return embed;
}

function cleanMentions(input = {}) {
  const parse = Array.isArray(input.parse)
    ? input.parse.filter((value) =>
        ['users', 'roles', 'everyone'].includes(value),
      )
    : [];
  return {
    parse,
    users: Array.isArray(input.users)
      ? input.users.map(snowflake).filter(Boolean).slice(0, 10)
      : [],
    roles: Array.isArray(input.roles)
      ? input.roles.map(snowflake).filter(Boolean).slice(0, 10)
      : [],
  };
}

async function queueJob(prisma, guildId, type, payload, runAt) {
  return prisma.botJob.create({
    data: {
      guildId,
      type,
      payload,
      ...(runAt ? { runAt } : {}),
    },
  });
}

async function getResources(guildId) {
  return guildResources(guildId);
}

function cleanQuestion(question, position) {
  return {
    label: text(question.label, 45, `Question ${position + 1}`),
    prompt: text(question.prompt, 200, 'Your answer'),
    required: question.required !== false,
    position,
  };
}

module.exports = {
  cleanEmbed,
  cleanMentions,
  cleanQuestion,
  cleanUrl,
  errorResponse,
  featureRoute,
  getResources,
  nullableText,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
};
