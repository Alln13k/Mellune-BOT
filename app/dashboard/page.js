'use client';

import { useEffect, useMemo, useState } from 'react';

const navigation = [
  ['Overview', '⌂'],
  ['Moderation', '◈'],
  ['AutoMod', '✦'],
  ['Tickets', '□'],
  ['Welcome', '☼'],
  ['Roles', '♢'],
  ['Verification', '✓'],
  ['Leveling', '↗'],
  ['Giveaways', '◇'],
  ['Suggestions', '✎'],
  ['Applications', '▤'],
  ['Analytics', '⌁'],
  ['Logs', '≡'],
  ['Settings', '⚙'],
];

async function readJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const [session, setSession] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    readJson('/api/auth/session')
      .then(setSession)
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (!session) return;
    readJson('/api/guilds')
      .then((data) => {
        setGuilds(data.guilds);
        if (data.guilds[0]) setGuildId(data.guilds[0].id);
      })
      .catch((requestError) => setError(requestError.message));
  }, [session]);

  useEffect(() => {
    if (!guildId) return;
    readJson(`/api/guilds/${guildId}/overview`)
      .then(setOverview)
      .catch((requestError) => setError(requestError.message));
  }, [guildId]);

  const selectedGuild = useMemo(
    () => guilds.find((guild) => guild.id === guildId),
    [guildId, guilds],
  );

  if (error) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="eyebrow">Mellune / access</div>
          <h1>We could not open your console.</h1>
          <p className="error">{error}</p>
          <a className="button" href="/api/auth/login">
            Try Discord login again
          </a>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="landing">
        <section className="hero">
          <div className="eyebrow">Mellune / loading</div>
          <h1>Opening your console…</h1>
          <p>Verifying your Discord session securely on the server.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <a className="brand" href="/dashboard">
          <span className="brand-mark">☾</span>
          mellune
        </a>
        <select
          className="server-picker"
          value={guildId}
          onChange={(event) => setGuildId(event.target.value)}
          aria-label="Select a Discord server"
        >
          {guilds.map((guild) => (
            <option key={guild.id} value={guild.id}>
              {guild.name}
            </option>
          ))}
        </select>
        <nav className="nav" aria-label="Dashboard navigation">
          <div className="nav-label">Workspace</div>
          {navigation.map(([label, icon], index) => (
            <a
              className={`nav-link ${index === 0 ? 'active' : ''}`}
              href={index === 0 ? '#overview' : `#${label.toLowerCase()}`}
              key={label}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar">
            {session.user?.username?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>
              {session.user?.global_name || session.user?.username}
            </strong>
            <div className="subtle">Discord account</div>
          </div>
        </div>
      </aside>
      <main className="main" id="overview">
        <header className="topbar">
          <div>
            <div className="kicker">
              Overview / {selectedGuild?.name || 'server'}
            </div>
            <h1>Good evening.</h1>
            <p className="subtle">
              A quiet snapshot of what is happening in your community.
            </p>
          </div>
          <button
            className="button"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/';
            }}
          >
            Log out
          </button>
        </header>
        {!overview ? (
          <p className="subtle">Loading server activity…</p>
        ) : (
          <>
            <section className="stats" aria-label="Server statistics">
              {[
                ['Tracked members', overview.stats.members],
                ['Open tickets', overview.stats.openTickets],
                ['Warnings', overview.stats.warnings],
                ['Moderation cases', overview.stats.cases],
              ].map(([label, value]) => (
                <article className="card stat" key={label}>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{value.toLocaleString()}</div>
                </article>
              ))}
            </section>
            <section className="content-grid">
              <article className="card panel">
                <div className="section-heading">
                  <div>
                    <h2>Recent moderation</h2>
                    <p className="subtle">
                      The latest cases recorded by Mellune.
                    </p>
                  </div>
                  <span className="pill">Live database</span>
                </div>
                {overview.recentCases.length ? (
                  overview.recentCases.map((item) => (
                    <div className="case" key={item.id}>
                      <div>
                        <strong>Case #{item.id}</strong>
                        <div className="subtle">
                          {item.action} · {item.reason}
                        </div>
                      </div>
                      <time className="subtle">
                        {formatDate(item.createdAt)}
                      </time>
                    </div>
                  ))
                ) : (
                  <p className="empty">No moderation cases yet.</p>
                )}
              </article>
              <article className="card panel">
                <h2>Workspace signal</h2>
                <p className="subtle">
                  A few useful signals from the current server.
                </p>
                <div className="case">
                  <span>Leveling members</span>
                  <strong>{overview.stats.activeLevelUsers}</strong>
                </div>
                <div className="case">
                  <span>Database</span>
                  <span className="pill">Connected</span>
                </div>
                <div className="case">
                  <span>Guild isolation</span>
                  <span className="pill">Verified</span>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
