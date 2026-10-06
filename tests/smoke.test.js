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

test('Neon service config never returns secret values', () => {
  process.env.AWS_ACCESS_KEY_ID = 'secret-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'secret-secret-key';
  process.env.NEON_AI_GATEWAY_TOKEN = 'secret-gateway-token';
  const { readNeonServiceConfig } = require('../utils/neon');
  const config = JSON.stringify(readNeonServiceConfig());
  assert.equal(config.includes('secret-access-key'), false);
  assert.equal(config.includes('secret-secret-key'), false);
  assert.equal(config.includes('secret-gateway-token'), false);
  assert.equal(readNeonServiceConfig().storage.hasCredentials, true);
  assert.equal(readNeonServiceConfig().aiGateway.hasToken, true);
});

test('neon.ts declares auth, AI Gateway, and the uploads bucket', () => {
  const source = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'neon.ts'),
    'utf8',
  );
  assert.match(source, /auth:\s*true/);
  assert.match(source, /aiGateway:\s*true/);
  assert.match(source, /uploads:\s*\{\s*access:\s*"private"/);
});
