'use client';

import { useEffect, useState } from 'react';
import {
  BellRing,
  ChartColumn,
  Check,
  ClipboardList,
  Gift,
  Hammer,
  Lightbulb,
  Megaphone,
  Mic,
  MousePointerClick,
  Plus,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Trash2,
  UserCheck,
} from 'lucide-react';
import ActivityChart from './ActivityChart';
import { guildApi, useDashboard, useGuildData } from './DashboardContext';
import { MELLUNE_DEFAULT_EMBED_COLOR } from '../../lib/constants';
import {
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeader,
  Skeleton,
  Toggle,
  formatDate,
} from './ui';

const CONFIG_ICONS = {
  automod: ShieldCheck,
  'raid-protection': ShieldAlert,
  logs: ShieldAlert,
  roles: Tags,
  verification: UserCheck,
  giveaways: Gift,
  applications: ClipboardList,
  'temporary-voice': Mic,
  reminders: BellRing,
  embeds: Hammer,
  announcements: Megaphone,
  interactions: MousePointerClick,
  analytics: ChartColumn,
  suggestions: Lightbulb,
};

const CONFIG_TITLES = {
  automod: ['AutoMod', 'Keep chat tidy with rules the bot actually enforces.'],
  'raid-protection': [
    'Raid protection',
    'Detect suspicious join bursts before they become a problem.',
  ],
  logs: [
    'Logs',
    'Choose what Mellune records and where it sends clean embeds.',
  ],
  roles: [
    'Roles',
    'Inspect your server roles and request safe bot-managed changes.',
  ],
  verification: [
    'Verification',
    'Give members a secure, idempotent verification button.',
  ],
  giveaways: [
    'Giveaways',
    'Start persistent giveaways that survive bot restarts.',
  ],
  applications: [
    'Applications',
    'Collect forms in Discord and review submissions here.',
  ],
  'temporary-voice': [
    'Temporary voice',
    'Create private voice rooms on demand and clean them up automatically.',
  ],
  reminders: ['Reminders', 'Schedule messages that are delivered by the bot.'],
  embeds: ['Embeds', 'Build and send real Discord embeds from this dashboard.'],
  announcements: [
    'Announcements',
    'Publish now or schedule an announcement with safe mentions.',
  ],
  interactions: [
    'Interactions',
    'Publish persistent buttons for replies and role actions.',
  ],
  analytics: [
    'Analytics',
    'Measured from events Mellune has collected, never invented.',
  ],
  suggestions: [
    'Suggestions',
    'Turn a channel into a reviewable, persistent suggestion inbox.',
  ],
};

const endpointFor = (section) =>
  section === 'temporary-voice' ? 'temporary-voice' : section;

