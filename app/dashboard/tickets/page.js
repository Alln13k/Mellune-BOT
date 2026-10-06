'use client';

import { useEffect, useState } from 'react';

const blankCategory = {
  name: 'Support',
  description: 'Get help from the Mellune team.',
  emoji: '✦',
  color: '#b9a7ff',
};

async function readJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export default function TicketBuilderPage() {
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [panel, setPanel] = useState({
    title: 'Need a hand?',
    description:
      'Choose a category below and our team will be with you shortly.',
    color: '#b9a7ff',
    emoji: '☾',
    footer: '',
    enabled: true,
  });
  const [categories, setCategories] = useState([blankCategory]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    readJson('/api/guilds')
      .then((data) => {
        setGuilds(data.guilds);
        if (data.guilds[0]) setGuildId(data.guilds[0].id);
      })
      .catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    readJson(`/api/guilds/${guildId}/tickets`)
      .then((data) => {
        if (data.panel) setPanel(data.panel);
        if (data.categories.length) setCategories(data.categories);
      })
      .catch((error) => setStatus(error.message));
  }, [guildId]);

  function updateCategory(index, key, value) {
    setCategories((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  async function save() {
    setStatus('Saving…');
    try {
      await readJson(`/api/guilds/${guildId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...panel, categories }),
      });
      setStatus('Saved to Supabase.');
    } catch (error) {
      setStatus(error.message);
    }
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
          <a className="nav-link" href="/dashboard">
            <span>⌂</span> Overview
          </a>
          <a className="nav-link active" href="/dashboard/tickets">
            <span>□</span> Tickets
          </a>
          <a className="nav-link" href="/dashboard#moderation">
            <span>◈</span> Moderation
          </a>
          <a className="nav-link" href="/dashboard#settings">
            <span>⚙</span> Settings
          </a>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="kicker">Tickets / panel builder</div>
            <h1>Make asking for help feel easy.</h1>
            <p className="subtle">
              Configure the panel your members will use to open a conversation.
            </p>
          </div>
          <button className="button" onClick={save} disabled={!guildId}>
            Save changes
          </button>
        </header>
        {status && <p className="subtle">{status}</p>}
        <section className="content-grid">
          <article className="card panel">
            <div className="section-heading">
              <div>
                <h2>Panel content</h2>
                <p className="subtle">This is persisted per Discord server.</p>
              </div>
              <span className="pill">Connected</span>
            </div>
            <label className="field">
              Title
              <input
                value={panel.title}
                onChange={(event) =>
                  setPanel({ ...panel, title: event.target.value })
                }
              />
            </label>
            <label className="field">
              Description
              <textarea
                rows="5"
                value={panel.description}
                onChange={(event) =>
                  setPanel({ ...panel, description: event.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label className="field">
                Accent
                <input
                  type="color"
                  value={panel.color}
                  onChange={(event) =>
                    setPanel({ ...panel, color: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Emoji
                <input
                  value={panel.emoji}
                  onChange={(event) =>
                    setPanel({ ...panel, emoji: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              Footer
              <input
                value={panel.footer || ''}
                onChange={(event) =>
                  setPanel({ ...panel, footer: event.target.value })
                }
              />
            </label>
          </article>
          <article
            className="card panel ticket-preview"
            style={{ '--accent': panel.color }}
          >
            <div className="kicker">Live preview</div>
            <div className="preview-emoji">{panel.emoji}</div>
            <h2>{panel.title || 'Need a hand?'}</h2>
            <p className="subtle">{panel.description}</p>
            <div className="preview-buttons">
              {categories.map((category) => (
                <button key={category.name} className="preview-button">
                  {category.emoji} {category.name}
                </button>
              ))}
            </div>
            <small className="subtle">
              {panel.footer || 'Mellune support panel'}
            </small>
          </article>
        </section>
        <section className="card panel category-panel">
          <div className="section-heading">
            <div>
              <h2>Ticket categories</h2>
              <p className="subtle">
                Each category can later map to a Discord channel and staff
                roles.
              </p>
            </div>
            <button
              className="button"
              onClick={() =>
                setCategories([
                  ...categories,
                  { ...blankCategory, name: 'New category' },
                ])
              }
            >
              Add category
            </button>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <div className="category-card" key={`${category.name}-${index}`}>
                <div className="form-row">
                  <label className="field">
                    Emoji
                    <input
                      value={category.emoji}
                      onChange={(event) =>
                        updateCategory(index, 'emoji', event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    Color
                    <input
                      type="color"
                      value={category.color || '#b9a7ff'}
                      onChange={(event) =>
                        updateCategory(index, 'color', event.target.value)
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  Name
                  <input
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(index, 'name', event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Description
                  <textarea
                    rows="3"
                    value={category.description}
                    onChange={(event) =>
                      updateCategory(index, 'description', event.target.value)
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
