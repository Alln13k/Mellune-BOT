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
  UserPlus,
  Users,
  HeartPulse,
  Database,
} from 'lucide-react';
import ActivityChart from './ActivityChart';
import ApplicationsInbox from './ApplicationsPage';
import { guildApi, useDashboard, useGuildData } from './DashboardContext';
import { MELLUNE_DEFAULT_EMBED_COLOR } from '../../lib/constants';
import {
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeader,
  RoleMultiSelect,
  RoleSelect,
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
  'voice-presence': Mic,
  reminders: BellRing,
  embeds: Hammer,
  announcements: Megaphone,
  interactions: MousePointerClick,
  analytics: ChartColumn,
  suggestions: Lightbulb,
  'auto-roles': UserPlus,
  'member-counter': Users,
  profiles: Users,
  'server-health': HeartPulse,
  backups: Database,
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
  'voice-presence': [
    'Always-on voice',
    'Keep Mellune in a chosen voice channel and reconnect it automatically.',
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
  'auto-roles': [
    'Auto roles',
    'Assign valid Discord roles automatically when members join.',
  ],
  'member-counter': [
    'Live member counter',
    'Display the real Discord member count in a locked voice channel.',
  ],
  profiles: ['Profiles', 'Real member data, leveling and community activity.'],
  'server-health': [
    'Server health',
    'Real diagnostics for Discord, Mellune configuration and persistence.',
  ],
  backups: ['Backups', 'Persist and safely restore supported server configuration.'],
};

const endpointFor = (section) =>
  section === 'temporary-voice' ? 'temporary-voice' : section;

function SelectField({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="select-control"
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
        <RoleSelect
          label="Verification role"
          value={form.roleId}
          onChange={(value) => setForm({ ...form, roleId: value })}
          roles={feature.data?.roles}
        />
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
        <RoleMultiSelect
          label="Staff roles"
          value={form.staffRoleIds || []}
          onChange={(staffRoleIds) => setForm({ ...form, staffRoleIds })}
          roles={feature.data?.roles}
          hint="Select the roles that can manage private temporary rooms."
        />
      </Card>
      <Card
        title="Active voice rooms"
        description="Persistent ownership records recovered by the bot after restart."
      >
        {feature.data.rooms?.length ? (
          <ul className="list">
            {feature.data.rooms.map((room) => (
              <li key={room.id}>
                <div className="list-main">
                  <strong>{room.channelId}</strong>
                  <span className="subtle">
                    Owner {room.ownerId} · {room.privacy} · limit{' '}
                    {room.userLimit || 'unlimited'}
                  </span>
                </div>
                <time className="subtle">{formatDate(room.createdAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Mic} title="No active voice rooms" />
        )}
      </Card>
    </FeatureFrame>
  );
}

function VoicePresencePage() {
  const feature = useFeature('voice-presence');
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (feature.data) setForm(feature.data.config);
  }, [feature.data]);
  if (!form) {
    return (
      <FeatureFrame icon={Mic} title={CONFIG_TITLES['voice-presence'][0]}
        description={CONFIG_TITLES['voice-presence'][1]} error={feature.error} reload={feature.reload}>
        <Skeleton height={260} />
      </FeatureFrame>
    );
  }
  return (
    <FeatureFrame icon={Mic} title={CONFIG_TITLES['voice-presence'][0]}
      description={CONFIG_TITLES['voice-presence'][1]} error={feature.error} reload={feature.reload}
      actions={<SaveButton saving={feature.saving} onClick={() => feature.save(form)} />}>
      <Card title="Voice presence" description="Saving applies immediately. Mellune stays connected and reconnects if Discord drops the call.">
        <Toggle label="Stay in voice 24/7" checked={form.enabled}
          onChange={(enabled) => setForm({ ...form, enabled })} />
        <SelectField label="Voice channel" value={form.channelId}
          onChange={(channelId) => setForm({ ...form, channelId })}
          options={feature.data.channels || []}
          hint="Pick a voice channel from this server. The bot joins it as soon as you save." />
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
          <RoleSelect
            label="Role"
            value={form.roleId}
            onChange={(value) => setForm({ ...form, roleId: value })}
            roles={feature.data?.roles}
          />
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
                <RoleSelect
                  label="Role"
                  value={entry.roleId}
                  onChange={(value) => updateEntry(index, 'roleId', value)}
                  roles={feature.data?.roles}
                />
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
          <RoleSelect
            label="Required role"
            value={form.requiredRoleId}
            onChange={(value) => setForm({ ...form, requiredRoleId: value })}
            roles={feature.data?.roles}
          />
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

void GiveawaysPage;

function AutoRolesPage() {
  const feature = useFeature('auto-roles');
  const [roleIds, setRoleIds] = useState([]);
  useEffect(() => {
    if (feature.data) setRoleIds(feature.data.config.roleIds || []);
  }, [feature.data]);
  const toggle = (roleId) =>
    setRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId],
    );
  return (
    <FeatureFrame
      icon={UserPlus}
      title={CONFIG_TITLES['auto-roles'][0]}
      description={CONFIG_TITLES['auto-roles'][1]}
      error={feature.error}
      reload={feature.reload}
    >
      <Card title="Auto roles" description="Role hierarchy is checked by the server before saving.">
        {!feature.data ? <Skeleton height={240} /> : (
          <>
            <Toggle
              label="Enable auto roles"
              checked={feature.data.config.enabled}
              onChange={(enabled) =>
                feature.save({ enabled, roleIds, ignoreBots: feature.data.config.ignoreBots })
              }
            />
            <Toggle
              label="Ignore bot accounts"
              checked={feature.data.config.ignoreBots !== false}
              onChange={(ignoreBots) =>
                feature.save({ enabled: feature.data.config.enabled, roleIds, ignoreBots })
              }
            />
            <div className="category-grid">
              {feature.data.roles.map((role) => (
                <label className="category-card" key={role.id}>
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    disabled={!role.assignable}
                    onChange={() => toggle(role.id)}
                  />
                  <strong style={{ color: role.color ? `#${String(role.color).padStart(6, '0')}` : undefined }}>
                    {role.name}
                  </strong>
                  <span className="subtle mono">{role.id}</span>
                  <span className="subtle">
                    {role.assignable ? '✅ Assignable' : `⚠️ ${role.reason}`}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="button"
              disabled={feature.saving}
              onClick={() =>
                feature.save({
                  enabled: feature.data.config.enabled,
                  roleIds,
                  ignoreBots: feature.data.config.ignoreBots !== false,
                })
              }
            >
              <Save size={16} /> Save auto roles
            </button>
          </>
        )}
      </Card>
    </FeatureFrame>
  );
}

function MemberCounterPage() {
  const feature = useFeature('member-counter');
  const [form, setForm] = useState({
    enabled: false,
    categoryId: '',
    format: '👥 Members: {membercount}',
  });
  useEffect(() => {
    if (feature.data?.config) {
      setForm({
        enabled: feature.data.config.enabled,
        categoryId: feature.data.config.categoryId || '',
        format: feature.data.config.format || '👥 Members: {membercount}',
      });
    }
  }, [
    feature.data?.config?.enabled,
    feature.data?.config?.categoryId,
    feature.data?.config?.format,
  ]);
  useEffect(() => {
    if (!feature.data?.config?.enabled) return undefined;
    const timer = setInterval(() => feature.reload(), 15_000);
    return () => clearInterval(timer);
  }, [feature.data?.config?.enabled, feature.reload]);
  const count = feature.data?.count ?? feature.data?.config?.lastCount ?? 0;
  const preview = form.format.replaceAll('{membercount}', Number(count).toLocaleString('en-US'));
  return (
    <FeatureFrame
      icon={Users}
      title={CONFIG_TITLES['member-counter'][0]}
      description={CONFIG_TITLES['member-counter'][1]}
      error={feature.error}
      reload={feature.reload}
    >
      <div className="grid-2">
        <Card title="Counter configuration" description="Only {membercount} is substituted.">
          <Toggle
            label="Enable live member counter"
            checked={form.enabled}
            onChange={(enabled) => setForm({ ...form, enabled })}
          />
          <Field label="Channel category">
            <select
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">Guild root</option>
              {(feature.data?.categories || []).map((category) => (
                <option value={category.id} key={category.id}>▣ {category.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Channel name format" hint="Must contain {membercount}; Discord limits the final name to 100 characters.">
            <input
              value={form.format}
              onChange={(event) => setForm({ ...form, format: event.target.value })}
            />
          </Field>
          <div className="form-row">
            <button type="button" className="button" onClick={() => feature.save(form)} disabled={feature.saving}>
              <Save size={16} /> {feature.saving ? 'Saving…' : 'Save counter'}
            </button>
          </div>
        </Card>
        <Card title="Live preview" description="Updates automatically every 15 seconds from Discord.">
          <div className="discord-message">
            <div className="discord-author"><strong>Voice channel</strong></div>
            <h3>{preview}</h3>
            <p className="subtle">Current count: {Number(count).toLocaleString('en-US')}</p>
            {feature.data?.config?.lastSyncedAt && (
              <p className="subtle">Last synchronized: {formatDate(feature.data.config.lastSyncedAt)}</p>
            )}
          </div>
        </Card>
      </div>
    </FeatureFrame>
  );
}

function ProfilesPage() {
  const feature = useFeature('profiles');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  async function inspect(userId) {
    try {
      const result = await guildApi(feature.guild.id, `profiles/${userId}`);
      setSelected(result.profile);
    } catch (error) {
      feature.notify(error.message, 'error');
    }
  }
  return (
    <FeatureFrame icon={Users} title={CONFIG_TITLES.profiles[0]} description={CONFIG_TITLES.profiles[1]} error={feature.error} reload={feature.reload}>
      <Card title="Member profiles" description="Persisted guild-scoped data only.">
        <div className="form-row">
          <input placeholder="Search username or Discord ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button type="button" className="button button-ghost" onClick={() => feature.reload()}>Search</button>
        </div>
        {!feature.data ? <Skeleton height={240} /> : feature.data.profiles.length ? (
          <ul className="list">
            {feature.data.profiles.filter((profile) => !search || profile.username.toLowerCase().includes(search.toLowerCase()) || profile.userId.includes(search)).map((profile) => (
              <li key={profile.userId}>
                <div className="list-main">
                  <strong>{profile.displayName || profile.username}</strong>
                  <span className="subtle">{profile.username} · {profile.userId}</span>
                </div>
                <span className="subtle">Lv. {profile.level} · {profile.xp.toLocaleString()} XP</span>
                <button type="button" className="button button-small" onClick={() => inspect(profile.userId)}>View</button>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={Users} title="No profiles yet" />}
      </Card>
      {selected && (
        <Card title={selected.user.displayName || selected.user.username} description={`@${selected.user.username} · ${selected.user.userId}`}>
          <div className="stats">
            <div className="card stat"><span className="stat-label">Level</span><span className="stat-value">{selected.level}</span></div>
            <div className="card stat"><span className="stat-label">XP</span><span className="stat-value">{selected.xp.toLocaleString()}</span></div>
            <div className="card stat"><span className="stat-label">Rank</span><span className="stat-value">{selected.rank ? `#${selected.rank}` : '—'}</span></div>
            <div className="card stat"><span className="stat-label">Messages</span><span className="stat-value">{selected.messages.toLocaleString()}</span></div>
          </div>
        </Card>
      )}
    </FeatureFrame>
  );
}

function ServerHealthPage() {
  const feature = useFeature('server-health');
  return (
    <FeatureFrame icon={HeartPulse} title={CONFIG_TITLES['server-health'][0]} description={CONFIG_TITLES['server-health'][1]} error={feature.error} reload={feature.reload}>
      {!feature.data ? <Skeleton height={300} /> : (
        <>
          <section className="stats">
            <div className="card stat"><span className="stat-label">Server health</span><span className="stat-value">{feature.data.score}/100</span></div>
            <div className="card stat"><span className="stat-label">Checks</span><span className="stat-value">{feature.data.checks.length}</span></div>
          </section>
          <Card title="Diagnostics" description="Calculated from live Discord, database and persisted Mellune state.">
            <ul className="list">
              {feature.data.checks.map((check) => (
                <li key={check.key}><div className="list-main"><strong>{check.status === 'HEALTHY' ? '✅' : check.status === 'CRITICAL' ? '🔴' : '⚠️'} {check.label}</strong><span className="subtle">{check.message}</span></div></li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </FeatureFrame>
  );
}

function BackupsPage() {
  const feature = useFeature('backups');
  const [name, setName] = useState('Mellune server backup');
  async function create() {
    await feature.save({ name });
  }
  async function restore(id) {
    if (!window.confirm('Restore this snapshot safely? Existing objects not in the snapshot will not be deleted.')) return;
    await feature.save({ action: 'restore', id });
  }
  async function remove(id) {
    if (!window.confirm('Delete this stored backup? The Discord server will not be changed.')) return;
    await guildApi(feature.guild.id, `backups/${id}`, { method: 'DELETE' });
    await feature.reload();
  }
  return (
    <FeatureFrame icon={Database} title={CONFIG_TITLES.backups[0]} description={CONFIG_TITLES.backups[1]} error={feature.error} reload={feature.reload}>
      <Card title="Create snapshot" description="Stores supported roles, channels and Mellune configuration in PostgreSQL.">
        <div className="form-row"><input value={name} onChange={(event) => setName(event.target.value)} /><button type="button" className="button" onClick={create}>Create backup</button></div>
      </Card>
      <Card title="Snapshots" description="Safe restore never deletes unrelated Discord objects.">
        {!feature.data ? <Skeleton height={220} /> : feature.data.backups.length ? <ul className="list">{feature.data.backups.map((backup) => <li key={backup.id}><div className="list-main"><strong>{backup.name}</strong><span className="subtle">{formatDate(backup.createdAt)} · {backup.summary?.roles || 0} roles · {backup.summary?.channels || 0} channels</span></div><button type="button" className="button button-small" onClick={() => restore(backup.id)}>Restore</button><button type="button" className="button button-small button-ghost" onClick={() => remove(backup.id)}>Delete</button></li>)}</ul> : <EmptyState icon={Database} title="No backups yet" />}
      </Card>
    </FeatureFrame>
  );
}

function CompleteGiveawaysPage() {
  const feature = useFeature('giveaways');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [rerollCount, setRerollCount] = useState(1);
  const [excludePrevious, setExcludePrevious] = useState(true);
  const [form, setForm] = useState({
    prize: '',
    channelId: '',
    winners: 1,
    durationAmount: 30,
    durationUnit: 'minutes',
    description: '',
    embedTitle: 'Giveaway',
    embedDescription: '',
    embedColor: MELLUNE_DEFAULT_EMBED_COLOR,
    thumbnailUrl: '',
    imageUrl: '',
    authorName: '',
    footerText: '',
    timestamp: true,
    buttonLabel: 'Enter Giveaway',
    buttonEmoji: '🎉',
    requiredRoleId: '',
    bonusRoleIds: [],
    minAccountAgeHours: 0,
    minMembershipHours: 0,
  });
  const [entrySearch, setEntrySearch] = useState('');
  const [entryPage, setEntryPage] = useState(1);
  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const choose = async (id, page = 1, search = entrySearch) => {
    setSelectedId(id);
    setEntryPage(page);
    setDetailError('');
    try {
      const result = await guildApi(
        feature.guild.id,
        `giveaways/${id}?page=${page}&search=${encodeURIComponent(search)}`,
      );
      setDetail(result);
      setRerollCount(result.giveaway.winners);
    } catch (error) {
      setDetailError(error.message);
    }
  };
  const create = async () => {
    await feature.save({
      ...form,
      winners: Number(form.winners),
      durationAmount: Number(form.durationAmount),
      minAccountAgeHours: Number(form.minAccountAgeHours),
      minMembershipHours: Number(form.minMembershipHours),
      bonusRoleIds: form.bonusRoleIds,
      action: 'start',
    });
    setForm((current) => ({ ...current, prize: '' }));
  };
  const action = async (payload) => {
    await feature.save(payload);
    await feature.reload();
    if (selectedId) await choose(selectedId, entryPage);
  };
  const deleteGiveaway = async () => {
    if (!selectedId || !window.confirm(
      'Delete Giveaway?\n\nThis permanently removes the giveaway and its stored entries.',
    )) return;
    try {
      await guildApi(feature.guild.id, `giveaways/${selectedId}`, {
        method: 'DELETE',
      });
      feature.notify('Giveaway deleted successfully.');
      setSelectedId(null);
      setDetail(null);
      await feature.reload();
    } catch (error) {
      feature.notify(error.message, 'error');
    }
  };
  const preview = {
    ...form,
    id: 'preview',
    prize: form.prize || 'Your prize',
    winners: Number(form.winners) || 1,
  };
  const active = feature.data?.giveaways?.filter(
    (giveaway) => giveaway.status === 'ACTIVE' || giveaway.status === 'QUEUED',
  ) || [];
  const completed = feature.data?.giveaways?.filter(
    (giveaway) => !active.includes(giveaway),
  ) || [];
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
          title="Create giveaway"
          description="Every field is persisted and used by the Discord message."
        >
          <Field label="Prize">
            <input value={form.prize} onChange={set('prize')} />
          </Field>
          <SelectField
            label="Giveaway channel"
            value={form.channelId}
            onChange={(value) => setForm({ ...form, channelId: value })}
            options={feature.data?.channels || []}
          />
          <div className="form-row">
            <Field label="Winners">
              <input
                type="number"
                min="1"
                max="20"
                value={form.winners}
                onChange={set('winners')}
              />
            </Field>
            <Field label="Duration amount">
              <input
                type="number"
                min="1"
                value={form.durationAmount}
                onChange={set('durationAmount')}
              />
            </Field>
            <Field label="Unit">
              <select value={form.durationUnit} onChange={set('durationUnit')}>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea rows="3" value={form.description} onChange={set('description')} />
          </Field>
          <div className="form-row">
            <Field label="Embed title">
              <input value={form.embedTitle} onChange={set('embedTitle')} />
            </Field>
            <Field label="Embed color">
              <input type="color" value={form.embedColor} onChange={set('embedColor')} />
            </Field>
          </div>
          <Field label="Embed description">
            <textarea rows="2" value={form.embedDescription} onChange={set('embedDescription')} />
          </Field>
          <div className="form-row">
            <Field label="Thumbnail URL">
              <input type="url" value={form.thumbnailUrl} onChange={set('thumbnailUrl')} />
            </Field>
            <Field label="Image URL">
              <input type="url" value={form.imageUrl} onChange={set('imageUrl')} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Author">
              <input value={form.authorName} onChange={set('authorName')} />
            </Field>
            <Field label="Footer">
              <input value={form.footerText} onChange={set('footerText')} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Entry button text">
              <input value={form.buttonLabel} onChange={set('buttonLabel')} />
            </Field>
            <Field label="Button emoji">
              <input value={form.buttonEmoji} onChange={set('buttonEmoji')} />
            </Field>
          </div>
          <RoleSelect
            label="Required role"
            hint="Optional. Eligibility is checked by the bot when the button is clicked."
            value={form.requiredRoleId}
            onChange={(value) => setForm((current) => ({ ...current, requiredRoleId: value }))}
            roles={feature.data?.roles}
          />
          <RoleMultiSelect
            label="Bonus roles"
            hint="Each selected role adds one weighted entry."
            value={form.bonusRoleIds}
            onChange={(bonusRoleIds) => setForm((current) => ({ ...current, bonusRoleIds }))}
            roles={feature.data?.roles}
          />
          <div className="form-row">
            <Field label="Minimum account age (hours)">
              <input type="number" min="0" value={form.minAccountAgeHours} onChange={set('minAccountAgeHours')} />
            </Field>
            <Field label="Minimum server membership (hours)">
              <input type="number" min="0" value={form.minMembershipHours} onChange={set('minMembershipHours')} />
            </Field>
          </div>
          <Toggle
            label="Show embed timestamp"
            checked={form.timestamp}
            onChange={(value) => setForm({ ...form, timestamp: value })}
          />
          <div className="form-row">
            <button type="button" className="button button-ghost" onClick={() => feature.notify('Live preview updated from the current form.')}>
              Test giveaway embed
            </button>
            <button type="button" className="button" onClick={create} disabled={feature.saving}>
              <Gift size={16} /> {feature.saving ? 'Creating…' : 'Create giveaway'}
            </button>
          </div>
        </Card>
        <Card title="Live Discord preview" description="This preview updates as you edit the form.">
          <div
            className="discord-message giveaway-preview"
            style={{ borderLeft: `4px solid ${preview.embedColor}` }}
          >
            <div className="discord-author">
              <strong>{preview.authorName || 'Mellune'}</strong>
              <span className="bot-tag">BOT</span>
            </div>
            <h3>{`🎉 ${preview.embedTitle || 'Giveaway'}`}</h3>
            <p>
              {preview.description || 'Your giveaway description'}
              {preview.embedDescription && <><br />{preview.embedDescription}</>}
            </p>
            <p>
              🎁 Prize: <strong>{preview.prize}</strong><br />
              🏆 Winners: <strong>{preview.winners}</strong><br />
              ⏰ Ends: calculated from {preview.durationAmount || 0} {preview.durationUnit}<br />
              👥 Entries: <strong>0</strong>
            </p>
            {preview.imageUrl && <img src={preview.imageUrl} alt="" style={{ maxWidth: '100%' }} />}
            {preview.thumbnailUrl && <img src={preview.thumbnailUrl} alt="" style={{ maxWidth: '96px' }} />}
            <button type="button" className="button button-small" disabled>
              {preview.buttonEmoji} {preview.buttonLabel}
            </button>
            <p className="subtle">{preview.footerText || 'Mellune giveaway'}</p>
          </div>
        </Card>
      </div>
      <div className="grid-2">
        <Card title="Active giveaways" description="Queued and active records from PostgreSQL.">
          {!feature.data ? <Skeleton height={180} /> : active.length ? (
            <ul className="list">
              {active.map((giveaway) => (
                <li key={giveaway.id}>
                  <button type="button" className="list-main" onClick={() => choose(giveaway.id)}>
                    <strong>{giveaway.prize}</strong>
                    <span className="subtle">
                      {giveaway.status} · {giveaway._count.entries} entries · {giveaway.winners} winners
                    </span>
                  </button>
                  <time className="subtle">{formatDate(giveaway.endsAt)}</time>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Gift} title="No active giveaways" />}
        </Card>
        <Card title="Completed giveaways" description="History remains available after the winner announcement.">
          {!feature.data ? <Skeleton height={180} /> : completed.length ? (
            <ul className="list">
              {completed.map((giveaway) => (
                <li key={giveaway.id}>
                  <button type="button" className="list-main" onClick={() => choose(giveaway.id)}>
                    <strong>{giveaway.prize}</strong>
                    <span className="subtle">
                      {giveaway.status} · {giveaway._count.entries} entries · {giveaway.winners} winners
                    </span>
                  </button>
                  <time className="subtle">{formatDate(giveaway.endsAt)}</time>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Gift} title="No completed giveaways" />}
        </Card>
      </div>
      {selectedId && (
        <Card
          title={`Giveaway #${selectedId}`}
          description={detailError || 'Guild-scoped details and persisted entries.'}
          action={
            <div className="form-row">
              {detail?.giveaway?.status === 'ACTIVE' && (
                <button type="button" className="button button-ghost" onClick={() => action({ action: 'end', id: selectedId })}>
                  End giveaway
                </button>
              )}
              {detail?.giveaway?.status === 'ENDED' && (
                <>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={rerollCount}
                    onChange={(event) => setRerollCount(event.target.value)}
                    aria-label="Reroll winner count"
                  />
                  <label className="field-hint">
                    <input
                      type="checkbox"
                      checked={excludePrevious}
                      onChange={(event) => setExcludePrevious(event.target.checked)}
                    /> Exclude previous winners
                  </label>
                  <button type="button" className="button button-ghost" onClick={() => action({ action: 'reroll', id: selectedId, count: Number(rerollCount), excludePrevious })}>
                    Reroll winners
                  </button>
                </>
              )}
              <button type="button" className="button button-ghost" onClick={deleteGiveaway}>
                Delete giveaway
              </button>
            </div>
          }
        >
          {!detail ? <Skeleton height={180} /> : (
            <>
              <div className="details">
                <div><dt>Status</dt><dd>{detail.giveaway.status} · Discord {detail.giveaway.discordStatus}</dd></div>
                <div><dt>Creator</dt><dd className="mono">{detail.giveaway.startedBy || 'Unknown'}</dd></div>
                <div><dt>Channel</dt><dd className="mono">{detail.giveaway.channelId}</dd></div>
                <div><dt>Message</dt><dd className="mono">{detail.giveaway.messageId || 'Not sent yet'}</dd></div>
                <div><dt>Entries</dt><dd>{detail.giveaway._count.entries}</dd></div>
                <div><dt>Winners</dt><dd>{detail.giveaway.winners}</dd></div>
                <div><dt>Duration</dt><dd>{detail.giveaway.durationSeconds}s</dd></div>
                <div><dt>Created</dt><dd>{formatDate(detail.giveaway.createdAt)}</dd></div>
                <div><dt>Start</dt><dd>{formatDate(detail.giveaway.startAt)}</dd></div>
                <div><dt>End</dt><dd>{formatDate(detail.giveaway.endsAt)}</dd></div>
                {detail.giveaway.discordError && (
                  <div><dt>Discord error</dt><dd>{detail.giveaway.discordError}</dd></div>
                )}
              </div>
              <div className="form-row">
                <input
                  placeholder="Search by Discord user ID"
                  value={entrySearch}
                  onChange={(event) => setEntrySearch(event.target.value)}
                />
                <button type="button" className="button button-ghost" onClick={() => choose(selectedId, 1, entrySearch)}>
                  Refresh entries
                </button>
              </div>
              {detail.entries.length ? (
                <ul className="list">
                  {detail.entries.map((entry) => (
                    <li key={entry.id}>
                      <div className="list-main">
                        {entry.user.avatar ? (
                          <img className="avatar" src={`https://cdn.discordapp.com/avatars/${entry.user.id}/${entry.user.avatar}.png?size=64`} alt="" width="32" height="32" />
                        ) : null}
                        <strong>{entry.user.displayName}</strong>
                        <span className="subtle">{entry.user.username} · {entry.user.id} · {formatDate(entry.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={Gift} title="No entries yet" />}
              <div className="form-row">
                <button type="button" className="button button-ghost" disabled={entryPage <= 1} onClick={() => choose(selectedId, entryPage - 1)}>Previous</button>
                <span className="subtle">Page {detail.pagination.page} / {detail.pagination.pages}</span>
                <button type="button" className="button button-ghost" disabled={entryPage >= detail.pagination.pages} onClick={() => choose(selectedId, entryPage + 1)}>Next</button>
              </div>
            </>
          )}
        </Card>
      )}
    </FeatureFrame>
  );
}

function ApplicationsPage() {
  return <ApplicationsInbox />;
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
        <RoleSelect
          label="Optional role"
          value={form.roleId}
          onChange={(value) => setForm({ ...form, roleId: value })}
          roles={feature.data?.roles}
        />
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
        <RoleSelect
          label="Review role"
          value={form.staffRoleId}
          onChange={(value) => setForm({ ...form, staffRoleId: value })}
          roles={feature.data?.roles}
        />
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
  const [range, setRange] = useState('7d');
  const [rangeLoading, setRangeLoading] = useState(false);
  async function changeRange(value) {
    setRange(value);
    if (!feature.guild?.id) return;
    setRangeLoading(true);
    try {
      const data = await guildApi(
        feature.guild.id,
        `analytics?range=${encodeURIComponent(value)}`,
      );
      feature.setData(data);
    } catch (error) {
      feature.notify(error.message, 'error');
    } finally {
      setRangeLoading(false);
    }
  }
  const metrics = [
    ['members', 'Current members'],
    ['activeMembers', 'Active members'],
    ['messages', 'Messages'],
    ['joins', 'Joins'],
    ['tickets', 'Tickets'],
    ['moderation', 'Moderation actions'],
  ];
  return (
    <FeatureFrame
      icon={ChartColumn}
      title="Analytics"
      description={CONFIG_TITLES.analytics[1]}
      error={feature.error}
      reload={() => changeRange(range)}
      actions={
        <div className="segmented" role="group" aria-label="Analytics time range">
          {['24h', '7d', '30d'].map((value) => (
            <button
              type="button"
              key={value}
              className={range === value ? 'is-active' : ''}
              aria-pressed={range === value}
              disabled={rangeLoading}
              onClick={() => changeRange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      }
    >
      {!feature.data ? (
        <Skeleton height={360} />
      ) : (
        <>
          <section className="stats">
            {metrics.map(([key, label]) => {
              const value = feature.data.totals[key];
              return (
                <article className="card stat" key={key}>
                  <div>
                    <div className="stat-label">{label}</div>
                    <div className="stat-value">
                      {value == null ? 'Unavailable' : value.toLocaleString()}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          <Card
            title={`Measured activity · ${feature.data.range}`}
            description="Charts use events Mellune has actually recorded; current members come from Discord."
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
    'voice-presence': VoicePresencePage,
    giveaways: CompleteGiveawaysPage,
    applications: ApplicationsPage,
    reminders: RemindersPage,
    embeds: EmbedBuilderPage,
    announcements: AnnouncementsPage,
    interactions: InteractionsPage,
    analytics: AnalyticsPage,
    suggestions: SuggestionsPage,
    'auto-roles': AutoRolesPage,
    'member-counter': MemberCounterPage,
    profiles: ProfilesPage,
    'server-health': ServerHealthPage,
    backups: BackupsPage,
  }[section];
  return Component ? <Component /> : <GenericConfig section={section} />;
}
