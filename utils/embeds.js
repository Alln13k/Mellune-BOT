const { EmbedBuilder, Colors } = require('discord.js');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../lib/constants');

const MELLUNE_DEFAULT_COLOR_INT = Number.parseInt(
  MELLUNE_DEFAULT_EMBED_COLOR.slice(1),
  16,
);
// Kept as a compatibility alias for services that already import this name.
const MELLUNE_PURPLE = MELLUNE_DEFAULT_COLOR_INT;

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(MELLUNE_PURPLE)
    .setTitle(`꒰₊˚⊹🫧﹕${title}`)
    .setDescription(description);
}

function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setDescription(`⚠️ ${description}`);
}

module.exports = {
  MELLUNE_DEFAULT_COLOR_INT,
  MELLUNE_DEFAULT_EMBED_COLOR,
  MELLUNE_PURPLE,
  successEmbed,
  errorEmbed,
};
