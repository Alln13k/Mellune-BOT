'use client';

import { useEffect, useState } from 'react';
import { DoorOpen, Save } from 'lucide-react';
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
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data.config);
  }, [data]);

  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const result = await guildApi(guild.id, 'welcome', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(result.config);
      notify('Welcome settings saved.');
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
          <button
            type="button"
            className="button"
            onClick={save}
            disabled={!form || saving}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      {!form ? (
        <Skeleton height={320} />
      ) : (
        <div className="grid-2">
          <div className="stack">
            <Card title="Messages">
              <Toggle
                label="Enable welcome system"
                description="Sends the messages below when members join or leave."
                checked={form.enabled}
                onChange={set('enabled')}
              />
              <Field
                label="Channel id"
                hint="Right-click the channel in Discord with developer mode on, then Copy Channel ID."
              >
                <input
                  inputMode="numeric"
                  placeholder="e.g. 123456789012345678"
                  value={form.channelId ?? ''}
                  onChange={(event) => set('channelId')(event.target.value)}
                />
              </Field>
              <Field label="Welcome message">
                <textarea
                  rows="3"
                  maxLength={1500}
                  value={form.welcomeText ?? ''}
                  onChange={(event) => set('welcomeText')(event.target.value)}
                />
              </Field>
              <Field label="Goodbye message">
                <textarea
                  rows="2"
                  maxLength={1500}
                  value={form.leaveText ?? ''}
                  onChange={(event) => set('leaveText')(event.target.value)}
                />
              </Field>
              <div className="chips" aria-label="Available placeholders">
                {PLACEHOLDERS.map((name) => (
                  <code className="chip" key={name}>{`{${name}}`}</code>
                ))}
              </div>
            </Card>
            <Card title="Extras">
              <Toggle
                label="Send the welcome message by DM"
                description="Members with closed DMs are skipped silently."
                checked={form.dmEnabled}
                onChange={set('dmEnabled')}
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
              title="Welcome preview"
              text={form.welcomeText}
              botName="Mellune"
            />
            <div className="preview-label">Leave</div>
            <Preview
              title="Goodbye preview"
              text={form.leaveText}
              botName="Mellune"
            />
          </Card>
        </div>
      )}
    </>
  );
}
