const SNOWFLAKE = /^\d{15,25}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function text(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function nullableText(value, maxLength) {
  const cleaned = text(value, maxLength);
  return cleaned || null;
}

function snowflake(value) {
  const cleaned = text(value, 25);
  return SNOWFLAKE.test(cleaned) ? cleaned : null;
}

const { MELLUNE_DEFAULT_EMBED_COLOR } = require('./constants');

function color(value, fallback = MELLUNE_DEFAULT_EMBED_COLOR) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

function bool(value) {
  return value === true;
}

module.exports = { text, nullableText, snowflake, color, bool };
