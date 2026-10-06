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

function formatJoinDate(value) {
  if (!value) return 'Join date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Join date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function profileSvg(profile, member) {
  const name = profile.user.displayName || profile.user.username;
  const username = `@${profile.user.username}`;
  const width = 720;
  const height = 300;
  const progressWidth = Math.round((profile.progress / 100) * 624);
  const avatar = member?.displayAvatarURL({ extension: 'png', size: 128 });
  const joinDate = formatJoinDate(profile.user.joinedAt);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#10131b"/>
        <stop offset="1" stop-color="#253452"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" x2="1">
        <stop stop-color="#3C527F"/>
        <stop offset="1" stop-color="#6f8fc4"/>
      </linearGradient>
      <clipPath id="avatar-clip"><circle cx="96" cy="100" r="48"/></clipPath>
    </defs>
    <rect width="${width}" height="${height}" rx="24" fill="url(#bg)"/>
    <rect x="18" y="18" width="684" height="264" rx="20" fill="#171b25" fill-opacity="0.92" stroke="#3C527F" stroke-opacity="0.72"/>
    <circle cx="96" cy="100" r="50" fill="#3C527F" fill-opacity="0.35"/>
    ${avatar ? `<image href="${escapeSvg(avatar)}" x="48" y="52" width="96" height="96" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>` : '<circle cx="96" cy="100" r="48" fill="#3C527F"/>'}
    <text x="172" y="91" fill="#ffffff" font-family="Arial,sans-serif" font-size="26" font-weight="700">${escapeSvg(name)}</text>
    <text x="172" y="119" fill="#a7adbf" font-family="Arial,sans-serif" font-size="17">${escapeSvg(username)}</text>
    <text x="48" y="186" fill="#ffffff" font-family="Arial,sans-serif" font-size="21" font-weight="700">LEVEL ${profile.level}</text>
    <text x="172" y="186" fill="#cbd6ed" font-family="Arial,sans-serif" font-size="16">${profile.xp.toLocaleString()} / ${profile.nextXp.toLocaleString()} XP</text>
    <rect x="48" y="202" width="624" height="14" rx="7" fill="#303746"/>
    <rect x="48" y="202" width="${progressWidth}" height="14" rx="7" fill="url(#accent)"/>
    <text x="48" y="239" fill="#9ca8bf" font-family="Arial,sans-serif" font-size="14">${profile.xpNeeded.toLocaleString()} XP needed for next level · ${profile.progress}% complete</text>
    <text x="48" y="263" fill="#dce6ff" font-family="Arial,sans-serif" font-size="15">Rank #${profile.rank}  ·  Joined ${escapeSvg(joinDate)}</text>
  </svg>`;
}

module.exports = {
  formatJoinDate,
  profileSvg,
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
      Buffer.from(profileSvg(profile, target)),
      { name: 'profile.svg' },
    );
    const embed = new EmbedBuilder()
      .setColor(MELLUNE_DEFAULT_COLOR_INT)
      .setImage('attachment://profile.svg');
    return interaction.reply({ embeds: [embed], files: [attachment] });
  },
};
