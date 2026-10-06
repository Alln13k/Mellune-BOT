const { renderTemplate } = require('../../lib/welcomeTemplate');
const { ensureGuild, ensureUser } = require('../guildService');

function templateValues(member) {
  return {
    user: `<@${member.id}>`,
    username: member.user.username,
    server: member.guild.name,
    memberCount: member.guild.memberCount,
    userId: member.id,
  };
}

async function sendToChannel(member, config, template) {
  if (!config.channelId || !template) return;
  const channel = await member.guild.channels
    .fetch(config.channelId)
    .catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({
    content: renderTemplate(template, templateValues(member)),
    allowedMentions: { users: [member.id], roles: [], parse: [] },
  });
}

async function handleMemberJoin(prisma, member) {
  await ensureGuild(prisma, member.guild);
  await ensureUser(prisma, member.guild.id, member.user);
  const config = await prisma.welcomeConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!config?.enabled || member.user.bot) return;

  if (config.autoRoleId) {
    await member.roles
      .add(config.autoRoleId, 'Mellune welcome auto-role')
      .catch((error) =>
        console.error('Auto-role failed:', member.guild.id, error.message),
      );
  }
  await sendToChannel(member, config, config.welcomeText).catch((error) =>
    console.error('Welcome message failed:', member.guild.id, error.message),
  );
  if (config.dmEnabled && config.welcomeText) {
    await member
      .send({
        content: renderTemplate(config.welcomeText, templateValues(member)),
        allowedMentions: { parse: [] },
      })
      .catch(() => null);
  }
}

async function handleMemberLeave(prisma, member) {
  const config = await prisma.welcomeConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!config?.enabled || member.user?.bot) return;
  await sendToChannel(member, config, config.leaveText).catch((error) =>
    console.error('Leave message failed:', member.guild.id, error.message),
  );
}

module.exports = { handleMemberJoin, handleMemberLeave };
