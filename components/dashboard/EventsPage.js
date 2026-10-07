'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Send } from 'lucide-react';
import { guildApi, useDashboard } from './DashboardContext';
import { TIMEZONES, statusLabel, wallFields } from '../../services/events/eventLogic';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeader,
  SelectField,
  Skeleton,
} from './ui';

const VIEWS = [
  ['coming', 'Coming up'],
  ['live', 'Happening now'],
  ['past', 'Finished'],
  ['cancelled', 'Cancelled'],
];
const CAPACITIES = [
  { id: '10', name: '10 people' },
  { id: '25', name: '25 people' },
  { id: '50', name: '50 people' },
  { id: '100', name: '100 people' },
];
const ZONE_LABELS = {
  UTC: 'UTC',
  'Europe/Paris': 'Paris',
  'Europe/London': 'London',
  'Europe/Berlin': 'Berlin',
  'America/New_York': 'New York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Los_Angeles': 'Los Angeles',
  'America/Sao_Paulo': 'São Paulo',
  'Asia/Tokyo': 'Tokyo',
  'Asia/Singapore': 'Singapore',
  'Australia/Sydney': 'Sydney',
};
const AUTOMATIC_REMINDERS = [
  { offsetMinutes: 15, targets: ['DM'], includeTentative: false },
  { offsetMinutes: 0, targets: ['DM'], includeTentative: false },
];

function defaultZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.includes(zone)) return zone;
  } catch {
    // The browser timezone is optional. UTC still posts the right instant.
  }
  return 'UTC';
}

const blankForm = () => ({
  name: '',
  description: '',
  imageUrl: '',
  date: '',
  time: '',
  timezone: defaultZone(),
  channelId: '',
  capacityChoice: '',
  customCapacity: '',
});

function capacityValue(form) {
  if (form.capacityChoice === 'custom') return form.customCapacity || null;
  return form.capacityChoice || null;
}

function payloadFromForm(form) {
  return {
    name: form.name,
    description: form.description,
    imageUrl: form.imageUrl,
    date: form.date,
    time: form.time,
    timezone: form.timezone,
    channelId: form.channelId,
    maxAttendees: capacityValue(form),
    reminders: AUTOMATIC_REMINDERS,
    rsvpEnabled: true,
  };
}

