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

test('Prisma schema uses PostgreSQL through DATABASE_URL', () => {
  const schema = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const lock = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', 'migration_lock.toml'),
    'utf8',
  );
  assert.match(schema, /provider\s*=\s*"postgresql"/);
  assert.doesNotMatch(schema, /provider\s*=\s*"sqlite"/);
  assert.match(schema, /url\s+=\s+env\("DATABASE_URL"\)/);
  assert.doesNotMatch(schema, /directUrl/);
  assert.match(lock, /provider\s*=\s*"postgresql"/);
});

test('slash commands are pushed once per guild and global copies are cleared', async () => {
  const { loadCommands } = require('../handlers/commandLoader');
  const { deploySlashCommands } = require('../handlers/commandDeployer');
  const commands = loadCommands(path.join(__dirname, '..', 'commands'));
  const guildPushes = [];
  const client = {
    application: {
      commands: {
        set: async (body) => {
          client.globalBody = body;
          return body;
        },
      },
    },
    guilds: {
      cache: new Map([
        [
          '111',
          {
            id: '111',
            name: 'Mellune',
            commands: {
              set: async (body) => {
                guildPushes.push({ guildId: '111', count: body.length });
                return body;
              },
            },
          },
        ],
      ]),
    },
  };

  const count = await deploySlashCommands(client, commands);
  assert.ok(count >= 9);
  assert.deepEqual(client.globalBody, []);
  assert.equal(guildPushes.length, 1);
  assert.equal(guildPushes[0].count, count);
});

test('bot entry file is index.js', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.main, 'index.js');
  assert.match(pkg.scripts.start, /node index\.js/);
  assert.equal(
    require('node:fs').existsSync(path.join(__dirname, '..', 'index.js')),
    true,
  );
  assert.equal(
    require('node:fs').existsSync(path.join(__dirname, '..', 'main.js')),
    false,
  );
});