function SelectField({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SaveButton({ saving, onClick, label = 'Save changes' }) {
  return (
    <button
      type="button"
      className="button"
      onClick={onClick}
      disabled={saving}
    >
      <Save size={16} aria-hidden="true" />
      {saving ? 'Saving…' : label}
    </button>
  );
}

function useFeature(section) {
  const endpoint = endpointFor(section);
  const result = useGuildData(endpoint);
  const { guild, notify } = useDashboard();
  const [saving, setSaving] = useState(false);
  async function save(body) {
    setSaving(true);
    try {
      const response = await guildApi(guild.id, endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      notify('Changes saved.');
      await result.reload();
      return response;
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    } finally {
      setSaving(false);
    }
  }
  return { ...result, saving, save, guild, notify };
}

function GenericConfig({ section }) {
  const [title, description] = CONFIG_TITLES[section];
  const Icon = CONFIG_ICONS[section];
  const feature = useFeature(section);
  return (
    <FeatureFrame
      icon={Icon}
      title={title}
      description={description}
      error={feature.error}
      reload={feature.reload}
    >
      <Card>
        <EmptyState icon={Hammer} title="Configuration is unavailable">
          This module has no safe configuration surface yet.
        </EmptyState>
      </Card>
    </FeatureFrame>
  );
}

function FeatureFrame({
  icon: Icon,
  title,
  description,
  error,
  reload,
  actions,
  children,
}) {
  return (
    <>
      <PageHeader
        icon={Icon}
        title={title}
        description={description}
        actions={actions}
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}
      {children}
    </>
  );
}

function AutomodPage() {
  const feature = useFeature('automod');
  const [rules, setRules] = useState([]);
  useEffect(() => {
    if (feature.data) setRules(feature.data.rules);
  }, [feature.data]);
  const update = (index, key, value) =>
    setRules((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  return (
    <FeatureFrame
      icon={ShieldCheck}
      title={CONFIG_TITLES.automod[0]}
      description={CONFIG_TITLES.automod[1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() => feature.save({ rules })}
        />
      }
    >
      {!rules.length ? (
        <Skeleton height={360} />
      ) : (
        <Card
          title="Rules"
          description="Rules are evaluated server-side on every non-bot message."
        >
          <div className="category-grid">
            {rules.map((rule, index) => (
              <div className="category-card" key={rule.type}>
                <Toggle
                  label={rule.type.replaceAll('_', ' ')}
                  description="Enable this detector."
                  checked={rule.enabled}
                  onChange={(value) => update(index, 'enabled', value)}
                />
                <div className="form-row">
                  <Field label="Action">
                    <select
                      value={rule.action}
                      onChange={(event) =>
                        update(index, 'action', event.target.value)
                      }
                    >
                      {['DELETE', 'WARN', 'TIMEOUT', 'KICK', 'BAN'].map(
                        (action) => (
                          <option value={action} key={action}>
                            {action}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Threshold">
                    <input
                      type="number"
                      min="1"
                      value={rule.threshold}
                      onChange={(event) =>
                        update(index, 'threshold', event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Window (seconds)">
                  <input
                    type="number"
                    min="1"
                    value={rule.windowSeconds}
                    onChange={(event) =>
                      update(index, 'windowSeconds', event.target.value)
                    }
                  />
                </Field>
                {['WORDS', 'DOMAINS'].includes(rule.type) && (
                  <Field
                    label="Blocked values"
                    hint="Comma or newline separated."
                  >
                    <textarea
                      rows="3"
                      value={rule.value || ''}
                      onChange={(event) =>
                        update(index, 'value', event.target.value)
                      }
                    />
                  </Field>
                )}
                <Toggle
                  label="Log incidents"
                  checked={rule.logEnabled !== false}
                  onChange={(value) => update(index, 'logEnabled', value)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </FeatureFrame>
  );
}

function RaidPage() {
  const feature = useFeature('raid-protection');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.config);
  }, [feature.data]);
  const set = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value,
    }));
  return (
    <FeatureFrame
      icon={ShieldAlert}
      title={CONFIG_TITLES['raid-protection'][0]}
      description={CONFIG_TITLES['raid-protection'][1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() => feature.save(form)}
        />
      }
    >
      {!form ? (
        <Skeleton height={300} />
      ) : (
        <Card
          title="Detection policy"
          description="Protective actions remain permission-aware."
        >
          <Toggle
            label="Enable raid protection"
            checked={form.enabled}
            onChange={(value) => setForm({ ...form, enabled: value })}
          />
          <div className="form-row">
            <Field label="Join threshold">
              <input
                type="number"
                min="2"
                value={form.joinThreshold}
                onChange={set('joinThreshold')}
              />
            </Field>
            <Field label="Window (seconds)">
              <input
                type="number"
                min="2"
                value={form.windowSeconds}
                onChange={set('windowSeconds')}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Minimum account age (hours)">
              <input
                type="number"
                min="0"
                value={form.minAccountAgeHours}
                onChange={set('minAccountAgeHours')}
              />
            </Field>
            <Field label="Response">
              <select value={form.action} onChange={set('action')}>
                <option>ALERT</option>
                <option>TIMEOUT</option>
                <option>KICK</option>
              </select>
            </Field>
          </div>
          <Toggle
            label="Only count suspicious accounts"
            checked={form.suspiciousOnly}
            onChange={(value) => setForm({ ...form, suspiciousOnly: value })}
          />
          <Field label="Raid log channel id">
            <input
              value={form.logChannelId || ''}
              onChange={set('logChannelId')}
            />
          </Field>
        </Card>
      )}
    </FeatureFrame>
  );
}

function LogsPage() {
  const feature = useFeature('logs');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.config);
  }, [feature.data]);
  if (!form) {
    return (
      <FeatureFrame
        icon={ShieldAlert}
        title="Logs"
        description={CONFIG_TITLES.logs[1]}
        error={feature.error}
        reload={feature.reload}
      >
        <Skeleton height={300} />
      </FeatureFrame>
    );
  }
  const events = Object.keys(form.events || {});
  return (
    <FeatureFrame
      icon={ShieldAlert}
      title="Logs"
      description={CONFIG_TITLES.logs[1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() => feature.save(form)}
        />
      }
    >
      <Card
        title="Log routing"
        description="The bot sends Discord embeds for selected events."
      >
        <Toggle
          label="Enable logging"
          checked={form.enabled}
          onChange={(value) => setForm({ ...form, enabled: value })}
        />
        <Field label="Default log channel id">
          <input
            value={form.memberLogId || ''}
            onChange={(event) =>
              setForm({ ...form, memberLogId: event.target.value })
            }
          />
        </Field>
        <div className="category-grid">
          {events.map((key) => (
            <Toggle
              key={key}
              label={key.replace(/([A-Z])/g, ' $1')}
              checked={form.events[key]}
              onChange={(value) =>
                setForm({ ...form, events: { ...form.events, [key]: value } })
              }
            />
          ))}
        </div>
      </Card>
    </FeatureFrame>
  );
}

function VerificationPage() {
  const feature = useFeature('verification');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.config);
  }, [feature.data]);
  if (!form)
    return (
      <FeatureFrame
        icon={UserCheck}
        title="Verification"
        description={CONFIG_TITLES.verification[1]}
        error={feature.error}
        reload={feature.reload}
      >
        <Skeleton height={300} />
      </FeatureFrame>
    );
  const channels = feature.data.channels || [];
  return (
    <FeatureFrame
      icon={UserCheck}
      title="Verification"
      description={CONFIG_TITLES.verification[1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() => feature.save(form)}
        />
      }
    >
      <Card
        title="Verification panel"
        description="The button is idempotent and applies the selected role only."
      >
        <Toggle
          label="Enable verification"
          checked={form.enabled}
          onChange={(value) => setForm({ ...form, enabled: value })}
        />
        <SelectField
          label="Channel"
          value={form.channelId}
          onChange={(value) => setForm({ ...form, channelId: value })}
          options={channels}
        />
        <Field label="Role id">
          <input
            value={form.roleId || ''}
            onChange={(event) =>
              setForm({ ...form, roleId: event.target.value })
            }
          />
        </Field>
        <div className="form-row">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field label="Button label">
            <input
              value={form.buttonLabel}
              onChange={(event) =>
                setForm({ ...form, buttonLabel: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows="4"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Field label="Minimum account age (hours)">
          <input
            type="number"
            value={form.minAccountAgeHours}
            onChange={(event) =>
              setForm({ ...form, minAccountAgeHours: event.target.value })
            }
          />
        </Field>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => feature.save({ ...form, publish: true })}
        >
          <Send size={16} /> Publish / update panel
        </button>
      </Card>
    </FeatureFrame>
  );
}

function TemporaryVoicePage() {
  const feature = useFeature('temporary-voice');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.config);
  }, [feature.data]);
  if (!form)
    return (
      <FeatureFrame
        icon={Mic}
        title="Temporary voice"
        description={CONFIG_TITLES['temporary-voice'][1]}
        error={feature.error}
        reload={feature.reload}
      >
        <Skeleton height={300} />
      </FeatureFrame>
    );
  const channels = feature.data.channels || [];
  return (
    <FeatureFrame
      icon={Mic}
      title="Temporary voice"
      description={CONFIG_TITLES['temporary-voice'][1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() => feature.save(form)}
        />
      }
    >
      <Card
        title="Voice room policy"
        description="Empty rooms are removed safely, including after a bot restart."
      >
        <Toggle
          label="Enable temporary voice"
          checked={form.enabled}
          onChange={(value) => setForm({ ...form, enabled: value })}
        />
        <SelectField
          label="Trigger voice channel"
          value={form.triggerChannelId}
          onChange={(value) => setForm({ ...form, triggerChannelId: value })}
          options={channels.filter((channel) => channel.type === 2)}
        />
        <SelectField
          label="Parent category"
          value={form.categoryId}
          onChange={(value) => setForm({ ...form, categoryId: value })}
          options={channels.filter((channel) => channel.type === 4)}
        />
        <div className="form-row">
          <Field label="Name format">
            <input
              value={form.nameFormat}
              onChange={(event) =>
                setForm({ ...form, nameFormat: event.target.value })
              }
            />
          </Field>
          <Field label="User limit">
            <input
              type="number"
              min="0"
              max="99"
              value={form.userLimit}
              onChange={(event) =>
                setForm({ ...form, userLimit: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Default privacy">
            <select
              value={form.defaultPrivacy || 'PUBLIC'}
              onChange={(event) =>
                setForm({ ...form, defaultPrivacy: event.target.value })
              }
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </Field>
          <Field label="Maximum active rooms (0 = unlimited)">
            <input
              type="number"
              min="0"
              max="100"
              value={form.maxRooms || 0}
              onChange={(event) =>
                setForm({ ...form, maxRooms: event.target.value })
              }
            />
          </Field>
        </div>
        <Toggle
          label="Delete empty rooms automatically"
          checked={form.autoDelete !== false}
          onChange={(value) => setForm({ ...form, autoDelete: value })}
        />
        <Field label="Staff role IDs (comma separated)">
          <input
            value={(form.staffRoleIds || []).join(', ')}
            onChange={(event) =>
              setForm({
                ...form,
                staffRoleIds: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      </Card>
    </FeatureFrame>
  );
}

function RolesPage() {
  const feature = useFeature('roles');
  const [form, setForm] = useState({
    name: '',
    color: MELLUNE_DEFAULT_EMBED_COLOR,
    userId: '',
    roleId: '',
  });
  const [panel, setPanel] = useState({
    channelId: '',
    name: 'Role menu',
    mode: 'BUTTON',
    title: 'Choose your roles',
    description: 'Select a button to update your roles.',
    color: MELLUNE_DEFAULT_EMBED_COLOR,
    exclusiveMode: 'MULTIPLE',
    entries: [{ roleId: '', label: 'Role', emoji: '🔘', enabled: true }],
  });
  useEffect(() => {
    const saved = feature.data?.panels?.[0];
    if (saved) {
      setPanel({
        ...panel,
        ...saved,
        entries: saved.entries?.length ? saved.entries : panel.entries,
      });
    }
  }, [feature.data]);
  const updateEntry = (index, key, value) =>
    setPanel((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  const roles = feature.data?.roles || [];
  return (
    <FeatureFrame
      icon={Tags}
      title="Roles"
      description={CONFIG_TITLES.roles[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card
          title="Server roles"
          description="Managed roles are shown with their live Discord position."
        >
          {!feature.data ? (
            <Skeleton height={300} />
          ) : roles.length ? (
            <ul className="list">
              {roles.map((role) => (
                <li key={role.id}>
                  <span
                    className="server-icon"
                    style={{
                      background: role.color
                        ? `#${role.color.toString(16).padStart(6, '0')}`
                        : undefined,
                    }}
                  />{' '}
                  <div className="list-main">
                    <strong>{role.name}</strong>
                    <span className="subtle">
                      Position {role.position}
                      {role.managed ? ' · Managed' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Tags} title="No roles found" />
          )}
        </Card>
        <Card
          title="Safe role action"
          description="The bot checks its role hierarchy before applying changes."
        >
          <Field label="Role id">
            <input
              value={form.roleId}
              onChange={(event) =>
                setForm({ ...form, roleId: event.target.value })
              }
            />
          </Field>
          <Field label="Member id">
            <input
              value={form.userId}
              onChange={(event) =>
                setForm({ ...form, userId: event.target.value })
              }
            />
          </Field>
          <div className="form-row">
            <button
              type="button"
              className="button"
              onClick={() =>
                feature.save({
                  action: 'assign',
                  roleId: form.roleId,
                  userId: form.userId,
                })
              }
            >
              <Check size={16} /> Assign
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() =>
                feature.save({
                  action: 'remove',
                  roleId: form.roleId,
                  userId: form.userId,
                })
              }
            >
              <Trash2 size={16} /> Remove
            </button>
          </div>
          <hr className="divider" />
          <Field label="Create role name">
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field>
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              feature.save({
                action: 'create',
                name: form.name,
                color: form.color,
              })
            }
          >
            <Plus size={16} /> Queue role creation
          </button>
        </Card>
      </div>
      <Card
        title="Role panel"
        description="Build one persistent panel with multiple role choices."
      >
        <div className="form-row">
          <SelectField
            label="Channel"
            value={panel.channelId}
            onChange={(value) => setPanel({ ...panel, channelId: value })}
            options={feature.data?.channels || []}
          />
          <Field label="Panel name">
            <input
              value={panel.name}
              onChange={(event) =>
                setPanel({ ...panel, name: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Mode">
            <select
              value={panel.mode}
              onChange={(event) => setPanel({ ...panel, mode: event.target.value })}
            >
              <option value="BUTTON">Buttons</option>
              <option value="SELECT">Select menu</option>
              <option value="REACTION">Reactions</option>
            </select>
          </Field>
          <Field label="Selection">
            <select
              value={panel.exclusiveMode}
              onChange={(event) =>
                setPanel({ ...panel, exclusiveMode: event.target.value })
              }
            >
              <option value="MULTIPLE">Multiple roles</option>
              <option value="EXCLUSIVE">One role only</option>
            </select>
          </Field>
          <Field label="Panel title">
            <input
              value={panel.title}
              onChange={(event) =>
                setPanel({ ...panel, title: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows="3"
            value={panel.description}
            onChange={(event) =>
              setPanel({ ...panel, description: event.target.value })
            }
          />
        </Field>
        <div className="category-grid">
          {panel.entries.map((entry, index) => (
            <div className="category-card" key={index}>
              <div className="form-row">
                <Field label="Emoji">
                  <input
                    value={entry.emoji}
                    maxLength={16}
                    onChange={(event) => updateEntry(index, 'emoji', event.target.value)}
                  />
                </Field>
                <Field label="Role id">
                  <input
                    value={entry.roleId}
                    onChange={(event) => updateEntry(index, 'roleId', event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Label">
                <input
                  value={entry.label}
                  maxLength={80}
                  onChange={(event) => updateEntry(index, 'label', event.target.value)}
                />
              </Field>
              <Field label="Description">
                <input
                  value={entry.description || ''}
                  maxLength={200}
                  onChange={(event) =>
                    updateEntry(index, 'description', event.target.value)
                  }
                />
              </Field>
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={panel.entries.length <= 1}
                onClick={() =>
                  setPanel({
                    ...panel,
                    entries: panel.entries.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <Trash2 size={16} /> Remove option
              </button>
            </div>
          ))}
        </div>
        <div className="form-row">
          <button
            type="button"
            className="button button-ghost"
            disabled={panel.entries.length >= 25}
            onClick={() =>
              setPanel({
                ...panel,
                entries: [
                  ...panel.entries,
                  { roleId: '', label: 'Role', emoji: '🔘', enabled: true },
                ],
              })
            }
          >
            <Plus size={16} /> Add role option
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              feature.save({
                action: 'panel',
                ...panel,
                entries: panel.entries,
              })
            }
          >
            <Send size={16} /> Publish role panel
          </button>
        </div>
      </Card>
    </FeatureFrame>
  );
}

function GiveawaysPage() {
  const feature = useFeature('giveaways');
  const [form, setForm] = useState({
    prize: '',
    channelId: '',
    winners: 1,
    endsAt: '',
    requiredRoleId: '',
  });
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  return (
    <FeatureFrame
      icon={Gift}
      title="Giveaways"
      description={CONFIG_TITLES.giveaways[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card
          title="Start a giveaway"
          description="State is stored in PostgreSQL and recovered by the bot."
        >
          <Field label="Prize">
            <input value={form.prize} onChange={set('prize')} />
          </Field>
          <SelectField
            label="Channel"
            value={form.channelId}
            onChange={(value) => setForm({ ...form, channelId: value })}
            options={feature.data?.channels || []}
          />
          <div className="form-row">
            <Field label="Winners">
              <input
                type="number"
                min="1"
                value={form.winners}
                onChange={set('winners')}
              />
            </Field>
            <Field label="Ends at">
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={set('endsAt')}
              />
            </Field>
          </div>
          <Field label="Required role id">
            <input
              value={form.requiredRoleId}
              onChange={set('requiredRoleId')}
            />
          </Field>
          <button
            type="button"
            className="button"
            onClick={() =>
              feature.save({
                ...form,
                endsAt: new Date(form.endsAt).toISOString(),
              })
            }
          >
            <Gift size={16} /> Start giveaway
          </button>
        </Card>
        <Card title="History" description="Entries and winners are persisted.">
          {!feature.data ? (
            <Skeleton height={240} />
          ) : feature.data.giveaways.length ? (
            <ul className="list">
              {feature.data.giveaways.map((giveaway) => (
                <li key={giveaway.id}>
                  <div className="list-main">
                    <strong>{giveaway.prize}</strong>
                    <span className="subtle">
                      {giveaway.status} · {giveaway._count.entries} entries
                    </span>
                  </div>
                  <time className="subtle">{formatDate(giveaway.endsAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Gift} title="No giveaways yet" />
          )}
        </Card>
      </div>
    </FeatureFrame>
  );
}

function ApplicationsPage() {
  const feature = useFeature('applications');
  const [form, setForm] = useState({
    title: 'Staff application',
    description: '',
    destinationChannelId: '',
    reviewRoleId: '',
    enabled: false,
    questions: [
      { label: 'About you', prompt: 'Tell us about yourself.', required: true },
    ],
  });
  useEffect(() => {
    const saved = feature.data?.forms?.[0];
    if (saved) {
      setForm({
        id: saved.id,
        title: saved.title,
        description: saved.description,
        destinationChannelId: saved.destinationChannelId || '',
        reviewRoleId: saved.reviewRoleId || '',
        enabled: saved.enabled,
        questions: saved.questions?.length
          ? saved.questions.map(({ label, prompt, required }) => ({
              label,
              prompt,
              required,
            }))
          : [{ label: 'About you', prompt: 'Tell us about yourself.', required: true }],
      });
    }
  }, [feature.data]);
  const updateQuestion = (index, key, value) =>
    setForm({
      ...form,
      questions: form.questions.map((q, i) =>
        i === index ? { ...q, [key]: value } : q,
      ),
    });
  return (
    <FeatureFrame
      icon={ClipboardList}
      title="Applications"
      description={CONFIG_TITLES.applications[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card
          title="Application form"
          description="Discord users submit through a modal."
        >
          <Toggle
            label="Enable form"
            checked={form.enabled}
            onChange={(value) => setForm({ ...form, enabled: value })}
          />
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field label="Description">
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <SelectField
            label="Destination channel"
            value={form.destinationChannelId}
            onChange={(value) =>
              setForm({ ...form, destinationChannelId: value })
            }
            options={feature.data?.channels || []}
          />
          <Field label="Review role id">
            <input
              value={form.reviewRoleId}
              onChange={(event) =>
                setForm({ ...form, reviewRoleId: event.target.value })
              }
            />
          </Field>
          {form.questions.map((question, index) => (
            <div className="category-card" key={index}>
              <Field label={`Question ${index + 1}`}>
                <input
                  value={question.label}
                  onChange={(event) =>
                    updateQuestion(index, 'label', event.target.value)
                  }
                />
              </Field>
              <Field label="Prompt">
                <textarea
                  rows="2"
                  value={question.prompt}
                  onChange={(event) =>
                    updateQuestion(index, 'prompt', event.target.value)
                  }
                />
              </Field>
              <Toggle
                label="Required"
                checked={question.required}
                onChange={(value) => updateQuestion(index, 'required', value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="button button-ghost"
            disabled={form.questions.length >= 5}
            onClick={() =>
              setForm({
                ...form,
                questions: [
                  ...form.questions,
                  { label: 'Question', prompt: 'Your answer', required: true },
                ],
              })
            }
          >
            <Plus size={16} /> Add question
          </button>
          <button
            type="button"
            className="button"
            disabled={feature.saving}
            onClick={() => feature.save(form)}
          >
            <Save size={16} /> Save form
          </button>
          <button
            type="button"
            className="button button-ghost"
            disabled={feature.saving}
            onClick={() => feature.save({ ...form, publish: true })}
          >
            <Send size={16} /> Publish form
          </button>
        </Card>
        <Card
          title="Submissions"
          description="Approve or reject applications with an audit trail."
        >
          {!feature.data ? (
            <Skeleton height={240} />
          ) : feature.data.forms.flatMap((item) => item.submissions || [])
              .length ? (
            feature.data.forms
              .flatMap((item) => item.submissions || [])
              .map((submission) => (
                <div className="case" key={submission.id}>
                  <div>
                    <strong>
                      #{submission.id} · {submission.status}
                    </strong>
                    <span className="subtle block">{submission.userId}</span>
                  </div>
                  <div className="form-row">
                    <button
                      type="button"
                      className="button button-small"
                      onClick={() =>
                        feature.save({
                          action: 'review',
                          id: submission.id,
                          status: 'APPROVED',
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() =>
                        feature.save({
                          action: 'review',
                          id: submission.id,
                          status: 'REJECTED',
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
          ) : (
            <EmptyState icon={ClipboardList} title="No submissions yet" />
          )}
        </Card>
      </div>
    </FeatureFrame>
  );
}

function RemindersPage() {
  const feature = useFeature('reminders');
  const [form, setForm] = useState({
    message: '',
    channelId: '',
    dueAt: '',
    recurrence: '',
  });
  async function remove(id) {
    try {
      await guildApi(feature.guild?.id, 'reminders', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await feature.reload();
    } catch (error) {
      feature.notify?.(error.message, 'error');
    }
  }
  return (
    <FeatureFrame
      icon={BellRing}
      title="Reminders"
      description={CONFIG_TITLES.reminders[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card
          title="Create reminder"
          description="The bot delivers it after a restart too."
        >
          <Field label="Message">
            <textarea
              rows="4"
              value={form.message}
              onChange={(event) =>
                setForm({ ...form, message: event.target.value })
              }
            />
          </Field>
          <SelectField
            label="Channel"
            value={form.channelId}
            onChange={(value) => setForm({ ...form, channelId: value })}
            options={feature.data?.channels || []}
          />
          <Field label="When">
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) =>
                setForm({ ...form, dueAt: event.target.value })
              }
            />
          </Field>
          <Field label="Repeat">
            <select
              value={form.recurrence}
              onChange={(event) =>
                setForm({ ...form, recurrence: event.target.value })
              }
            >
              <option value="">Once</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <button
            type="button"
            className="button"
            onClick={() =>
              feature.save({
                ...form,
                dueAt: new Date(form.dueAt).toISOString(),
              })
            }
          >
            <BellRing size={16} /> Schedule
          </button>
        </Card>
        <Card title="Pending reminders">
          {!feature.data ? (
            <Skeleton height={200} />
          ) : feature.data.reminders.length ? (
            <ul className="list">
              {feature.data.reminders.map((reminder) => (
                <li key={reminder.id}>
                  <div className="list-main">
                    <strong>{reminder.message}</strong>
                    <span className="subtle">
                      {formatDate(reminder.dueAt)} ·{' '}
                      {reminder.recurrence || 'once'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    onClick={() => remove(reminder.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={BellRing} title="No pending reminders" />
          )}
        </Card>
      </div>
    </FeatureFrame>
  );
}

function EmbedBuilderPage() {
  const feature = useFeature('embeds');
  const [form, setForm] = useState({
    name: 'Welcome embed',
    channelId: '',
    title: '',
    description: '',
    color: MELLUNE_DEFAULT_EMBED_COLOR,
    fields: [],
  });
  const payload = {
    title: form.title,
    description: form.description,
    color: form.color,
    fields: form.fields,
  };
  return (
    <FeatureFrame
      icon={Hammer}
      title="Embeds"
      description={CONFIG_TITLES.embeds[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card
          title="Builder"
          description="Placeholders are rendered server-side before sending."
        >
          <Field label="Saved name">
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field>
          <SelectField
            label="Send to channel"
            value={form.channelId}
            onChange={(value) => setForm({ ...form, channelId: value })}
            options={feature.data?.channels || []}
          />
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field label="Description">
            <textarea
              rows="5"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={form.color}
              onChange={(event) =>
                setForm({ ...form, color: event.target.value })
              }
            />
          </Field>
          {form.fields.map((field, index) => (
            <div className="category-card" key={index}>
              <Field label="Field name">
                <input
                  value={field.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fields: form.fields.map((item, i) =>
                        i === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Value">
                <textarea
                  rows="2"
                  value={field.value}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fields: form.fields.map((item, i) =>
                        i === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
              <Toggle
                label="Inline"
                checked={field.inline}
                onChange={(value) =>
                  setForm({
                    ...form,
                    fields: form.fields.map((item, i) =>
                      i === index ? { ...item, inline: value } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              setForm({
                ...form,
                fields: [
                  ...form.fields,
                  { name: 'Field', value: 'Value', inline: false },
                ],
              })
            }
          >
            <Plus size={16} /> Add field
          </button>
          <div className="form-row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => feature.save({ name: form.name, payload })}
            >
              <Save size={16} /> Save
            </button>
            <button
              type="button"
              className="button"
              onClick={() =>
                feature.save({
                  action: 'send',
                  channelId: form.channelId,
                  payload,
                })
              }
            >
              <Send size={16} /> Send test
            </button>
          </div>
        </Card>
        <Card title="Preview">
          <div className="embed-preview" style={{ '--accent': form.color }}>
            <h3>{form.title || 'Embed title'}</h3>
            <p>{form.description || 'Your embed description.'}</p>
            {form.fields.map((field, index) => (
              <div key={index}>
                <strong>{field.name}</strong>
                <p>{field.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </FeatureFrame>
  );
}

function AnnouncementsPage() {
  const feature = useFeature('announcements');
  const [form, setForm] = useState({
    channelId: '',
    content: '',
    title: '',
    description: '',
    scheduledAt: '',
    allowEveryone: false,
    allowHere: false,
    roleId: '',
  });
  return (
    <FeatureFrame
      icon={Megaphone}
      title="Announcements"
      description={CONFIG_TITLES.announcements[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <Card
        title="Announcement composer"
        description="Mass mentions are opt-in and sent through the bot queue."
      >
        <SelectField
          label="Channel"
          value={form.channelId}
          onChange={(value) => setForm({ ...form, channelId: value })}
          options={feature.data?.channels || []}
        />
        <Field label="Message">
          <textarea
            rows="4"
            value={form.content}
            onChange={(event) =>
              setForm({ ...form, content: event.target.value })
            }
          />
        </Field>
        <div className="form-row">
          <Field label="Embed title">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field label="Schedule">
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) =>
                setForm({ ...form, scheduledAt: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Embed description">
          <textarea
            rows="3"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Toggle
          label="Allow @everyone / @here"
          description="Explicitly opt in only when you intend to ping everyone."
          checked={form.allowEveryone || form.allowHere}
          onChange={(value) =>
            setForm({ ...form, allowEveryone: value, allowHere: value })
          }
        />
        <Field label="Optional role id">
          <input
            value={form.roleId}
            onChange={(event) =>
              setForm({ ...form, roleId: event.target.value })
            }
          />
        </Field>
        <div className="form-row">
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              feature.save({
                ...form,
                payload: {
                  title: form.title,
                  description: form.description,
                  color: MELLUNE_DEFAULT_EMBED_COLOR,
                },
              })
            }
          >
            <Save size={16} /> Save / schedule
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              feature.save({
                ...form,
                action: 'send',
                payload: {
                  title: form.title,
                  description: form.description,
                  color: MELLUNE_DEFAULT_EMBED_COLOR,
                },
              })
            }
          >
            <Send size={16} /> Send now
          </button>
        </div>
      </Card>
    </FeatureFrame>
  );
}

function InteractionsPage() {
  const feature = useFeature('interactions');
  const [form, setForm] = useState({
    name: 'Server actions',
    channelId: '',
    content: '',
    buttons: [
      {
        label: 'Say hello',
        style: 'PRIMARY',
        actionType: 'REPLY',
        actionValue: 'Hello!',
      },
    ],
  });
  return (
    <FeatureFrame
      icon={MousePointerClick}
      title="Interactions"
      description={CONFIG_TITLES.interactions[1]}
      error={feature.error}
      reload={feature.reload}
    >
      <Card
        title="Button panel"
        description="Published buttons are backed by persistent database definitions."
      >
        <Field label="Name">
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <SelectField
          label="Channel"
          value={form.channelId}
          onChange={(value) => setForm({ ...form, channelId: value })}
          options={feature.data?.channels || []}
        />
        <Field label="Message">
          <textarea
            rows="3"
            value={form.content}
            onChange={(event) =>
              setForm({ ...form, content: event.target.value })
            }
          />
        </Field>
        {form.buttons.map((button, index) => (
          <div className="category-card" key={index}>
            <div className="form-row">
              <Field label="Label">
                <input
                  value={button.label}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      buttons: form.buttons.map((item, i) =>
                        i === index
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Action">
                <select
                  value={button.actionType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      buttons: form.buttons.map((item, i) =>
                        i === index
                          ? { ...item, actionType: event.target.value }
                          : item,
                      ),
                    })
                  }
                >
                  <option>REPLY</option>
                  <option>ROLE_ADD</option>
                  <option>ROLE_REMOVE</option>
                </select>
              </Field>
            </div>
            <Field label="Action value">
              <input
                value={button.actionValue}
                onChange={(event) =>
                  setForm({
                    ...form,
                    buttons: form.buttons.map((item, i) =>
                      i === index
                        ? { ...item, actionValue: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
          </div>
        ))}
        <div className="form-row">
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              setForm({
                ...form,
                buttons: [
                  ...form.buttons,
                  {
                    label: 'New button',
                    style: 'SECONDARY',
                    actionType: 'REPLY',
                    actionValue: 'Done.',
                  },
                ],
              })
            }
          >
            <Plus size={16} /> Add button
          </button>
          <button
            type="button"
            className="button"
            onClick={() => feature.save({ ...form, publish: true })}
          >
            <Send size={16} /> Publish panel
          </button>
        </div>
      </Card>
    </FeatureFrame>
  );
}

function SuggestionsPage() {
  const feature = useFeature('suggestions');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.settings);
  }, [feature.data]);
  if (!form)
    return (
      <FeatureFrame
        icon={Lightbulb}
        title="Suggestions"
        description={CONFIG_TITLES.suggestions[1]}
        error={feature.error}
        reload={feature.reload}
      >
        <Skeleton height={300} />
      </FeatureFrame>
    );
  return (
    <FeatureFrame
      icon={Lightbulb}
      title="Suggestions"
      description={CONFIG_TITLES.suggestions[1]}
      error={feature.error}
      reload={feature.reload}
      actions={
        <SaveButton
          saving={feature.saving}
          onClick={() =>
            feature.save({
              enabled: form.enabled,
              channelId: form.channelId,
              staffRoleId: form.staffRoleId,
            })
          }
        />
      }
    >
      <Card
        title="Suggestion channel"
        description="Messages sent to this channel become persistent suggestions with ✅/❌ reactions."
      >
        <Toggle
          label="Enable suggestions"
          checked={form.enabled}
          onChange={(value) => setForm({ ...form, enabled: value })}
        />
        <SelectField
          label="Channel"
          value={form.channelId}
          onChange={(value) => setForm({ ...form, channelId: value })}
          options={feature.data.channels || []}
        />
        <Field label="Review role id">
          <input
            value={form.staffRoleId || ''}
            onChange={(event) =>
              setForm({ ...form, staffRoleId: event.target.value })
            }
          />
        </Field>
      </Card>
      <Card title="Recent suggestions">
        {feature.data.suggestions.length ? (
          <ul className="list">
            {feature.data.suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <div className="list-main">
                  <strong>
                    #{suggestion.id} · {suggestion.status}
                  </strong>
                  <span className="subtle clamp">{suggestion.content}</span>
                </div>
                <select
                  value={suggestion.status}
                  onChange={(event) =>
                    feature.save({
                      action: 'review',
                      id: suggestion.id,
                      status: event.target.value,
                    })
                  }
                >
                  <option>PENDING</option>
                  <option>APPROVED</option>
                  <option>REJECTED</option>
                  <option>IMPLEMENTED</option>
                </select>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Lightbulb} title="No suggestions yet" />
        )}
      </Card>
    </FeatureFrame>
  );
}

function AnalyticsPage() {
  const feature = useFeature('analytics');
  return (
    <FeatureFrame
      icon={ChartColumn}
      title="Analytics"
      description={CONFIG_TITLES.analytics[1]}
      error={feature.error}
      reload={feature.reload}
    >
      {!feature.data ? (
        <Skeleton height={360} />
      ) : (
        <>
          <section className="stats">
            {Object.entries(feature.data.totals)
              .slice(0, 4)
              .map(([label, value]) => (
                <article className="card stat" key={label}>
                  <div>
                    <div className="stat-label">{label}</div>
                    <div className="stat-value">{value.toLocaleString()}</div>
                  </div>
                </article>
              ))}
          </section>
          <Card
            title="Measured activity"
            description="Only activity events stored by Mellune are included."
          >
            <ActivityChart
              series={feature.data.series}
              range={feature.data.range}
            />
          </Card>
        </>
      )}
    </FeatureFrame>
  );
}

export default function FeatureModule({ section }) {
  const Component = {
    automod: AutomodPage,
    'raid-protection': RaidPage,
    logs: LogsPage,
    roles: RolesPage,
    verification: VerificationPage,
    'temporary-voice': TemporaryVoicePage,
    giveaways: GiveawaysPage,
    applications: ApplicationsPage,
    reminders: RemindersPage,
    embeds: EmbedBuilderPage,
    announcements: AnnouncementsPage,
    interactions: InteractionsPage,
    analytics: AnalyticsPage,
    suggestions: SuggestionsPage,
  }[section];
  return Component ? <Component /> : <GenericConfig section={section} />;
}