function whenLabel(event) {
  return new Date(event.startAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function attendanceLine(event) {
  const going = `${event.counts?.going || 0}${event.maxAttendees ? ` / ${event.maxAttendees}` : ''} going`;
  const waiting = event.counts?.waitlist ? ` · ${event.counts.waitlist} waiting` : '';
  return `${going}${waiting}`;
}

function viewCount(counts, id) {
  if (!counts) return 0;
  if (id === 'coming') return (counts.UPCOMING || 0) + (counts.DRAFT || 0) + (counts.SCHEDULED || 0);
  if (id === 'live') return counts.LIVE || 0;
  if (id === 'past') return counts.ENDED || 0;
  return counts.CANCELLED || 0;
}

function answerLabel(status) {
  if (status === 'GOING') return 'Going';
  if (status === 'TENTATIVE') return 'Maybe';
  if (status === 'DECLINED') return "Can't go";
  if (status === 'WAITLIST') return 'Waiting';
  return statusLabel(status);
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${String(status || '').toLowerCase()}`}>{statusLabel(status)}</span>;
}

export default function EventsPage() {
  const { guild, notify } = useDashboard();
  const [bucket, setBucket] = useState('coming');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingPosted, setEditingPosted] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    if (!guild?.id) return;
    setLoading(true);
    try {
      const result = await guildApi(
        guild.id,
        `events?bucket=${bucket}&page=${page}&q=${encodeURIComponent(query)}`,
      );
      setData(result);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [bucket, guild?.id, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEvent(id) {
    setSelectedId(id);
    setDetail(null);
    setConfirm(null);
    const result = await guildApi(guild.id, `events/${id}`);
    setDetail(result.event);
  }

  function editCurrent() {
    if (!detail) return;
    const start = wallFields(detail.startAt, detail.timezone);
    const known = ['10', '25', '50', '100'];
    const preset = known.includes(String(detail.maxAttendees || '')) ? String(detail.maxAttendees || '') : 'custom';
    setForm({
      ...blankForm(),
      name: detail.name || '',
      description: detail.description || '',
      imageUrl: detail.imageUrl || '',
      date: start.date,
      time: start.time,
      timezone: TIMEZONES.includes(detail.timezone) ? detail.timezone : 'UTC',
      channelId: detail.channelId || '',
      capacityChoice: detail.maxAttendees ? preset : '',
      customCapacity: preset === 'custom' ? detail.maxAttendees || '' : '',
    });
    setEditingId(detail.id);
    setEditingPosted(Boolean(detail.publishedAt));
  }

  async function submit() {
    if (!form.name.trim() || !form.date || !form.time || !form.channelId) {
      notify('Add a name, a date, a time, and a channel.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await guildApi(guild.id, `events/${editingId}`, {
          method: 'POST',
          body: JSON.stringify({ ...payloadFromForm(form), action: 'update' }),
        });
        const posted = updated.event?.publishedAt
          ? updated
          : await guildApi(guild.id, `events/${editingId}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'publish' }),
          });
        notify(updated.event?.publishedAt ? 'Saved. The Discord message is updated.' : 'Posted in Discord.');
        setEditingId(null);
        setEditingPosted(false);
        setForm(blankForm());
        if (posted.event) setDetail(posted.event);
        setSelectedId(editingId);
      } else {
        const result = await guildApi(guild.id, 'events', {
          method: 'POST',
          body: JSON.stringify({ ...payloadFromForm(form), publish: true }),
        });
        notify('Posted. People who tap Going get automatic reminders.');
        setForm(blankForm());
        if (result.event?.id) await openEvent(result.event.id);
      }
      await load();
    } catch (saveError) {
      notify(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, extra = {}) {
    try {
      const result = await guildApi(guild.id, `events/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ action, ...extra }),
      });
      if (action === 'delete') {
        setSelectedId(null);
        setDetail(null);
        setEditingId(null);
        setEditingPosted(false);
        notify('Event deleted.');
      } else if (result.event) {
        setDetail(result.event);
        notify(action === 'cancel' ? 'Event cancelled. People who were coming get a DM.' : 'Event updated.');
      }
      setConfirm(null);
      await load();
    } catch (actionError) {
      notify(actionError.message, 'error');
    }
  }

  const channels = (data?.channels || []).filter((channel) => channel.type === 0 || channel.type === 5);
  const capacityOptions = form.capacityChoice === 'custom'
    ? [...CAPACITIES, { id: 'custom', name: `${form.customCapacity} people` }]
    : CAPACITIES;
  const going = detail?.attendees?.going || [];
  const waiting = detail?.attendees?.waitlist || [];
  const channelName = channels.find((channel) => channel.id === detail?.channelId)?.name;

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Events"
        description="Post an event. Members tap Going. Mellune reminds them automatically."
      />
      {error && <ErrorNotice onRetry={load}>{error}</ErrorNotice>}
      {data?.stats && (
        <section className="stats">
          {[
            ['Coming up', viewCount(data.counts, 'coming')],
            ['Happening now', viewCount(data.counts, 'live')],
            ['People going', data.stats.totalAttendees],
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
      <Card
        title={editingId ? 'Edit event' : 'New event'}
        description="Name, when, and channel. Reminders, the waitlist, and cancel notices are automatic."
      >
        <div className="form-row">
          <Field label="Name">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Game night" />
          </Field>
          <SelectField
            label="Channel"
            value={form.channelId}
            onChange={(channelId) => setForm({ ...form, channelId })}
            options={channels}
            placeholder="Where should it be posted?"
            getLabel={(channel) => `#${channel.name}`}
          />
        </div>
        <Field label="What is it about?" hint="Optional. Shown on the Discord message.">
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Bring a game. We start on time." />
        </Field>
        <Field label="Event image URL" hint="Optional. Use a direct image link (Imgur, CDN, or similar). Without one, Mellune uses the server icon.">
          <input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://i.imgur.com/..." />
        </Field>
        <div className="form-row">
          <Field label="Date"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Time"><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></Field>
          <SelectField
            label="Timezone"
            value={form.timezone}
            onChange={(timezone) => setForm({ ...form, timezone })}
            options={TIMEZONES.map((zone) => ({ id: zone, name: ZONE_LABELS[zone] || zone }))}
            placeholder="Timezone"
          />
          <SelectField
            label="How many people?"
            value={form.capacityChoice}
            onChange={(capacityChoice) => setForm({ ...form, capacityChoice })}
            options={capacityOptions}
            placeholder="No limit"
          />
        </div>
        <p className="subtle">People can tap Going as soon as this is posted. They get a DM 15 minutes before and when it starts. A full event starts a waitlist and DMs the next person when a spot opens. Cancelling or moving the time also sends a DM.</p>
        <div className="moderation-action-grid">
          {editingId && (
            <button type="button" className="button button-ghost" onClick={() => { setEditingId(null); setEditingPosted(false); setForm(blankForm()); }}>
              New event instead
            </button>
          )}
          <button type="button" className="button" disabled={saving} onClick={submit}>
            <Send size={16} /> {saving ? 'Saving…' : editingId && editingPosted ? 'Save changes' : 'Post event'}
          </button>
        </div>
      </Card>
      <div className="weekday-row">
        {VIEWS.map(([id, label]) => {
          const count = viewCount(data?.counts, id);
          return (
            <button type="button" key={id} className={`button button-small ${bucket === id ? '' : 'button-ghost'}`} onClick={() => { setBucket(id); setPage(1); }}>
              {label}{count ? ` ${count}` : ''}
            </button>
          );
        })}
      </div>
      <Field label="Search">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name" />
      </Field>
      {loading && !data ? <Skeleton height={180} /> : <EventCards events={data?.items || []} onOpen={openEvent} />}
      {!!data?.total && data.total > data.pageSize && (
        <div className="moderation-action-grid">
          <button type="button" className="button button-small button-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span className="subtle">Page {data.page}</span>
          <button type="button" className="button button-small button-ghost" disabled={data.page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      )}
      {selectedId && (
        <Card title={detail?.name || 'Event'} description="Who is coming, and what you can do.">
          {!detail ? <Skeleton height={160} /> : (
            <>
              <StatusPill status={detail.status} />
              <p>{detail.description}</p>
              <p className="subtle">
                {whenLabel(detail)} · {ZONE_LABELS[detail.timezone] || detail.timezone} · {attendanceLine(detail)}
                {channelName ? ` · #${channelName}` : ''}
                {detail.publishedAt ? '' : ' · not posted yet'}
              </p>
              <div className="moderation-action-grid">
                <button type="button" className="button button-small" onClick={editCurrent}>Edit</button>
                {!detail.publishedAt && detail.status !== 'CANCELLED' && (
                  <button type="button" className="button button-small" onClick={() => runAction('publish')}>Post</button>
                )}
                {detail.status !== 'ENDED' && detail.status !== 'CANCELLED' && (
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm('end')}>Mark finished</button>
                )}
                {detail.status !== 'CANCELLED' && (
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm('cancel')}>Cancel</button>
                )}
                <button type="button" className="button button-small button-danger" onClick={() => setConfirm('delete')}>Delete</button>
              </div>
              {confirm === 'cancel' && (
                <div className="notice">
                  <span>Cancel this event? People who are going or maybe get a DM.</span>
                  <button type="button" className="button button-small button-danger" onClick={() => runAction('cancel')}>Cancel event</button>
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm(null)}>Keep it</button>
                </div>
              )}
              {confirm === 'end' && (
                <div className="notice">
                  <span>Mark this event as finished? Members can no longer change their answer.</span>
                  <button type="button" className="button button-small" onClick={() => runAction('end')}>Mark finished</button>
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm(null)}>Keep it open</button>
                </div>
              )}
              {confirm === 'delete' && (
                <div className="notice">
                  <span>Delete this event from Mellune? A message already posted in Discord stays there.</span>
                  <button type="button" className="button button-small button-danger" onClick={() => runAction('delete')}>Delete</button>
                  <button type="button" className="button button-small button-ghost" onClick={() => setConfirm(null)}>Keep it</button>
                </div>
              )}
              <h3>Going ({going.length})</h3>
              {going.length ? going.map((person) => (
                <Person key={person.id} person={person} onChange={(status) => runAction('attendee', { userId: person.id, status })} />
              )) : <p className="subtle">Nobody has tapped Going yet.</p>}
              {!!waiting.length && (
                <>
                  <h3>Waitlist ({waiting.length})</h3>
                  {waiting.map((person) => (
                    <Person key={person.id} person={person} onChange={(status) => runAction('attendee', { userId: person.id, status })} />
                  ))}
                </>
              )}
              <p className="subtle">
                {(detail.counts?.tentative || 0)} maybe · {(detail.counts?.declined || 0)} can&apos;t go
              </p>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function Person({ person, onChange }) {
  return (
    <div className="event-person">
      {person.avatar
        ? <img className="avatar" src={person.avatar} alt="" width={36} height={36} />
        : <Avatar user={{ id: person.id, username: person.username, global_name: person.displayName, avatar: null }} />}
      <div>
        <strong>{person.displayName}</strong>
        <span className="subtle block">{person.position ? `Waiting · #${person.position}` : answerLabel(person.status)}</span>
      </div>
      <select className="select-control" value={person.position ? 'WAITLIST' : person.status} onChange={(event) => onChange(event.target.value)}>
        <option value="GOING">Going</option>
        <option value="TENTATIVE">Maybe</option>
        <option value="DECLINED">Can&apos;t go</option>
        <option value="WAITLIST">Waitlist</option>
        <option value="REMOVE">Remove</option>
      </select>
    </div>
  );
}

function EventCards({ events, onOpen }) {
  if (!events.length) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="Nothing here yet">Post an event above. It shows up in Coming up.</EmptyState>
      </Card>
    );
  }
  return (
    <div className="event-grid">
      {events.map((event) => (
        <button type="button" className="event-card" key={event.id} onClick={() => onOpen(event.id)}>
          <StatusPill status={event.status} />
          <strong>{event.name}</strong>
          <span className="subtle">{whenLabel(event)}</span>
          <span className="subtle">{attendanceLine(event)}</span>
        </button>
      ))}
    </div>
  );
}
