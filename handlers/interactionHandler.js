const { errorEmbed } = require('../utils/embeds');

function attachInteractionHandler(client, commands, prisma) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, { prisma, client });
    } catch (error) {
      console.error('Interaction error:', error);
      const response = {
        embeds: [errorEmbed('Something went wrong. Please try again later.')],
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred)
        await interaction.followUp(response);
      else await interaction.reply(response);
    }
  });
}

module.exports = { attachInteractionHandler };
