'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gavel,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import {
  guildApi,
  useDashboard,
  useGuildData,
} from '../../../components/dashboard/DashboardContext';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Skeleton,
  formatDate,
} from '../../../components/dashboard/ui';

const MEMBER_PAGE_SIZE = 24;

function avatarFallback(name) {
  return (name || '?').slice(0, 1).toUpperCase();
}

function formatMemberName(member) {
  return member.globalName && member.globalName !== member.username
    ? `${member.globalName} (@${member.username})`
    : `@${member.username}`;
}

function ProfileAvatar({ src, name, size = 44 }) {
  return src ? (
    <img
      className="avatar"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {avatarFallback(name)}
    </span>
  );
}

function MemberCard({ member, onClick }) {
  return (
    <button type="button" className="moderation-member-card" onClick={onClick}>
      <ProfileAvatar src={member.avatar} name={member.displayName} size={48} />
      <span className="moderation-member-copy">
        <strong>{member.displayName}</strong>
        <span className="subtle">@{member.username}</span>
        {member.bot && <span className="bot-tag">BOT</span>}
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

function actionLabel(action) {
  return {
    DM: 'DM sent',
    TIMEOUT: 'Member muted',
    UNTIMEOUT: 'Mute removed',
    WARN: 'Warning recorded',
    KICK: 'Member kicked',
    BAN: 'Member banned',
  }[action] || 'Action completed';
}

function MemberProfile({ profile, onClose, onAction, working }) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [actionMode, setActionMode] = useState('');
  const { user, member, cases } = profile;
  const timedOut = member.timeoutUntil && new Date(member.timeoutUntil) > new Date();

  function submit(action) {
    onAction(action, { reason, message, durationMinutes });
    if (action === 'DM') setMessage('');
    if (action !== 'DM') setReason('');
  }

  return (
    <Card
      className="moderation-profile-card"
      title="Discord profile"
      description="A live server member profile with moderator actions."
      action={
        <button
          type="button"
          className="button button-small button-ghost"
          onClick={onClose}
        >
          <X size={15} /> Back to members
        </button>
      }
    >
      <div
        className="moderation-profile-banner"
        style={{
          backgroundImage: user.banner
            ? `linear-gradient(180deg, rgba(10, 10, 16, .08), rgba(10, 10, 16, .94)), url(${user.banner})`
            : `linear-gradient(135deg, ${user.accentColor || '#3C527F'}, #171722 72%)`,
        }}
      >
        <div className="moderation-profile-identity">
          <ProfileAvatar src={user.avatar} name={user.displayName} size={88} />
          <div>
            <h2>{user.displayName}</h2>
            <p className="subtle">{formatMemberName(user)} · {user.id}</p>
            {user.bot && <span className="bot-tag">BOT ACCOUNT</span>}
          </div>
        </div>
      </div>
      <div className="moderation-profile-meta">
        <div><span className="subtle">Account created</span><strong>{user.createdAt ? formatDate(user.createdAt) : 'Unknown'}</strong></div>
        <div><span className="subtle">Joined server</span><strong>{member.joinedAt ? formatDate(member.joinedAt) : 'Unknown'}</strong></div>
        <div><span className="subtle">Status</span><strong>{timedOut ? `Muted until ${formatDate(member.timeoutUntil)}` : 'Active'}</strong></div>
      </div>
      <div className="moderation-role-list">
        <span className="subtle">Roles</span>
        <div className="chips">
          {member.roles.length ? member.roles.map((role) => (
            <span className="chip" key={role.id}>
              <span className="role-dot" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined }} />
              @{role.name}
            </span>
          )) : <span className="subtle">No additional roles</span>}
        </div>
      </div>
      <div className="moderation-actions">
        <div className="moderation-action-grid">
          <button type="button" className="button" disabled={working} onClick={() => setActionMode(actionMode === 'DM' ? '' : 'DM')}><MessageCircle size={16} /> Send DM</button>
          <button type="button" className="button button-ghost" disabled={working} onClick={() => setActionMode(actionMode === 'TIMEOUT' ? '' : 'TIMEOUT')}><Clock3 size={16} /> {timedOut ? 'Change mute' : 'Mute'}</button>
          {timedOut && <button type="button" className="button button-ghost" disabled={working} onClick={() => submit('UNTIMEOUT')}><CheckCircle2 size={16} /> Unmute</button>}
          <button type="button" className="button button-ghost" disabled={working} onClick={() => setActionMode(actionMode === 'WARN' ? '' : 'WARN')}><ShieldAlert size={16} /> Warn</button>
          <button type="button" className="button button-danger" disabled={working} onClick={() => window.confirm('Kick this member from the server?') && submit('KICK')}><UserRound size={16} /> Kick</button>
          <button type="button" className="button button-danger" disabled={working} onClick={() => window.confirm('Ban this member from the server?') && submit('BAN')}><Ban size={16} /> Ban</button>
        </div>
        {actionMode === 'DM' && (
          <div className="moderation-action-form">
            <textarea rows="3" value={message} placeholder="Write a private message…" onChange={(event) => setMessage(event.target.value)} />
            <button type="button" className="button button-small" disabled={working || !message.trim()} onClick={() => submit('DM')}>Send message</button>
          </div>
        )}
        {actionMode === 'TIMEOUT' && (
          <div className="moderation-action-form">
            <div className="form-row">
              <label className="field"><span className="field-label">Duration</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}><option value="1">1 minute</option><option value="10">10 minutes</option><option value="60">1 hour</option><option value="1440">24 hours</option><option value="10080">7 days</option></select></label>
              <label className="field"><span className="field-label">Reason</span><input value={reason} placeholder="Optional reason" onChange={(event) => setReason(event.target.value)} /></label>
            </div>
            <button type="button" className="button button-small" disabled={working} onClick={() => submit('TIMEOUT')}>Apply mute</button>
          </div>
        )}
        {actionMode === 'WARN' && (
          <div className="moderation-action-form">
            <input value={reason} placeholder="Reason for warning" onChange={(event) => setReason(event.target.value)} />
            <button type="button" className="button button-small" disabled={working || !reason.trim()} onClick={() => submit('WARN')}>Record warning</button>
          </div>
        )}
      </div>
      <Card title="Moderation history" description="The latest actions recorded for this member.">
        {cases.length ? (
          <ul className="list">
            {cases.map((item) => (
              <li key={item.id}><div className="list-main"><strong>#{item.id} · {item.action}</strong><span className="subtle">{item.reason} · {formatDate(item.createdAt)}</span></div></li>
            ))}
          </ul>
        ) : <EmptyState icon={Gavel} title="No moderation history" />}
      </Card>
    </Card>
  );
}

