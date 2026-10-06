const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCommands } = require('../handlers/commandLoader');

test('all commands expose valid slash command data and execute handlers', () => {
  const commands = loadCommands(path.join(__dirname, '..', 'commands'));
  assert.ok(commands.size >= 9);
  for (const command of commands.values()) {
    assert.equal(typeof command.data.toJSON, 'function');
    assert.equal(typeof command.execute, 'function');
  }
});

test('environment validation reports missing secrets without revealing values', () => {
  const original = process.env.DISCORD_TOKEN;
  delete process.env.DISCORD_TOKEN;
  assert.throws(
    () => require('../utils/config').validateEnvironment(),
    /DISCORD_TOKEN/,
  );
  process.env.DISCORD_TOKEN = original;
});

test('Prisma schema uses PostgreSQL for Supabase', () => {
  const source = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  assert.match(source, /provider\s+=\s+"postgresql"/);
  assert.match(source, /directUrl\s+=\s+env\("DIRECT_URL"\)/);
});
