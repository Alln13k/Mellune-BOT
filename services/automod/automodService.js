const { PermissionFlagsBits } = require('discord.js');
const { createCase } = require('../moderation/caseService');
const { sendLog, EVENT_KEYS } = require('../logging/logService');

const activity = new Map();
const INVITE_RE = /(discord\.gg|discord(?:app)?\.com\/invite)\//i;
const URL_RE = /https?:\/\/[^\s]+/i;

function rememberMessage(message) {
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const entries = (activity.get(key) || []).filter(
    (entry) => now - entry.at < 120_000,
  );
  entries.push({
    at: now,
    content: message.content,
    normalized: message.content.trim().toLowerCase(),
  });
  activity.set(key, entries);
  return entries;
}

function parsePatterns(rule) {
  if (Array.isArray(rule.patterns)) return rule.patterns;
  if (typeof rule.value !== 'string') return [];
  return rule.value
    .split(/[\n,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);
}

function violated(rule, message, entries) {
  const content = message.content || '';
  const lower = content.toLowerCase();
  const threshold = Math.max(1, rule.threshold || 5);
  const windowMs = Math.max(1, rule.windowSeconds || 10) * 1000;
  const recent = entries.filter((entry) => Date.now() - entry.at <= windowMs);
  switch (rule.type) {
    case 'SPAM':
      return recent.length >= threshold;
    case 'REPEATED': {
      const matching = recent.filter(
        (entry) => entry.normalized === lower.trim(),
      );
      return matching.length >= threshold;
    }
    case 'MENTIONS':
      return (
        message.mentions.users.size + message.mentions.roles.size >= threshold
      );
    case 'MASS_MENTIONS':
      return (
        message.mentions.everyone || message.mentions.users.size >= threshold
      );
    case 'EMOJIS':
      return (
        (content.match(/<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu) || []).length >=
        threshold
      );
    case 'INVITES':
      return INVITE_RE.test(content);
    case 'LINKS':
      return URL_RE.test(content);
    case 'CAPS': {
      const letters = content.match(/[A-Za-zÀ-ÿ]/g) || [];
      const upper = content.match(/[A-ZÀ-Ý]/g) || [];
      return letters.length >= 8 && upper.length / letters.length >= 0.75;
    }
    case 'WORDS':
      return parsePatterns(rule).some((word) => lower.includes(word));
    case 'DOMAINS': {
      const domains = parsePatterns(rule);
      return domains.some((domain) => lower.includes(domain));
    }
    default:
      return false;
  }
}

async function executeAction(message, rule) {
  const reason = `AutoMod: ${rule.type}`;
  if (
    rule.action === 'DELETE' ||
    rule.action === 'WARN' ||
    rule.action === 'TIMEOUT'
  ) {
    await message.delete().catch(() => {});
  }
  if (rule.action === 'WARN' || rule.action === 'TIMEOUT') {
    const member = message.member;
    if (member) {
      await createCase(message.client.prisma, {
        guild: message.guild,
        target: member,
        moderator: message.client.user,
        action: rule.action === 'TIMEOUT' ? 'AUTOMOD_TIMEOUT' : 'AUTOMOD_WARN',
        reason,
      }).catch(() => {});
    }
  }
  if (rule.action === 'TIMEOUT' && message.member?.moderatable) {
    await message.member.timeout(10 * 60 * 1000, reason).catch(() => {});
  }
  if (rule.action === 'KICK' && message.member?.kickable) {
    await message.member.kick(reason).catch(() => {});
  }
  if (rule.action === 'BAN' && message.member?.bannable) {
    await message.member
      .ban({ reason, deleteMessageSeconds: 0 })
      .catch(() => {});
  }
  if (rule.logEnabled !== false) {
    await sendLog(
      message.client,
      message.guild,
      EVENT_KEYS.AUTOMOD,
      'AutoMod action',
      `${message.author} triggered **${rule.type}** in ${message.channel}.`,
      [
        { name: 'Action', value: rule.action, inline: true },
        { name: 'Rule', value: rule.type, inline: true },
      ],
    ).catch(() => {});
  }
}

async function inspectMessage(message, prisma) {
  if (!message.guild || message.author.bot) return false;
  const rules = await prisma.autoModRule.findMany({
    where: { guildId: message.guild.id, enabled: true },
  });
  if (!rules.length) return false;
  const entries = rememberMessage(message);
  const rule = rules.find((candidate) => violated(candidate, message, entries));
  if (!rule) return false;
  await executeAction(message, rule);
  return true;
}

function clearGuildState(guildId) {
  for (const key of activity.keys()) {
    if (key.startsWith(`${guildId}:`)) activity.delete(key);
  }
}

module.exports = {
  clearGuildState,
  inspectMessage,
  parsePatterns,
  violated,
  PermissionFlagsBits,
};
