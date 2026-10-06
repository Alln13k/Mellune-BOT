'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Ticket, Trash2 } from 'lucide-react';
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
  title: 'Need a hand?',
  description: 'Choose a category below and our team will be with you shortly.',
  color: '#b9a7ff',
  emoji: '☾',
  footer: '',
  enabled: true,
};

const blankCategory = () => ({
  name: 'Support',
  description: 'Get help from the Mellune team.',
  emoji: '✦',
  color: '#b9a7ff',
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
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (data.panel) setPanel({ ...DEFAULT_PANEL, ...data.panel });
    setCategories(
      data.categories.length
        ? data.categories.map((category) => ({
            ...category,
            discordCategoryId: category.discordCategoryId ?? '',
          }))
        : [blankCategory()],
    );
    setReady(true);
  }, [data]);

  const setPanelField = (key) => (event) =>
    setPanel((current) => ({ ...current, [key]: event.target.value }));

  function updateCategory(index, key, value) {
    setCategories((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const result = await guildApi(guild.id, 'tickets', {
        method: 'POST',
        body: JSON.stringify({
          ...panel,
          categories: categories.map((category) => ({
            ...category,
            discordCategoryId: category.discordCategoryId || null,
          })),
        }),
      });
      setCategories(
        result.categories.map((category) => ({
          ...category,
          discordCategoryId: category.discordCategoryId ?? '',
        })),
      );
      notify('Ticket panel saved.');
    } catch (requestError) {
      notify(requestError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        icon={Ticket}
        title="Tickets"
        description="Design the panel your members use to open a conversation."
        actions={
          <button
            type="button"
            className="button"
            onClick={save}
            disabled={!ready || saving}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
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
            </Card>

            <Card
              title="Live preview"
              description="Approximately how the panel appears in Discord."
              className="sticky"
            >
              <div
                className="embed-preview"
                style={{ '--accent': panel.color }}
              >
                <h3>
                  {panel.emoji} {panel.title || 'Need a hand?'}
                </h3>
                <p>{panel.description}</p>
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
                        value={category.color || '#b9a7ff'}
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
        </>
      )}
    </>
  );
}
