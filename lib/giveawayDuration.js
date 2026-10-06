const UNIT_SECONDS = {
  second: 1,
  seconds: 1,
  minute: 60,
  minutes: 60,
  hour: 3600,
  hours: 3600,
  day: 86400,
  days: 86400,
};

function parseGiveawayDuration(amount, unit) {
  const numericAmount = Number(amount);
  const multiplier = UNIT_SECONDS[String(unit || '').toLowerCase()];
  if (!Number.isInteger(numericAmount) || numericAmount <= 0 || !multiplier) {
    throw new Error(
      'Enter a positive duration and choose seconds, minutes, hours or days.',
    );
  }
  if (numericAmount > 365 || numericAmount * multiplier > 365 * 86400) {
    throw new Error('Giveaway duration cannot exceed 365 days.');
  }
  return numericAmount * multiplier;
}

module.exports = { parseGiveawayDuration };
