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

test('Supabase project metadata points at Mellune DB', () => {
  const project = require('../supabase.project.json');
  assert.equal(project.projectRef, 'qjhvapvcbyabbsgvoley');
  assert.equal(project.url, 'https://qjhvapvcbyabbsgvoley.supabase.co');
});

test('Supabase helper never returns secret key values', () => {
  process.env.SUPABASE_ANON_KEY = 'secret-anon-key';
  process.env.SUPABASE_URL = 'https://qjhvapvcbyabbsgvoley.supabase.co';
  const { getSupabaseConfig } = require('../utils/supabase');
  const config = JSON.stringify(getSupabaseConfig());
  assert.equal(config.includes('secret-anon-key'), false);
  assert.equal(getSupabaseConfig().hasAnonKey, true);
});
