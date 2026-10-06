const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

const answers = ['Absolutely.', 'Probably.', 'Ask again later.', 'The stars say no.', 'I think so ♡'];

module.exports = {
  data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the dreamy 8-ball a question.').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    await interaction.reply({ embeds: [successEmbed('The 8-ball', `**${interaction.options.getString('question')}**\n\n${answers[Math.floor(Math.random() * answers.length)]}`)] });
  },
};
