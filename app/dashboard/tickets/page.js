'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Send, Ticket, Trash2 } from 'lucide-react';
import {
  guildApi,
  useDashboard,
  useGuildData,
} from '../../../components/dashboard/DashboardContext';
import {
  Card,
  ErrorNotice,
  Field,
  PageHeader,
  Skeleton,
  Toggle,
} from '../../../components/dashboard/ui';

const DEFAULT_PANEL = {
  panelKey: 'support',
  name: 'Support',
  channelId: '',
  title: 'Need a hand?',
  description: 'Choose a category below and our team will be with you shortly.',
  color: '#3C527F',
  emoji: '☾',
  footer: '',
  payload: {
    color: '#3C527F',
    fields: [],
    timestamp: false,
  },
  buttonLabel: 'Open ticket',
  buttonStyle: 'SECONDARY',
  buttonEmoji: '🎫',
  maxOpen: 1,
  cooldownSeconds: 0,
  mentionCreator: true,
  autoWelcome: true,
  autoAddStaff: true,
  enabled: true,
};

const blankCategory = () => ({
  name: 'Support',
  description: 'Get help from the Mellune team.',
  emoji: '✦',
  color: '#3C527F',
  discordCategoryId: '',
  cooldownSeconds: 0,
  maxOpen: 1,
  enabled: true,
});

