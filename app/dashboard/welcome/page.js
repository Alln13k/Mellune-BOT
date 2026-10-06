'use client';

import { useEffect, useState } from 'react';
import { DoorOpen, Save, Send } from 'lucide-react';
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
import { PLACEHOLDERS, renderTemplate } from '../../../lib/welcomeTemplate';

const SAMPLE = {
  user: '@Luna',
  username: 'Luna',
  server: 'your server',
  memberCount: 128,
  userId: '123456789012345678',
};

function Preview({ title, text, botName }) {
  return (
    <div className="discord-message">
      <span className="avatar avatar-fallback" aria-hidden="true">
        M
      </span>
      <div>
        <div className="discord-author">
          <strong>{botName}</strong>
          <span className="bot-tag">BOT</span>
          <span className="subtle">Today</span>
        </div>
        <p className="discord-text" aria-label={title}>
          {renderTemplate(text, SAMPLE) || (
            <span className="subtle">Nothing will be sent.</span>
          )}
        </p>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const { guild, notify } = useDashboard();
  const { data, error, reload } = useGuildData('welcome');
  const [active, setActive] = useState('WELCOME');
  const [forms, setForms] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForms({ WELCOME: data.welcome, GOODBYE: data.goodbye });
  }, [data]);

  const form = forms?.[active];
  const channels = data?.channels || [];
  const set = (key) => (value) =>
    setForms((current) => ({
      ...current,
      [active]: { ...current[active], [key]: value },
    }));

  async function save(test = false) {
    setSaving(true);
    try {
      const result = await guildApi(guild.id, 'welcome', {
        method: 'POST',
        body: JSON.stringify({ ...form, kind: active, test }),
      });
      setForms((current) => ({
        ...current,
        [active]: result.config,
      }));
      notify(
        test
          ? 'Test queued for the bot.'
          : `${active === 'WELCOME' ? 'Welcome' : 'Goodbye'} settings saved.`,
      );
    } catch (requestError) {
      notify(requestError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        icon={DoorOpen}
        title="Welcome"
        description="Greet new members and say goodbye gracefully."
        actions={
          <div className="form-row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => save(true)}
              disabled={!form || saving}
            >
              <Send size={16} aria-hidden="true" /> Test{' '}
              {active === 'WELCOME' ? 'welcome' : 'goodbye'}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => save()}
              disabled={!form || saving}
            >
              <Save size={16} aria-hidden="true" />{' '}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      {!forms ? (
        <Skeleton height={320} />
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Greeting type">
            <button
              type="button"
              className={active === 'WELCOME' ? 'is-active' : ''}
              onClick={() => setActive('WELCOME')}
            >
              Welcome
            </button>
            <button
              type="button"
              className={active === 'GOODBYE' ? 'is-active' : ''}
              onClick={() => setActive('GOODBYE')}
            >
              Goodbye
            </button>
          </div>
          <div className="grid-2">
            <div className="stack">
              <Card
                title={`${active === 'WELCOME' ? 'Welcome' : 'Goodbye'} embed`}
              >
                <Toggle
                  label={`Enable ${active === 'WELCOME' ? 'welcome' : 'goodbye'} message`}
                  description="This configuration is stored independently from the other greeting."
                  checked={form.enabled}
                  onChange={set('enabled')}
                />
                <Field label="Channel">
                  <select
                    value={form.channelId || ''}
                    onChange={(event) => set('channelId')(event.target.value)}
                  >
                    <option value="">Choose a Discord channel…</option>
                    {channels
                      .filter((channel) => [0, 5].includes(channel.type))
                      .map((channel) => (
                        <option value={channel.id} key={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="form-row">
                  <Field label="Title">
                    <input
                      value={form.title || ''}
                      onChange={(event) => set('title')(event.target.value)}
                    />
                  </Field>
                  <Field label="Color">
                    <input
                      type="color"
                      value={form.color || '#3C527F'}
                      onChange={(event) => set('color')(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea
                    rows="3"
                    maxLength={4096}
                    value={form.description || ''}
                    onChange={(event) => set('description')(event.target.value)}
                  />
                </Field>
                <div className="form-row">
                  <Field label="Footer">
                    <input
                      value={form.footer || ''}
                      onChange={(event) => set('footer')(event.target.value)}
                    />
                  </Field>
                  <Field label="Author">
                    <input
                      value={form.authorName || ''}
                      onChange={(event) =>
                        set('authorName')(event.target.value)
                      }
                    />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label="Thumbnail URL">
                    <input
                      type="url"
                      value={form.thumbnailUrl || ''}
                      onChange={(event) =>
                        set('thumbnailUrl')(event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Image URL">
                    <input
                      type="url"
                      value={form.imageUrl || ''}
                      onChange={(event) => set('imageUrl')(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Mention behavior">
                  <select
                    value={form.mentionMode}
                    onChange={(event) => set('mentionMode')(event.target.value)}
                  >
                    <option value="USER">Mention the member</option>
                    <option value="NONE">No mention</option>
                    <option value="EVERYONE">
                      Mention everyone (explicit)
                    </option>
                  </select>
                </Field>
                <Toggle
                  label="Show timestamp"
                  checked={form.useTimestamp}
                  onChange={set('useTimestamp')}
                />
                <div className="chips" aria-label="Available placeholders">
                  {PLACEHOLDERS.map((name) => (
                    <code className="chip" key={name}>{`{${name}}`}</code>
                  ))}
                </div>
              </Card>
              <Card title="Extras">
                <Toggle
                  label="Send by DM"
                  description="Members with closed DMs are skipped silently."
                  checked={form.dmEnabled}
                  onChange={set('dmEnabled')}
                  disabled={active !== 'WELCOME'}
                />
                <Field
                  label="Auto-role id"
                  hint="Optional. Mellune needs the Manage Roles permission and a role above the one assigned."
                >
                  <input
                    inputMode="numeric"
                    placeholder="Role id"
                    value={form.autoRoleId ?? ''}
                    onChange={(event) => set('autoRoleId')(event.target.value)}
                  />
                </Field>
              </Card>
            </div>

            <Card
              title="Live preview"
              description="This is how the messages will look."
              className="sticky"
            >
              <div className="preview-label">Join</div>
              <Preview
                title={active}
                text={form.description}
                botName="Mellune"
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
