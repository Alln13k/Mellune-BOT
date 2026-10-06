const { prisma } = require('../../../../../database/client');
const { botFetch } = require('../../../../../lib/discordRest');
const { guildRoute } = require('../../../../../lib/guildRoute');
const { response } = require('../../../../../lib/featureApi');

const GET = guildRoute(async ({ guildId }) => {
  const checks = [];
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ key: 'database', label: 'Database', status: 'HEALTHY', message: 'PostgreSQL is reachable.' });
  } catch {
    checks.push({ key: 'database', label: 'Database', status: 'CRITICAL', message: 'PostgreSQL could not be reached.' });
  }
  let discordGuild = null;
  try {
    discordGuild = await botFetch(`/guilds/${guildId}?with_counts=true`);
    checks.push({ key: 'discord', label: 'Discord connection', status: 'HEALTHY', message: 'Discord guild data is reachable.' });
  } catch {
    checks.push({ key: 'discord', label: 'Discord connection', status: 'CRITICAL', message: 'Discord guild data is unavailable.' });
  }
  const [settings, failedJobs, staleJobs, counter, ticketPanels, backups] =
    await Promise.all([
      prisma.guildSettings.findUnique({ where: { guildId } }),
      prisma.botJob.count({ where: { guildId, status: 'FAILED' } }),
      prisma.botJob.count({
        where: {
          guildId,
          status: 'RUNNING',
          claimedAt: { lt: new Date(Date.now() - 5 * 60_000) },
        },
      }),
      prisma.memberCounterConfig.findUnique({ where: { guildId } }),
      prisma.ticketPanel.count({ where: { guildId, enabled: true } }),
      prisma.serverBackup.findFirst({ where: { guildId }, orderBy: { createdAt: 'desc' } }),
    ]);
  checks.push({
    key: 'leveling',
    label: 'Leveling',
    status: settings?.xpEnabled ? 'HEALTHY' : 'WARNING',
    message: settings?.xpEnabled ? 'Leveling is enabled.' : 'Leveling is disabled.',
  });
  checks.push({
    key: 'tickets',
    label: 'Ticket panels',
    status: ticketPanels ? 'HEALTHY' : 'WARNING',
    message: ticketPanels ? `${ticketPanels} active panel(s) configured.` : 'No active ticket panel is configured.',
  });
  checks.push({
    key: 'jobs',
    label: 'Bot jobs',
    status: failedJobs || staleJobs ? 'WARNING' : 'HEALTHY',
    message: failedJobs || staleJobs
      ? `${failedJobs} failed and ${staleJobs} stale job(s).`
      : 'Scheduler queue is healthy.',
  });
  if (counter?.enabled) {
    checks.push({
      key: 'member-counter',
      label: 'Member counter',
      status: counter.channelId ? 'HEALTHY' : 'WARNING',
      message: counter.channelId ? 'Counter channel is configured.' : 'Counter channel is missing.',
    });
  }
  checks.push({
    key: 'backup',
    label: 'Latest backup',
    status: backups ? 'HEALTHY' : 'WARNING',
    message: backups ? `Latest snapshot: ${backups.name}.` : 'No server backup exists yet.',
  });
  const score = Math.max(
    0,
    Math.round(
      checks.reduce(
        (total, check) =>
          total + (check.status === 'HEALTHY' ? 100 : check.status === 'WARNING' ? 60 : 0),
        0,
      ) / checks.length,
    ),
  );
  return response({
    score,
    checks,
    latencyMs: Date.now() - start,
    memberCount: discordGuild?.member_count ?? discordGuild?.approximate_member_count ?? null,
    checkedAt: new Date().toISOString(),
  });
});

module.exports = { GET };
