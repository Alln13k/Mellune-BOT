'use strict';

require('dotenv').config();

const { spawnSync } = require('node:child_process');

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
}

const result = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'generate'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

process.exit(result.status === null ? 1 : result.status);
