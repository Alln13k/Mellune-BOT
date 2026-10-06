const { EmbedBuilder, Colors } = require('discord.js');

const MELLUNE_PURPLE = 0x9b8cff;

function successEmbed(title, description) {
  return new EmbedBuilder().setColor(MELLUNE_PURPLE).setTitle(`꒰₊˚⊹🫧﹕${title}`).setDescription(description);
}

function errorEmbed(description) {
  return new EmbedBuilder().setColor(Colors.Red).setDescription(`⚠️ ${description}`);
}

module.exports = { MELLUNE_PURPLE, successEmbed, errorEmbed };
