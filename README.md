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

Prisma uses only `DATABASE_URL`. Put your external PostgreSQL URL there (`postgresql://...`). You do not need SQLite, and you do not need to add `DIRECT_URL` to start the bot.

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DEV_GUILD_ID=your_test_server_id
SUPABASE_PROJECT_REF=qjhvapvcbyabbsgvoley
SUPABASE_URL=https://qjhvapvcbyabbsgvoley.supabase.co
SUPABASE_ANON_KEY=your_anon_or_publishable_key
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

Never share these values, and never commit `.env`.

`npm start` generates Prisma and applies any pending migrations before starting
the bot. This keeps new dashboard features, such as always-on voice, in sync
with the production database. Do not skip `prisma migrate deploy` when a new
migration has been added.

## 5. Create tables and start the bot

```bash
npm start
```

On startup Mellune pushes slash commands once, globally, and removes per-server copies so Discord does not show them twice. In Discord, run `/ping`.

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
- `/ping` and `/profile`
- permission-aware `/warn`, `/warnings`, `/clearwarns`, `/timeout`, `/purge`
- tickets, leveling, and `/setup`
- tests, ESLint, and Prettier

## 7. Tests

```bash
npm test
npm run lint
npx prettier --check .
```

## 8. Dashboard

The repository now contains a Next.js dashboard at the root alongside the
Discord bot. The bot entry point remains `index.js`; `main.js` is not used.

For local dashboard development:

```bash
npm run dashboard:dev
```

Production build and start:

```bash
npm run dashboard:build
npm run dashboard:start
```

The dashboard keeps Discord OAuth access tokens server-side in the
`DashboardSession` PostgreSQL table. The browser receives only an opaque,
HTTP-only session cookie. Add these server-only variables before enabling
Discord login:

```env
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://your-dashboard-domain.example/api/auth/callback
SESSION_SECRET=
MELLUNE_GUILD_ID=your_mellune_server_id
MELLUNE_OWNER_ROLE_ID=your_mellune_owner_role_id
```

`SESSION_SECRET` must be at least 32 characters. The dashboard only returns
guilds the authenticated Discord user owns or can manage, and every guild
overview request re-checks that permission against Discord.

The OAuth flow also requests `guilds.join`: after explicit Discord consent, it
adds the authenticated user to `MELLUNE_GUILD_ID` using the server-side bot
token, then checks that the member has `MELLUNE_OWNER_ROLE_ID` before creating
a dashboard session. The bot must already be installed in that server and be
able to view members. Never expose the bot token to the browser.

### Dashboard sections

The sidebar groups every module. These pages are wired to the bot and database:

- **Overview**: totals plus an activity chart (24 hours, 7 days, 30 days).
- **Moderation**: searchable, filterable, paginated case history.
- **Tickets**: ticket panel and category builder with live preview. The settings are saved; the bot does not post the panel yet.
- **Welcome**: join/leave messages, DM option and auto-role, used by the bot's `guildMemberAdd` / `guildMemberRemove` events. Placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`, `{userId}`.
- **Leveling**: toggles XP and shows the leaderboard. Member rank cards use `/profile`.
- **Settings**: account and server details.

Other sections show a "being built" page until the bot supports them. Icons come from `lucide-react`.

## Troubleshooting

**Missing environment variables**: copy `.env.example` to `.env` and fill `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DATABASE_URL` (a `postgresql://` URL). `DEV_GUILD_ID` is required by `npm run deploy:guild`.

**Commands appear twice**: restart the bot, then fully restart the Discord app (not just the tab). Per-server copies are removed on startup; leftover duplicates in the client cache go away after that refresh.

**Can't reach database / IPv6 errors**: use the **pooler** URLs from **Connect**, not the direct `db.<project>.supabase.co` host, unless your network supports IPv6.

**Prisma says the URL must start with `file:`**: the schema is still SQLite. Update the files so `prisma/schema.prisma` has `provider = "postgresql"`, then run `npx prisma generate`.

**Wrong password**: reset the database password in your Postgres host, then update `DATABASE_URL` only.
