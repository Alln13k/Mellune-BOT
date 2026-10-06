# Mellune Bot

An English-language, modular Discord bot for Mellune. It uses Node.js, JavaScript, discord.js 14, Prisma and **Supabase Postgres**. The project is split into small files so it is easy to learn and extend.

## 1. Requirements

- Node.js 18.18 or newer
- A Discord server where you have **Manage Server**
- A Discord application and bot
- A free [Supabase](https://supabase.com) project

## 2. Install

```bash
git clone <your-repository-url>
cd Mellune-BOT
npm install
cp .env.example .env
```

## 3. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application, then open **Bot** and click **Reset Token**.
3. Copy the token into `DISCORD_TOKEN`.
4. Copy the application ID from **General Information** into `DISCORD_CLIENT_ID`.
5. Enable **Server Members Intent** and **Message Content Intent** under **Bot > Privileged Gateway Intents**.
6. Invite the bot with the `bot` and `applications.commands` scopes.
7. Enable Developer Mode in Discord, right-click your server, **Copy Server ID**, and put it in `DEV_GUILD_ID`.

The code requests `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`, and `GuildVoiceStates`.

## 4. Supabase (already created)

The bot is linked to the existing project **Mellune DB**:

- Dashboard: https://supabase.com/dashboard/project/qjhvapvcbyabbsgvoley
- API URL: `https://qjhvapvcbyabbsgvoley.supabase.co`
- Region: `eu-west-1`

The Mellune tables (guilds, warnings, tickets, levels, …) are already created there, with Row Level Security enabled so the public `anon` key cannot read bot data. Prisma talks to Postgres with the database password.

Open **Project Settings → Database → Connect** and copy:

1. **Transaction pooler** (port `6543`) into `DATABASE_URL`. Add `?pgbouncer=true` if missing.
2. **Session pooler** (port `5432`) into `DIRECT_URL`.

Use user `postgres.qjhvapvcbyabbsgvoley` and the database password you set when the project was created.

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DEV_GUILD_ID=your_test_server_id
SUPABASE_PROJECT_REF=qjhvapvcbyabbsgvoley
SUPABASE_URL=https://qjhvapvcbyabbsgvoley.supabase.co
SUPABASE_ANON_KEY=your_anon_or_publishable_key
DATABASE_URL="postgres://postgres.qjhvapvcbyabbsgvoley:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.qjhvapvcbyabbsgvoley:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Never share these values, and never commit `.env`.

Tables are already on Supabase. You only need `npx prisma generate` before `npm start` (skip `prisma migrate deploy` unless you add a new migration).

## 5. Create tables and start the bot

```bash
npx prisma generate
npm run deploy:guild
npm start
```

In Discord, run `/ping`.

For development with automatic restart:

```bash
npm run dev
```

Global commands (slow to appear):

```bash
npm run deploy:global
```

## 6. What is already built

- startup and error handling in `index.js`
- command and event loaders
- multi-guild Prisma schema on Supabase Postgres
- English `/ping`, `/help`, `/server`, `/user`, `/avatar`
- permission-aware `/warn`, `/warnings`, `/clearwarns`, `/timeout`, `/purge`
- tickets, leveling, fun commands, and `/setup`
- tests, ESLint, and Prettier

## 7. Tests

```bash
npm test
npm run lint
npx prettier --check .
```

## Troubleshooting

**Missing environment variables**: copy `.env.example` to `.env` and fill `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`, and `DIRECT_URL`. `DEV_GUILD_ID` is required by `npm run deploy:guild`.

**Commands do not appear**: invite the bot with `applications.commands`, then run `npm run deploy:guild`.

**Can't reach database / IPv6 errors**: use the **pooler** URLs from **Connect**, not the direct `db.<project>.supabase.co` host, unless your network supports IPv6.

**Prisma migrate fails**: `DIRECT_URL` must be the session pooler (`:5432`) without `pgbouncer=true`. `DATABASE_URL` is the transaction pooler (`:6543`) with `pgbouncer=true`.

**Wrong password**: reset the database password in Supabase **Project Settings → Database**, then update both URLs.