export default function ModerationPage() {
  const { guild, notify } = useDashboard();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [after, setAfter] = useState('');
  const [cursorStack, setCursorStack] = useState(['']);
  const [memberPage, setMemberPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setAfter('');
      setCursorStack(['']);
      setMemberPage(1);
      setSelectedId(null);
      setProfile(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const params = new URLSearchParams({ view: 'members' });
  if (query) params.set('q', query);
  if (after) params.set('after', after);
  const { data, error, loading, reload } = useGuildData(`moderation?${params}`);
  const visibleMembers = useMemo(
    () => (data?.members || []).slice(
      (memberPage - 1) * MEMBER_PAGE_SIZE,
      memberPage * MEMBER_PAGE_SIZE,
    ),
    [data?.members, memberPage],
  );
  const memberPages = Math.max(1, Math.ceil((data?.members?.length || 0) / MEMBER_PAGE_SIZE));

  async function openProfile(userId) {
    setSelectedId(userId);
    setProfileLoading(true);
    try {
      const result = await guildApi(guild.id, `moderation/members/${userId}`);
      setProfile(result.profile);
    } catch (requestError) {
      notify(requestError.message, 'error');
      setSelectedId(null);
    } finally {
      setProfileLoading(false);
    }
  }

  async function runAction(actionName, payload) {
    setWorking(true);
    try {
      await guildApi(guild.id, `moderation/members/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ action: actionName, ...payload }),
      });
      notify(actionLabel(actionName));
      if (['KICK', 'BAN'].includes(actionName)) {
        setSelectedId(null);
        setProfile(null);
      } else if (actionName !== 'DM') {
        await openProfile(selectedId);
      }
      await reload();
    } catch (requestError) {
      notify(requestError.message, 'error');
    } finally {
      setWorking(false);
    }
  }

  function nextMembers() {
    if (!data?.memberAfter) return;
    setCursorStack((current) => [...current, data.memberAfter]);
    setAfter(data.memberAfter);
    setMemberPage(1);
  }

  function previousMembers() {
    if (cursorStack.length <= 1) return;
    const next = cursorStack.slice(0, -1);
    setCursorStack(next);
    setAfter(next[next.length - 1]);
    setMemberPage(1);
  }

  return (
    <>
      <PageHeader
        icon={Gavel}
        title="Moderation"
        description="Find any server member, inspect their Discord profile, and take a moderator action."
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}
      {selectedId && profileLoading ? <Card><Skeleton height={360} /></Card> : null}
      {profile ? (
        <MemberProfile
          profile={profile}
          onClose={() => { setSelectedId(null); setProfile(null); }}
          onAction={runAction}
          working={working}
        />
      ) : !profileLoading ? (
      <Card title="Server members" description={`${data?.members?.length || 0} members loaded. Search by username, display name, or ID.`}>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search every server member…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Search server members"
            />
          </label>
        </div>

        {!data ? (
          <Skeleton height={260} />
        ) : visibleMembers.length ? (
          <div className={`moderation-member-grid ${loading ? 'is-refreshing' : ''}`}>
            {visibleMembers.map((member) => (
              <MemberCard key={member.id} member={member} onClick={() => openProfile(member.id)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={UserRound} title="No members found">
            Try a different username, display name, or Discord ID.
          </EmptyState>
        )}

        {data && (
          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={memberPage <= 1 && cursorStack.length <= 1}
              onClick={() => memberPage > 1 ? setMemberPage(memberPage - 1) : previousMembers()}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            <span className="subtle">
              Page {memberPage} of {memberPages}{data.memberAfter ? ' · more members available' : ''}
            </span>
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={memberPage < memberPages ? false : !data.memberAfter}
              onClick={() => memberPage < memberPages ? setMemberPage(memberPage + 1) : nextMembers()}
            >
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}
      </Card>
      ) : null}
    </>
  );
}
