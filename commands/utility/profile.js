const path = require('node:path');
const {
  AttachmentBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');
const { Resvg } = require('@resvg/resvg-js');
const { ensureUser } = require('../../services/guildService');
const { getProfile } = require('../../services/profile/profileService');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

const PROFILE_FONTS = [
  path.join(__dirname, '../../assets/fonts/Inter-Regular.ttf'),
  path.join(__dirname, '../../assets/fonts/Inter-Bold.ttf'),
];
const CARD_WIDTH = 720;
const CARD_HEIGHT = 300;

function escapeSvg(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clipText(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
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

function profileSvg(profile, member, avatarHref) {
  const name = clipText(profile.user.displayName || profile.user.username, 28);
  const username = clipText(`@${profile.user.username}`, 32);
  const progressWidth = Math.max(0, Math.round((profile.progress / 100) * 624));
  const avatar =
    avatarHref === undefined
      ? member?.displayAvatarURL?.({ extension: 'png', size: 256 })
      : avatarHref;
  const joinedLabel = profile.user.joinedAt
    ? `Joined ${formatJoinDate(profile.user.joinedAt)}`
    : 'Join date unavailable';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
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
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="24" fill="url(#bg)"/>
    <rect x="18" y="18" width="684" height="264" rx="20" fill="#171b25" fill-opacity="0.92" stroke="#3C527F" stroke-opacity="0.72"/>
    <circle cx="96" cy="100" r="50" fill="#3C527F" fill-opacity="0.35"/>
    ${avatar ? `<image href="${escapeSvg(avatar)}" x="48" y="52" width="96" height="96" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>` : '<circle cx="96" cy="100" r="48" fill="#3C527F"/>'}
    <text x="172" y="91" fill="#ffffff" font-family="Inter" font-size="26" font-weight="700">${escapeSvg(name)}</text>
    <text x="172" y="119" fill="#a7adbf" font-family="Inter" font-size="17">${escapeSvg(username)}</text>
    <text x="48" y="186" fill="#ffffff" font-family="Inter" font-size="21" font-weight="700">LEVEL ${profile.level}</text>
    <text x="172" y="186" fill="#cbd6ed" font-family="Inter" font-size="16">${profile.xp.toLocaleString()} / ${profile.nextXp.toLocaleString()} XP</text>
    <rect x="48" y="202" width="624" height="14" rx="7" fill="#303746"/>
    <rect x="48" y="202" width="${progressWidth}" height="14" rx="7" fill="url(#accent)"/>
    <text x="48" y="239" fill="#9ca8bf" font-family="Inter" font-size="14">${profile.xpNeeded.toLocaleString()} XP needed for next level · ${profile.progress}% complete</text>
    <text x="48" y="263" fill="#dce6ff" font-family="Inter" font-size="15">Rank #${profile.rank}  ·  ${escapeSvg(joinedLabel)}</text>
  </svg>`;
}

async function inlineAvatar(member) {
  const url = member?.displayAvatarURL?.({ extension: 'png', size: 256 });
  if (!url || url.startsWith('data:')) return url || null;
  try {
    const response = await fetch(url, {
      signal: globalThis.AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') || 'image/png')
      .split(';')[0]
      .trim();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 1_500_000) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch (error) {
    console.error('Profile avatar fetch failed:', error.message);
    return null;
  }
}

function renderProfilePng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_WIDTH * 2 },
    font: {
      fontFiles: PROFILE_FONTS,
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  const png = resvg.render().asPng();
  if (!png?.length) {
    throw new Error('Profile card render produced an empty image.');
  }
  return Buffer.from(png);
}

function profileFallbackEmbed(profile, member) {
  const name = profile.user.displayName || profile.user.username;
  const iconURL = member?.displayAvatarURL?.({ extension: 'png', size: 128 });
  return new EmbedBuilder()
    .setColor(MELLUNE_DEFAULT_COLOR_INT)
    .setAuthor(iconURL ? { name, iconURL } : { name })
    .setDescription(
      [
        `@${profile.user.username}`,
        `**Level ${profile.level}** · ${profile.xp.toLocaleString()} / ${profile.nextXp.toLocaleString()} XP`,
        `${profile.xpNeeded.toLocaleString()} XP to next level · ${profile.progress}%`,
        `Rank #${profile.rank} · Joined ${formatJoinDate(profile.user.joinedAt)}`,
      ].join('\n'),
    );
}

async function buildProfileMessage(profile, member) {
  const svg = profileSvg(profile, member, await inlineAvatar(member));
  const png = renderProfilePng(svg);
  const attachment = new AttachmentBuilder(png, { name: 'profile.png' });
  const embed = new EmbedBuilder()
    .setColor(MELLUNE_DEFAULT_COLOR_INT)
    .setImage('attachment://profile.png');
  return { embeds: [embed], files: [attachment] };
}

module.exports = {
  formatJoinDate,
  profileSvg,
  renderProfilePng,
  buildProfileMessage,
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a Mellune member profile.')
    .addUserOption((option) =>
      option.setName('member').setDescription('Member to inspect.'),
    ),
  async execute(interaction, { prisma }) {
    const target = interaction.options.getMember('member') || interaction.member;
    if (!interaction.guild || !target?.user) {
      return interaction.reply({
        content: 'Profile data is not available yet.',
        ephemeral: true,
      });
    }
    await ensureUser(prisma, interaction.guild.id, {
      ...target.user,
      joinedTimestamp: target.joinedTimestamp,
    });
    const profile = await getProfile(prisma, interaction.guild.id, target.id);
    if (!profile) {
      return interaction.reply({
        content: 'Profile data is not available yet.',
        ephemeral: true,
      });
    }
    try {
      return await interaction.reply(await buildProfileMessage(profile, target));
    } catch (error) {
      console.error('Profile card render failed:', error.message);
      return interaction.reply({ embeds: [profileFallbackEmbed(profile, target)] });
    }
  },
};
