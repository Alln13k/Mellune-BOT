'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Copy, Save, Send, Trash2 } from 'lucide-react';
import { guildApi, useDashboard } from './DashboardContext';
import { MELLUNE_DEFAULT_EMBED_COLOR } from '../../lib/constants';
import { TIMEZONES, dateKey, wallFields } from '../../services/events/eventLogic';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeader,
  RoleMultiSelect,
  SelectField,
  Skeleton,
  Toggle,
} from './ui';

const BUCKETS = [
  ['upcoming', 'Upcoming'],
  ['live', 'Live'],
  ['past', 'Past'],
  ['drafts', 'Drafts'],
  ['scheduled', 'Scheduled'],
  ['cancelled', 'Cancelled'],
  ['calendar', 'Calendar'],
];
const CAPACITIES = [
  { id: '', name: 'Unlimited' },
  { id: '10', name: '10 spots' },
  { id: '25', name: '25 spots' },
  { id: '50', name: '50 spots' },
  { id: '100', name: '100 spots' },
  { id: 'custom', name: 'Custom' },
];
const REMINDERS = [
  [1440, '24 hours before'],
  [60, '1 hour before'],
  [15, '15 minutes before'],
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const blankForm = () => ({
  name: '',
  description: '',
  date: '',
  time: '',
  endDate: '',
  endTime: '',
  timezone: 'UTC',
  channelId: '',
  location: '',
  capacityChoice: '',
  customCapacity: '',
  color: MELLUNE_DEFAULT_EMBED_COLOR,
  imageUrl: '',
  rsvpEnabled: true,
  threadEnabled: false,
  recurrence: 'NONE',
  weekdays: [],
  roleIds: [],
  roleMode: 'ANY',
  reminders: [{ offsetMinutes: 60, targets: ['DM'], includeTentative: false }],
  publishDate: '',
  publishTime: '',
  kind: 'General',
  templateName: '',
  scope: 'one',
});

function capacityValue(form) {
  if (form.capacityChoice === 'custom') return form.customCapacity || null;
  return form.capacityChoice || null;
}

function payloadFromForm(form, publish) {
  const rest = { ...form };
  for (const key of ['capacityChoice', 'customCapacity', 'startAt', 'endAt', 'publishAt', 'counts', 'attendees', 'logs', 'series', 'storedStatus', 'messageHash']) {
    delete rest[key];
  }
  return {
    ...rest,
    maxAttendees: capacityValue(form),
    publish,
    reminders: form.reminders,
    templateName: form.templateName,
  };
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${String(status || '').toLowerCase()}`}>{status}</span>;
}

export default function EventsPage() {
  const { guild, notify } = useDashboard();
  const [bucket, setBucket] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [calendarMode, setCalendarMode] = useState('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blankForm);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [attendeeTab, setAttendeeTab] = useState('going');

  const load = useCallback(async () => {
    if (!guild?.id) return;
    setLoading(true);
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    try {
      const result = await guildApi(
        guild.id,
        `events?bucket=${bucket}&page=${page}&q=${encodeURIComponent(query)}&month=${month}`,
      );
      setData(result);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [bucket, cursor, guild?.id, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEvent(id) {
    setSelectedId(id);
    setDetail(null);
    const result = await guildApi(guild.id, `events/${id}`);
    setDetail(result.event);
  }

  async function submit(publish) {
    setSaving(true);
    try {
      const result = selectedId && detail
        ? await guildApi(guild.id, `events/${selectedId}`, {
            method: 'POST',
            body: JSON.stringify({ ...payloadFromForm(form, publish), action: 'update' }),
          })
        : await guildApi(guild.id, 'events', {
            method: 'POST',
            body: JSON.stringify(payloadFromForm(form, publish)),
          });
      notify(publish ? 'Event published.' : 'Event saved.');
      if (result.event?.id) await openEvent(result.event.id);
      await load();
    } catch (saveError) {
      notify(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, extra = {}) {
    const result = await guildApi(guild.id, `events/${selectedId}`, {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    });
    if (action === 'delete') {
      setSelectedId(null);
      setDetail(null);
    } else if (result.event) setDetail(result.event);
    else if (action === 'duplicate' && result.event?.id) await openEvent(result.event.id);
    notify('Event updated.');
    setConfirm(null);
    await load();
  }

  function editCurrent() {
    if (!detail) return;
    const start = wallFields(detail.startAt, detail.timezone);
    const end = detail.endAt ? wallFields(detail.endAt, detail.timezone) : { date: '', time: '' };
    const preset = ['', '10', '25', '50', '100'].includes(String(detail.maxAttendees || ''))
      ? String(detail.maxAttendees || '')
      : 'custom';
    setForm({
      ...blankForm(),
      ...detail,
      date: start.date,
      time: start.time,
      endDate: end.date,
      endTime: end.time,
      capacityChoice: preset,
      customCapacity: preset === 'custom' ? detail.maxAttendees || '' : '',
      reminders: detail.reminderConfig || [],
      recurrence: detail.series?.recurrence || 'NONE',
      weekdays: detail.series?.weekdays || [],
    });
    setAdvanced(true);
    setSelectedId(detail.id);
  }

  async function searchMembers() {
    const result = await guildApi(guild.id, `events?members=1&q=${encodeURIComponent(memberQuery)}`);
    setMembers(result.members || []);
  }

  const channels = (data?.channels || []).filter((channel) => channel.type !== 2);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells = monthCells(cursor);
  const stats = data?.stats;

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Events"
        description="Create an event in seconds, then let members RSVP in Discord."
      />
      {error && <ErrorNotice onRetry={load}>{error}</ErrorNotice>}
      {stats && (
        <section className="stats">
          {[
            ['Events', stats.totalEvents],
            ['Upcoming', stats.upcomingEvents],
            ['Attendees', stats.totalAttendees],
            ['Avg attendance', stats.averageAttendance],
            ['Capacity use', `${stats.averageCapacityUsage}%`],
            ['RSVP conversion', `${stats.rsvpConversion}%`],
          ].map(([label, value]) => (
            <article className="card stat" key={label}>
              <div>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
              </div>
            </article>
          ))}
        </section>
      )}
      <Card title="Quick create" description="Name, date, time, channel and capacity are enough.">
        <div className="form-row">
          <Field label="Name">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <SelectField
            label="Channel"
            value={form.channelId}
            onChange={(channelId) => setForm({ ...form, channelId })}
            options={channels}
            getLabel={(channel) => `#${channel.name}`}
          />
        </div>
        <div className="form-row">
          <Field label="Date"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Time"><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></Field>
          <SelectField label="Timezone" value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} options={TIMEZONES.map((zone) => ({ id: zone, name: zone }))} />
          <SelectField label="Capacity" value={form.capacityChoice} onChange={(capacityChoice) => setForm({ ...form, capacityChoice })} options={CAPACITIES} />
        </div>
        {advanced && (
          <div className="event-advanced">
            <Field label="Description">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="End date"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
              <Field label="End time"><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
              <Field label="Location"><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
              <Field label="Type"><input value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} /></Field>
            </div>
            {form.capacityChoice === 'custom' && (
              <Field label="Custom capacity">
                <input type="number" min="1" max="5000" value={form.customCapacity} onChange={(event) => setForm({ ...form, customCapacity: event.target.value })} />
              </Field>
            )}
            <div className="form-row">
              <Field label="Accent">
                <input type="color" value={form.color || MELLUNE_DEFAULT_EMBED_COLOR} onChange={(event) => setForm({ ...form, color: event.target.value })} />
              </Field>
              <Field label="Banner URL"><input value={form.imageUrl || ''} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></Field>
            </div>
            <Toggle label="RSVP" checked={form.rsvpEnabled} onChange={(rsvpEnabled) => setForm({ ...form, rsvpEnabled })} />
            <Toggle label="Create discussion thread" checked={form.threadEnabled} onChange={(threadEnabled) => setForm({ ...form, threadEnabled })} />
            <SelectField label="Repeats" value={form.recurrence} onChange={(recurrence) => setForm({ ...form, recurrence })} options={[
              { id: 'NONE', name: 'Does not repeat' },
              { id: 'DAILY', name: 'Every day' },
              { id: 'WEEKLY', name: 'Every week' },
              { id: 'BIWEEKLY', name: 'Every 2 weeks' },
              { id: 'MONTHLY', name: 'Every month' },
              { id: 'CUSTOM', name: 'Custom weekdays' },
            ]} />
            {form.recurrence === 'CUSTOM' && (
              <div className="weekday-row">
                {WEEKDAYS.map((label, index) => (
                  <button type="button" key={label} className={`button button-small ${form.weekdays.includes(index) ? '' : 'button-ghost'}`} onClick={() => {
                    const weekdays = form.weekdays.includes(index)
                      ? form.weekdays.filter((day) => day !== index)
                      : [...form.weekdays, index];
                    setForm({ ...form, weekdays });
                  }}>{label}</button>
                ))}
              </div>
            )}
            <div className="form-row">
              <Field label="Publish date"><input type="date" value={form.publishDate} onChange={(event) => setForm({ ...form, publishDate: event.target.value })} /></Field>
              <Field label="Publish time"><input type="time" value={form.publishTime} onChange={(event) => setForm({ ...form, publishTime: event.target.value })} /></Field>
            </div>
            <p className="subtle">Reminders go to members marked Going.</p>
            {REMINDERS.map(([offset, label]) => {
              const selected = form.reminders.some((reminder) => reminder.offsetMinutes === offset);
              return (
                <Toggle key={offset} label={label} checked={selected} onChange={(checked) => {
                  const reminders = checked
                    ? [...form.reminders, { offsetMinutes: offset, targets: ['DM'], includeTentative: false }]
                    : form.reminders.filter((reminder) => reminder.offsetMinutes !== offset);
                  setForm({ ...form, reminders });
                }} />
              );
            })}
            <Toggle label="Also remind tentative members" checked={form.reminders.some((reminder) => reminder.includeTentative)} onChange={(includeTentative) => setForm({
              ...form,
              reminders: form.reminders.map((reminder) => ({ ...reminder, includeTentative })),
            })} />
            <RoleMultiSelect label="Required roles" roles={data?.roles || []} value={form.roleIds} onChange={(roleIds) => setForm({ ...form, roleIds })} />
            <SelectField label="Role rule" value={form.roleMode} onChange={(roleMode) => setForm({ ...form, roleMode })} options={[{ id: 'ANY', name: 'Any selected role' }, { id: 'ALL', name: 'All selected roles' }]} />
            {detail?.seriesId && (
              <SelectField label="Apply edits to" value={form.scope} onChange={(scope) => setForm({ ...form, scope })} options={[{ id: 'one', name: 'This occurrence' }, { id: 'series', name: 'Entire series' }]} />
            )}
            <div className="form-row">
              <Field label="Template name"><input value={form.templateName} onChange={(event) => setForm({ ...form, templateName: event.target.value })} /></Field>
              <button type="button" className="button button-ghost" onClick={async () => {
                await guildApi(guild.id, 'events', { method: 'POST', body: JSON.stringify({ ...payloadFromForm(form, false), action: 'template' }) });
                notify('Template saved.');
                await load();
              }}>Save template</button>
            </div>
          </div>
        )}
        <div className="moderation-action-grid">
          <button type="button" className="button button-ghost" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Hide options' : 'More options'}</button>
          <button type="button" className="button button-ghost" disabled={saving} onClick={() => submit(false)}><Save size={16} /> Save draft</button>
          <button type="button" className="button" disabled={saving} onClick={() => submit(true)}><Send size={16} /> {saving ? 'Saving…' : 'Create and publish'}</button>
        </div>
        {!!data?.templates?.length && (
          <SelectField label="Start from a template" value="" onChange={(name) => {
            const template = data.templates.find((item) => item.name === name);
            if (!template) return;
            setForm({ ...form, ...template.payload, templateName: template.name, date: form.date, time: form.time });
            setAdvanced(true);
          }} options={data.templates.map((template) => ({ id: template.name, name: template.name }))} />
        )}
      </Card>
      <div className="weekday-row">
        {BUCKETS.map(([id, label]) => {
          const countKey = { upcoming: 'UPCOMING', live: 'LIVE', past: 'ENDED', drafts: 'DRAFT', scheduled: 'SCHEDULED', cancelled: 'CANCELLED' }[id];
          const count = countKey ? data?.counts?.[countKey] : null;
          return (
            <button type="button" key={id} className={`button button-small ${bucket === id ? '' : 'button-ghost'}`} onClick={() => { setBucket(id); setPage(1); }}>{label}{count ? ` ${count}` : ''}</button>
          );
        })}
      </div>
      <Field label="Search events">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name" />
      </Field>
      {loading && !data ? <Skeleton height={240} /> : null}
      {bucket === 'calendar' ? (
        <Card title={monthLabel} action={(
          <div className="moderation-action-grid">
            <button type="button" className="button button-small button-ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Prev</button>
            <button type="button" className="button button-small button-ghost" onClick={() => setCursor(new Date())}>Today</button>
            <button type="button" className="button button-small button-ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
            {['month', 'week', 'list'].map((mode) => (
              <button type="button" key={mode} className={`button button-small ${calendarMode === mode ? '' : 'button-ghost'}`} onClick={() => setCalendarMode(mode)}>{mode}</button>
            ))}
          </div>
        )}>
          {calendarMode === 'list' ? (
            <EventCards events={data?.calendar || data?.items || []} onOpen={openEvent} />
          ) : (
            <div className="calendar-grid">
              {WEEKDAYS.map((day) => <strong key={day} className="subtle">{day}</strong>)}
              {(calendarMode === 'week' ? weekCells(cursor) : cells).map((cell, index) => (
                <div className="calendar-cell" key={`${cell || 'empty'}-${index}`}>
                  {cell && <span>{Number(cell.slice(-2))}</span>}
                  {(data?.calendar || []).filter((event) => cell && dateKey(event.startAt, event.timezone) === cell).map((event) => (
                    <button type="button" className={`event-chip status-${event.status.toLowerCase()}`} key={event.id} onClick={() => openEvent(event.id)}>{event.name}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <EventCards events={data?.items || []} onOpen={openEvent} />
      )}
      {!!data?.total && (
        <div className="moderation-action-grid">
          <button type="button" className="button button-small button-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span className="subtle">Page {data.page} · {data.total} events</span>
          <button type="button" className="button button-small button-ghost" disabled={data.page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      )}
      {selectedId && (
        <Card title={detail?.name || 'Event'} description="Attendees, waitlist, reminders and history.">
          {!detail ? <Skeleton height={180} /> : (
            <>
              <StatusPill status={detail.status} />
              {detail.imageUrl && <img className="event-banner" src={detail.imageUrl} alt="" />}
              <p>{detail.description}</p>
              <p className="subtle">{new Date(detail.startAt).toLocaleString()} · {detail.timezone} · {detail.location || 'Discord'} · {detail.counts.going}{detail.maxAttendees ? ` / ${detail.maxAttendees}` : ''} going · {detail.counts.waitlist} waiting</p>
              {detail.threadId && <p className="subtle">Thread {detail.threadId}</p>}
              <div className="moderation-action-grid">
                <button type="button" className="button button-small" onClick={editCurrent}>Edit</button>
                <button type="button" className="button button-small" onClick={() => runAction('publish')}>Publish</button>
                <button type="button" className="button button-small button-ghost" onClick={() => runAction('duplicate')}><Copy size={14} /> Duplicate</button>
                <button type="button" className="button button-small button-ghost" onClick={() => runAction('remind')}>Send reminder</button>
                <button type="button" className="button button-small button-ghost" onClick={() => setConfirm('end')}>End early</button>
                <button type="button" className="button button-small button-ghost" onClick={() => setConfirm('cancel')}>Cancel</button>
                {detail.seriesId && <button type="button" className="button button-small button-ghost" onClick={() => setConfirm('cancel-series')}>Cancel series</button>}
                <button type="button" className="button button-small button-danger" onClick={() => setConfirm('delete')}><Trash2 size={14} /> Delete</button>
              </div>
              {confirm && (
                <div className="notice">
                  <span>Confirm {confirm.replace('-', ' ')}? This keeps history unless you delete the event.</span>
                  <button type="button" className="button button-small button-danger" onClick={() => runAction(confirm === 'cancel-series' ? 'cancel' : confirm, confirm === 'cancel-series' ? { scope: 'series' } : {})}>Confirm</button>
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm(null)}>Keep event</button>
                </div>
              )}
              <div className="weekday-row">
                {['going', 'tentative', 'declined', 'waitlist'].map((tab) => (
                  <button type="button" key={tab} className={`button button-small ${attendeeTab === tab ? '' : 'button-ghost'}`} onClick={() => setAttendeeTab(tab)}>{tab} ({detail.attendees[tab].length})</button>
                ))}
              </div>
              {detail.attendees[attendeeTab].length ? detail.attendees[attendeeTab].map((person) => (
                <div className="event-person" key={`${person.id}-${person.position || person.status}`}>
                  <Avatar user={{ id: person.id, username: person.username, global_name: person.displayName, avatar: null }} />
                  {person.avatar && <img className="avatar" src={person.avatar} alt="" width={36} height={36} />}
                  <div>
                    <strong>{person.displayName}</strong>
                    <span className="subtle block">@{person.username} · {person.id} · {person.position ? `Waitlist #${person.position}` : person.status} · {new Date(person.updatedAt).toLocaleString()}</span>
                  </div>
                  <select className="select-control" value={person.status} onChange={(event) => runAction('attendee', { userId: person.id, status: event.target.value })}>
                    <option value="GOING">Going</option>
                    <option value="TENTATIVE">Tentative</option>
                    <option value="DECLINED">Declined</option>
                    <option value="WAITLIST">Waitlist</option>
                    <option value="REMOVE">Remove</option>
                  </select>
                </div>
              )) : <EmptyState icon={CalendarDays} title="No one here yet" />}
              <div className="form-row">
                <Field label="Add a member">
                  <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search the server" />
                </Field>
                <button type="button" className="button button-ghost" onClick={searchMembers}>Search</button>
              </div>
              {members.map((member) => (
                <button type="button" className="event-person" key={member.id} onClick={() => runAction('attendee', { userId: member.id, status: 'GOING' })}>
                  {member.avatar ? <img className="avatar" src={member.avatar} alt="" width={36} height={36} /> : <Avatar user={member} />}
                  <span>{member.displayName}</span>
                </button>
              ))}
              <h3>History</h3>
              <ul className="list">
                {detail.logs.map((entry) => (
                  <li key={entry.id}><strong>{entry.action}</strong> <span className="subtle">{entry.actorId || 'Mellune'} · {new Date(entry.createdAt).toLocaleString()}</span></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function EventCards({ events, onOpen }) {
  if (!events.length) return <Card><EmptyState icon={CalendarDays} title="No events in this view" /></Card>;
  return (
    <div className="event-grid">
      {events.map((event) => (
        <button type="button" className="event-card" key={event.id} onClick={() => onOpen(event.id)}>
          <StatusPill status={event.status} />
          <strong>{event.name}</strong>
          <span className="subtle">{new Date(event.startAt).toLocaleString()}</span>
          <span className="subtle">{event.counts.going}{event.maxAttendees ? ` / ${event.maxAttendees}` : ''} going · {event.counts.waitlist} waiting</span>
        </button>
      ))}
    </div>
  );
}

function monthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

function weekCells(cursor) {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  });
}
