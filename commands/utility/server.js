const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Show information about this server.'),
  async execute(interaction) {
    const guild = interaction.guild;
    await interaction.reply({
      embeds: [
        successEmbed(
          guild.name,
          `Owner: <@${guild.ownerId}>\nMembers: **${guild.memberCount}**\nCreated: <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        ),
      ],
    });
  },
};