export default function TicketBuilderPage() {
  const { guild, notify } = useDashboard();
  const { data, error, reload } = useGuildData('tickets');
  const [panel, setPanel] = useState(DEFAULT_PANEL);
  const [categories, setCategories] = useState([blankCategory()]);
  const [panels, setPanels] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const savedPanels = data.panels || (data.panel ? [data.panel] : []);
    setPanels(savedPanels);
    const selected = savedPanels[0];
    if (selected)
      setPanel({
        ...DEFAULT_PANEL,
        ...selected,
        payload: selected.payload || DEFAULT_PANEL.payload,
      });
    setCategories(
      selected?.categories?.length
        ? selected.categories.map((category) => ({
            ...category,
            discordCategoryId: category.discordCategoryId ?? '',
          }))
        : [blankCategory()],
    );
    setReady(true);
  }, [data]);

  const setPanelField = (key) => (event) =>
    setPanel((current) => ({ ...current, [key]: event.target.value }));
  const setEmbedField = (section, key) => (event) =>
    setPanel((current) => ({
      ...current,
      payload: {
        ...(current.payload || {}),
        [section]: {
          ...(current.payload?.[section] || {}),
          [key]: event.target.value,
        },
      },
    }));
  function updateCategory(index, key, value) {
    setCategories((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  async function save(publish = false) {
    setSaving(true);
    try {
      const result = await guildApi(guild.id, 'tickets', {
        method: 'POST',
        body: JSON.stringify({
          ...panel,
          id: panel.id || undefined,
          publish,
          categories: categories.map((category) => ({
            ...category,
            discordCategoryId: category.discordCategoryId || null,
          })),
        }),
      });
      setPanel((current) => ({ ...current, ...result }));
      setCategories(
        (result.categories || []).map((category) => ({
          ...category,
          discordCategoryId: category.discordCategoryId ?? '',
        })),
      );
      notify('Ticket panel saved.');
      await reload();
    } catch (requestError) {
      notify(requestError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removePanel() {
    if (!panel.id || !window.confirm(`Delete the ${panel.name} panel?`)) return;
    try {
      await guildApi(guild.id, 'tickets', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: panel.id }),
      });
      notify('Ticket panel deleted.');
      await reload();
    } catch (requestError) {
      notify(requestError.message, 'error');
    }
  }

  function selectPanel(id) {
    const selected = panels.find((item) => item.id === Number(id));
    if (!selected) return;
    setPanel({ ...DEFAULT_PANEL, ...selected });
    setCategories(
      selected.categories?.map((category) => ({
        ...category,
        discordCategoryId: category.discordCategoryId ?? '',
      })) || [blankCategory()],
    );
  }

  function newPanel() {
    const key = `panel-${panels.length + 1}`;
    setPanel({
      ...DEFAULT_PANEL,
      payload: { ...DEFAULT_PANEL.payload },
      panelKey: key,
      name: `Panel ${panels.length + 1}`,
      id: undefined,
    });
    setCategories([blankCategory()]);
  }

  const tickets = (data?.tickets || []).filter((ticket) =>
    `${ticket.id} ${ticket.creatorId} ${ticket.type} ${ticket.status}`
      .toLowerCase()
      .includes(ticketFilter.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        icon={Ticket}
        title="Tickets"
        description="Design the panel your members use to open a conversation."
        actions={
          <div className="form-row">
            <select
              value={panel.id || ''}
              onChange={(event) => selectPanel(event.target.value)}
              disabled={!ready || !panels.length}
              aria-label="Select ticket panel"
            >
              {panels.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="button" className="button button-ghost" onClick={newPanel}>
              <Plus size={16} aria-hidden="true" /> New panel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => save()}
              disabled={!ready || saving}
            >
              <Save size={16} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => save(true)}
              disabled={!ready || saving || !panel.channelId}
            >
              <Send size={16} aria-hidden="true" /> Publish panel
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={removePanel}
              disabled={!ready || saving || !panel.id}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
        }
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      {!ready ? (
        <Skeleton height={320} />
      ) : (
        <>
          <div className="grid-2">
            <Card
              title="Panel content"
              description="Stored per Discord server."
            >
              <Toggle
                label="Panel enabled"
                checked={panel.enabled}
                onChange={(value) =>
                  setPanel((current) => ({ ...current, enabled: value }))
                }
              />
              <Field label="Panel channel">
                <select
                  value={panel.channelId || ''}
                  onChange={(event) =>
                    setPanel((current) => ({
                      ...current,
                      channelId: event.target.value,
                    }))
                  }
                >
                  <option value="">Choose a Discord channel…</option>
                  {(data?.channels || []).map((channel) => (
                    <option value={channel.id} key={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-row">
                <Field label="Panel name">
                  <input
                    value={panel.name}
                    maxLength={80}
                    onChange={setPanelField('name')}
                  />
                </Field>
                <Field label="Internal key">
                  <input
                    value={panel.panelKey}
                    maxLength={60}
                    onChange={setPanelField('panelKey')}
                  />
                </Field>
              </div>
              <Field label="Title">
                <input
                  value={panel.title}
                  maxLength={120}
                  onChange={setPanelField('title')}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows="4"
                  maxLength={1000}
                  value={panel.description}
                  onChange={setPanelField('description')}
                />
              </Field>
              <div className="form-row">
                <Field label="Accent colour">
                  <input
                    type="color"
                    value={panel.color}
                    onChange={setPanelField('color')}
                  />
                </Field>
                <Field label="Emoji">
                  <input
                    value={panel.emoji}
                    maxLength={8}
                    onChange={setPanelField('emoji')}
                  />
                </Field>
              </div>
              <Field label="Footer">
                <input
                  value={panel.footer || ''}
                  maxLength={240}
                  onChange={setPanelField('footer')}
                />
              </Field>
              <div className="form-row">
                <Field label="Author">
                  <input
                    value={panel.payload?.author?.name || ''}
                    maxLength={256}
                    onChange={setEmbedField('author', 'name')}
                  />
                </Field>
                <Field label="Author icon URL">
                  <input
                    value={panel.payload?.author?.iconUrl || ''}
                    maxLength={500}
                    onChange={setEmbedField('author', 'iconUrl')}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Thumbnail URL">
                  <input
                    value={panel.payload?.thumbnail?.url || ''}
                    maxLength={500}
                    onChange={setEmbedField('thumbnail', 'url')}
                  />
                </Field>
                <Field label="Image URL">
                  <input
                    value={panel.payload?.image?.url || ''}
                    maxLength={500}
                    onChange={setEmbedField('image', 'url')}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Embed footer">
                  <input
                    value={panel.payload?.footer?.text || ''}
                    maxLength={2048}
                    onChange={setEmbedField('footer', 'text')}
                  />
                </Field>
                <Toggle
                  label="Timestamp"
                  checked={panel.payload?.timestamp === true}
                  onChange={(value) =>
                    setPanel((current) => ({
                      ...current,
                      payload: { ...(current.payload || {}), timestamp: value },
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <Field label="Button label">
                  <input
                    value={panel.buttonLabel}
                    maxLength={80}
                    onChange={setPanelField('buttonLabel')}
                  />
                </Field>
                <Field label="Button emoji">
                  <input
                    value={panel.buttonEmoji || ''}
                    maxLength={16}
                    onChange={setPanelField('buttonEmoji')}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Max open tickets">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={panel.maxOpen}
                    onChange={setPanelField('maxOpen')}
                  />
                </Field>
                <Field label="Cooldown (seconds)">
                  <input
                    type="number"
                    min="0"
                    max="86400"
                    value={panel.cooldownSeconds}
                    onChange={setPanelField('cooldownSeconds')}
                  />
                </Field>
              </div>
            </Card>

            <Card
              title="Live preview"
              description="Approximately how the panel appears in Discord."
              className="sticky"
            >
              <div
                className="embed-preview"
                style={{ '--accent': panel.payload?.color || panel.color }}
              >
                <h3>
                  {panel.emoji} {panel.payload?.title || panel.title || 'Need a hand?'}
                </h3>
                <p>{panel.payload?.description || panel.description}</p>
                {panel.payload?.author?.name && (
                  <small>{panel.payload.author.name}</small>
                )}
                {panel.payload?.image?.url && (
                  <img
                    src={panel.payload.image.url}
                    alt=""
                    className="preview-image"
                  />
                )}
                <div className="preview-buttons">
                  {categories
                    .filter((category) => category.enabled)
                    .map((category, index) => (
                      <span className="preview-button" key={index}>
                        {category.emoji} {category.name}
                      </span>
                    ))}
                </div>
                {panel.footer && <small>{panel.footer}</small>}
              </div>
            </Card>
          </div>

          <Card
            title="Categories"
            description="Each category becomes a button on the panel."
            action={
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={categories.length >= 20}
                onClick={() =>
                  setCategories((items) => [
                    ...items,
                    {
                      ...blankCategory(),
                      name: `Category ${items.length + 1}`,
                    },
                  ])
                }
              >
                <Plus size={16} aria-hidden="true" /> Add category
              </button>
            }
          >
            <div className="category-grid">
              {categories.map((category, index) => (
                <div
                  className="category-card"
                  key={category.id ?? `new-${index}`}
                >
                  <div className="category-head">
                    <Toggle
                      label={category.name || 'Untitled'}
                      checked={category.enabled}
                      onChange={(value) =>
                        updateCategory(index, 'enabled', value)
                      }
                    />
                    <button
                      type="button"
                      className="icon-button icon-button-danger"
                      aria-label={`Remove ${category.name}`}
                      disabled={categories.length <= 1}
                      onClick={() =>
                        setCategories((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="form-row">
                    <Field label="Emoji">
                      <input
                        value={category.emoji}
                        maxLength={8}
                        onChange={(event) =>
                          updateCategory(index, 'emoji', event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Colour">
                      <input
                        type="color"
                        value={category.color || '#3C527F'}
                        onChange={(event) =>
                          updateCategory(index, 'color', event.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Name">
                    <input
                      value={category.name}
                      maxLength={48}
                      onChange={(event) =>
                        updateCategory(index, 'name', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      rows="2"
                      maxLength={240}
                      value={category.description}
                      onChange={(event) =>
                        updateCategory(index, 'description', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Discord category id" hint="Optional.">
                    <input
                      inputMode="numeric"
                      value={category.discordCategoryId}
                      onChange={(event) =>
                        updateCategory(
                          index,
                          'discordCategoryId',
                          event.target.value,
                        )
                      }
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Cooldown (s)">
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        value={category.cooldownSeconds}
                        onChange={(event) =>
                          updateCategory(
                            index,
                            'cooldownSeconds',
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Max open">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={category.maxOpen}
                        onChange={(event) =>
                          updateCategory(index, 'maxOpen', event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card
            title="Ticket activity"
            description="Live database records, limited to the latest 100 tickets."
            action={
              <input
                aria-label="Search tickets"
                placeholder="Search tickets…"
                value={ticketFilter}
                onChange={(event) => setTicketFilter(event.target.value)}
              />
            }
          >
            <div className="stats">
              <div className="card stat">
                <strong>{data?.stats?.total || 0}</strong>
                <span>Total</span>
              </div>
              <div className="card stat">
                <strong>{data?.stats?.open || 0}</strong>
                <span>Open</span>
              </div>
              <div className="card stat">
                <strong>{data?.stats?.closed || 0}</strong>
                <span>Closed</span>
              </div>
              <div className="card stat">
                <strong>
                  {data?.stats?.averageRating
                    ? Number(data.stats.averageRating).toFixed(1)
                    : '—'}
                </strong>
                <span>Avg. rating</span>
              </div>
            </div>
            {tickets.length ? (
              <ul className="list">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <div className="list-main">
                      <strong>
                        #{ticket.id} · {ticket.type} · {ticket.status}
                      </strong>
                      <span className="subtle">
                        {ticket.creatorId}
                        {ticket.claimedBy ? ` · claimed by ${ticket.claimedBy}` : ''}
                      </span>
                    </div>
                    <time className="subtle">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="subtle">No tickets match this search.</div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
