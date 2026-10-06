# Mellune Bot

An English-language, modular Discord bot for Mellune. It uses Node.js, JavaScript, discord.js 14, Prisma and **Neon Postgres**. The project is intentionally split into small files so it is easy to learn and extend.

## 1. Requirements

- Node.js 18.18 or newer for the bot (`22.20+` if you use the Neon CLI)
- A Discord server where you have **Manage Server**
- A Discord application and bot
- A Neon project (this repo is set up for `bitter-moon-37158025`, branch `production`)

## 2. Install

```bash
git clone <your-repository-url>
cd Mellune-BOT
npm install
cp .env.example .env
```

Open `.env` and set:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
DEV_GUILD_ID=your_test_server_id
```

Use the **pooled** Neon URL for `DATABASE_URL` (hostname contains `-pooler`) and the **direct** URL for `DIRECT_URL` (no `-pooler`). Prisma uses the pooled URL at runtime and the direct URL for migrations.

Never share `DISCORD_TOKEN`, `DATABASE_URL`, `DIRECT_URL`, `NEON_API_KEY`, storage keys, or the AI Gateway token, and never commit `.env`.

Optional Neon services (Auth, Object Storage, AI Gateway) use these extra variables. Leave them empty until you copy them from the Neon Console:

```env
NEON_AUTH_APPLICATION_NAME=
NEON_AUTH_BASE_URL=
NEON_AUTH_JWKS_URL=
AWS_ENDPOINT_URL_S3=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
NEON_AI_GATEWAY_TOKEN=
NEON_AI_GATEWAY_BASE_URL=
```

## 3. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application, then open **Bot** and click **Reset Token**.
3. Copy the token into `.env`.
4. Copy the application ID from **General Information** into `DISCORD_CLIENT_ID`.
5. Enable **Server Members Intent**, **Message Content Intent**, and **Guild Voice States Intent** under **Bot > Privileged Gateway Intents**.
6. Invite the bot with the `bot` and `applications.commands` scopes. Give it only the permissions it needs; moderation commands require their matching permissions.

The code requests `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`, and `GuildVoiceStates`. They are used for slash commands, member configuration, moderation/message features and future voice/member logging.

## 4. Neon database

This project uses Neon Postgres, not SQLite.

```bash
npm i -g neon@latest
neon login
neon skills -y
neon mcp -y
neon link --project-id bitter-moon-37158025 --branch production -y
neon config init
neon deploy
```

`neon login` opens a browser. In a Cloud Agent or CI machine, browser login cannot finish because the callback is `127.0.0.1`. Create an API key in the Neon Console instead, then:

```bash
export NEON_API_KEY=your_neon_api_key
neon link --project-id bitter-moon-37158025 --branch production -y
neon deploy --allow-protected --update-existing
```

`neon link` pulls `DATABASE_URL` into `.env`. Copy the matching direct connection string into `DIRECT_URL`.

Then generate the Prisma client and apply the schema:

```bash
npx prisma generate
npx prisma migrate deploy
npm run deploy:guild
npm start
```

Guild commands update quickly and are recommended during development. Global commands can take time to appear:

```bash
npm run deploy:global
```

For development with automatic restart:

```bash
npm run dev
```

## 5. Current foundation

The foundation already includes:

- central startup and error handling in `main.js`
- recursive command and event loaders
- persistent multi-guild Prisma schema
- English `/ping`, `/help`, `/server`, `/user`, `/avatar`
- permission-aware `/warn`, `/warnings`, `/clearwarns`, `/timeout`, `/purge`
- moderation case and warning persistence
- reusable embeds and hierarchy checks
- smoke tests, ESLint and Prettier

The remaining systems (tickets, welcome, automod, leveling, giveaways and advanced configuration) have dedicated folders and database models ready to be implemented incrementally. This keeps the bot understandable instead of hiding every feature in one large file.

## 6. Tests and quality checks

```bash
npm test
npm run lint
npx prettier --check .
```

## Troubleshooting

**Missing environment variables**: ensure `.env` exists and contains all three required values. `DEV_GUILD_ID` is additionally required by `npm run deploy:guild`.

**Commands do not appear**: verify the bot was invited with `applications.commands`, then deploy to the correct guild. Global deployment is intentionally slow.

**Missing permissions**: the bot's role must be above the target member's highest role. Discord also prevents moderation of the server owner.

**Prisma errors**: run `npx prisma generate`, confirm both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in `.env`, then run `npx prisma migrate deploy`.
