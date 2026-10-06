const {
  AttachmentBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');
const { ensureUser } = require('../../services/guildService');
const { getProfile } = require('../../services/profile/profileService');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

function escapeSvg(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function profileSvg(profile, member, guildName) {
  const name = profile.user.displayName || profile.user.username;
  const username = `@${profile.user.username}`;
  const width = 900;
  const progressWidth = Math.round((profile.progress / 100) * 640);
  const avatar = member?.displayAvatarURL({ extension: 'png', size: 128 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="430" viewBox="0 0 ${width} 430">
    <defs><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#12131a"/><stop offset="1" stop-color="#253452"/></linearGradient></defs>
    <rect width="900" height="430" rx="28" fill="url(#bg)"/>
    <rect x="28" y="28" width="844" height="374" rx="22" fill="#191b24" stroke="#3C527F" stroke-width="2"/>
    ${avatar ? `<image href="${escapeSvg(avatar)}" x="70" y="72" width="128" height="128" preserveAspectRatio="xMidYMid slice"/>` : '<circle cx="134" cy="136" r="64" fill="#3C527F"/>'}
    <text x="230" y="105" fill="#ffffff" font-family="Arial,sans-serif" font-size="34" font-weight="700">${escapeSvg(name)}</text>
    <text x="230" y="140" fill="#a7adbf" font-family="Arial,sans-serif" font-size="22">${escapeSvg(username)}</text>
    <text x="230" y="178" fill="#dce6ff" font-family="Arial,sans-serif" font-size="20">${escapeSvg(guildName)}</text>
    <text x="70" y="260" fill="#ffffff" font-family="Arial,sans-serif" font-size="28" font-weight="700">LEVEL ${profile.level}</text>
    <text x="70" y="292" fill="#a7adbf" font-family="Arial,sans-serif" font-size="20">${profile.xp.toLocaleString()} / ${profile.nextXp.toLocaleString()} XP</text>
    <rect x="70" y="315" width="640" height="18" rx="9" fill="#303746"/><rect x="70" y="315" width="${progressWidth}" height="18" rx="9" fill="#3C527F"/>
    <text x="750" y="331" fill="#ffffff" font-family="Arial,sans-serif" font-size="18">${profile.progress}%</text>
    <text x="70" y="372" fill="#dce6ff" font-family="Arial,sans-serif" font-size="18">Rank #${profile.rank}  •  ${profile.messages.toLocaleString()} messages  •  ${profile.tickets} tickets</text>
  </svg>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a Mellune member profile.')
    .addUserOption((option) =>
      option.setName('member').setDescription('Member to inspect.'),
    ),
  async execute(interaction, { prisma }) {
    const target = interaction.options.getMember('member') || interaction.member;
    await ensureUser(prisma, interaction.guild.id, {
      ...target.user,
      joinedTimestamp: target.joinedTimestamp,
    });
    const profile = await getProfile(prisma, interaction.guild.id, target.id);
    if (!profile) return interaction.reply({ content: 'Profile data is not available yet.', ephemeral: true });
    const attachment = new AttachmentBuilder(
      Buffer.from(profileSvg(profile, target, interaction.guild.name)),
      { name: 'profile.svg' },
    );
    const embed = new EmbedBuilder()
      .setColor(MELLUNE_DEFAULT_COLOR_INT)
      .setTitle(`${profile.user.displayName || profile.user.username}'s profile`)
      .setDescription(
        `Level **${profile.level}** · **${profile.xp.toLocaleString()} XP** · **#${profile.rank}** in ${interaction.guild.name}`,
      )
      .addFields(
        { name: 'Progress', value: `${profile.progress}% to level ${profile.level + 1}`, inline: true },
        { name: 'Messages', value: profile.messages.toLocaleString(), inline: true },
        { name: 'Tickets', value: profile.tickets.toLocaleString(), inline: true },
        { name: 'Giveaways', value: `${profile.giveawaysEntered} entered · ${profile.giveawaysWon} won`, inline: true },
      )
      .setImage('attachment://profile.svg');
    return interaction.reply({ embeds: [embed], files: [attachment] });
  },
};
