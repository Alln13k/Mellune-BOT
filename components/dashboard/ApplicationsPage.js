'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { guildApi, useDashboard, useGuildData } from './DashboardContext';
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

const EMPTY_QUESTION = {
  label: '',
  prompt: '',
  description: '',
  type: 'LONG_TEXT',
  choices: [],
  required: true,
};

const EMPTY_FORM = {
  title: 'New application type',
  description: '',
  destinationChannelId: '',
  notificationChannelId: '',
  reviewRoleId: '',
  enabled: false,
  maxSubmissions: 1,
  cooldownSeconds: 0,
  minAccountAgeHours: 0,
  requiredRoleId: '',
  minLevel: 0,
  minMembershipHours: 0,
  questions: [{ ...EMPTY_QUESTION }],
};

function statusLabel(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function questionTypeLabel(type) {
  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function ApplicationStatus({ status }) {
  return <span className={`chip application-status status-${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}

function Applicant({ submission, compact = false }) {
  return (
    <div className="applicant">
      {submission.avatar ? (
        <img className="avatar" src={submission.avatar} alt="" width="36" height="36" />
      ) : (
        <span className="avatar avatar-fallback">
          {(submission.displayName || submission.username || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="list-main">
        <strong>{submission.displayName || submission.username || 'Unknown member'}</strong>
        <span className="subtle">
          @{submission.username || submission.userId}
          {!compact && ` · ID: ${submission.userId}`}
        </span>
      </div>
    </div>
  );
}

function TypeStats({ item, onClick }) {
  return (
    <button type="button" className="application-type-card" onClick={onClick}>
      <div className="list-main">
        <strong>{item.name}</strong>
        <span className="subtle clamp">{item.description}</span>
        <span className="subtle">
          {item.pending} pending · {item.total} total
        </span>
        <span className="subtle">
          {item.approved} approved · {item.rejected} rejected ·{' '}
          {item.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="application-type-counts">
        <span>Created {formatDate(item.createdAt)}</span>
        <span>
          Last submission {item.lastSubmission ? formatDate(item.lastSubmission) : '—'}
        </span>
        <span>{item.approvalRate}% approved</span>
        <span>{item.rejectionRate}% rejected</span>
        <span>Avg review {item.averageReviewHours || 0}h</span>
        <span>{item.thisWeek} this week · {item.thisMonth} this month</span>
      </div>
    </button>
  );
}

function QuestionEditor({ question, index, total, onChange, onRemove, onMove }) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const hasChoices = ['MULTIPLE_CHOICE', 'SINGLE_CHOICE'].includes(question.type);
  return (
    <div className="category-card">
      <div className="form-row">
        <Field label={`Question ${index + 1}`}>
          <input
            value={question.label}
            maxLength="45"
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </Field>
        <Field label="Answer type">
          <select
            value={question.type}
            onChange={(event) => onChange({ type: event.target.value })}
          >
            {[
              'SHORT_TEXT',
              'LONG_TEXT',
              'NUMBER',
              'YES_NO',
              'SINGLE_CHOICE',
              'MULTIPLE_CHOICE',
            ].map((type) => (
              <option value={type} key={type}>{questionTypeLabel(type)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Question description">
        <input
          value={question.description || ''}
          maxLength="200"
          placeholder="Optional help text shown to applicants."
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>
      <Field label="Prompt">
        <textarea
          rows="2"
          value={question.prompt}
          maxLength="200"
          onChange={(event) => onChange({ prompt: event.target.value })}
        />
      </Field>
      {hasChoices && (
        <Field label="Choices" hint="Separate choices with commas. Applicants type one or more exact choices.">
          <input
            value={choices.join(', ')}
            onChange={(event) =>
              onChange({
                choices: event.target.value
                  .split(',')
                  .map((choice) => choice.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      )}
      <div className="form-row">
        <Toggle
          label="Required"
          checked={question.required !== false}
          onChange={(required) => onChange({ required })}
        />
        <div className="form-row application-question-actions">
          <button type="button" className="button button-small button-ghost" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp size={15} /> Up
          </button>
          <button type="button" className="button button-small button-ghost" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ChevronDown size={15} /> Down
          </button>
          <button type="button" className="button button-small button-ghost" onClick={onRemove}>
            <Trash2 size={15} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationBuilder({ data, draft, setDraft, saving, onSave, onDelete }) {
  const channels = data?.channels || [];
  const roles = data?.roles || [];
  const updateQuestion = (index, patch) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  const moveQuestion = (index, direction) => {
    setDraft((current) => {
      const questions = [...current.questions];
      const next = index + direction;
      [questions[index], questions[next]] = [questions[next], questions[index]];
      return { ...current, questions };
    });
  };
  return (
    <Card
      title="Application builder"
      description="Keep each type focused. Discord modals support up to five questions."
      action={
        <div className="form-row">
          {draft.id && (
            <button type="button" className="button button-small button-ghost" onClick={onDelete}>
              <Trash2 size={15} /> Delete type
            </button>
          )}
          <button type="button" className="button button-small" disabled={saving} onClick={onSave}>
            <Save size={15} /> {saving ? 'Saving…' : 'Save type'}
          </button>
        </div>
      }
    >
      <div className="form-row">
        <Field label="Name">
          <input value={draft.title} maxLength="100" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Toggle label="Enabled" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
      </div>
      <Field label="Description">
        <textarea rows="2" value={draft.description} maxLength="1000" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </Field>
      <div className="form-row">
        <Field label="Application panel channel">
          <select value={draft.destinationChannelId || ''} onChange={(event) => setDraft({ ...draft, destinationChannelId: event.target.value })}>
            <option value="">Choose a channel…</option>
            {channels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}
          </select>
        </Field>
        <Field label="Notification channel">
          <select value={draft.notificationChannelId || ''} onChange={(event) => setDraft({ ...draft, notificationChannelId: event.target.value })}>
            <option value="">No notification</option>
            {channels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Review role" hint="Dashboard authorization is still enforced server-side. This role identifies the Discord staff group for this type.">
        <select value={draft.reviewRoleId || ''} onChange={(event) => setDraft({ ...draft, reviewRoleId: event.target.value })}>
          <option value="">No role selected</option>
          {roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Maximum submissions per user">
          <input type="number" min="1" max="20" value={draft.maxSubmissions} onChange={(event) => setDraft({ ...draft, maxSubmissions: event.target.value })} />
        </Field>
        <Field label="Cooldown (seconds)">
          <input type="number" min="0" value={draft.cooldownSeconds} onChange={(event) => setDraft({ ...draft, cooldownSeconds: event.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Required role">
          <select value={draft.requiredRoleId || ''} onChange={(event) => setDraft({ ...draft, requiredRoleId: event.target.value })}>
            <option value="">No role requirement</option>
            {roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
          </select>
        </Field>
        <Field label="Minimum Mellune level">
          <input type="number" min="0" value={draft.minLevel} onChange={(event) => setDraft({ ...draft, minLevel: event.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Minimum account age (hours)">
          <input type="number" min="0" value={draft.minAccountAgeHours} onChange={(event) => setDraft({ ...draft, minAccountAgeHours: event.target.value })} />
        </Field>
        <Field label="Minimum membership (hours)">
          <input type="number" min="0" value={draft.minMembershipHours} onChange={(event) => setDraft({ ...draft, minMembershipHours: event.target.value })} />
        </Field>
      </div>
      <div className="category-grid">
        {draft.questions.map((question, index) => (
          <QuestionEditor
            question={question}
            index={index}
            total={draft.questions.length}
            key={question.id || index}
            onChange={(patch) => updateQuestion(index, patch)}
            onRemove={() => setDraft({ ...draft, questions: draft.questions.filter((_, questionIndex) => questionIndex !== index) })}
            onMove={(direction) => moveQuestion(index, direction)}
          />
        ))}
      </div>
      <div className="form-row">
        <button
          type="button"
          className="button button-ghost"
          disabled={draft.questions.length >= 5}
          onClick={() => setDraft({ ...draft, questions: [...draft.questions, { ...EMPTY_QUESTION }] })}
        >
          <Plus size={15} /> Add question
        </button>
      </div>
      <Card title="Preview" description="A compact preview of what applicants will answer.">
        <div className="discord-message">
          <strong>{draft.title || 'Application type'}</strong>
          <p className="subtle">{draft.description || 'Your application description.'}</p>
          {draft.questions.map((question, index) => (
            <div className="application-preview-question" key={question.id || index}>
              <strong>{index + 1}. {question.label || 'Untitled question'}</strong>
              <span className="subtle">{questionTypeLabel(question.type)}{question.required ? ' · Required' : ' · Optional'}</span>
            </div>
          ))}
        </div>
      </Card>
    </Card>
  );
}

function ApplicationReview({ submission, guildId, notify, onClose, onReload }) {
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  async function review(action, status) {
    if (working) return;
    if (status === 'REJECTED' && !reason.trim()) {
      setReason(window.prompt('Reason for rejecting this application:') || '');
      return;
    }
    if (!window.confirm(`${action} this application?`)) return;
    setWorking(true);
    try {
      const result = await guildApi(guildId, `applications/${submission.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      });
      notify(result.warning || `Application ${status.toLowerCase()}.`, result.warning ? 'error' : 'success');
      await onReload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setWorking(false);
    }
  }
  async function reopen() {
    setWorking(true);
    try {
      await guildApi(guildId, `applications/${submission.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reopen' }),
      });
      notify('Application reopened.');
      await onReload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setWorking(false);
    }
  }
  async function remove() {
    if (!window.confirm('Delete this application record?')) return;
    try {
      await guildApi(guildId, `applications/${submission.id}`, { method: 'DELETE' });
      notify('Application deleted.');
      onClose();
      await onReload();
    } catch (error) {
      notify(error.message, 'error');
    }
  }
  return (
    <Card
      title={submission.form.title}
      description={`Application #${submission.id} · submitted ${formatDate(submission.submittedAt)}`}
      action={<button type="button" className="icon-button" aria-label="Close application" onClick={onClose}><X size={17} /></button>}
    >
      <div className="application-review-header">
        <Applicant submission={submission} />
        <ApplicationStatus status={submission.status} />
      </div>
      <div className="details">
        <div><dt>Submitted</dt><dd>{formatDate(submission.submittedAt)}</dd></div>
        <div><dt>Reviewed</dt><dd>{submission.reviewedAt ? `${formatDate(submission.reviewedAt)} by @${submission.reviewerUsername || submission.reviewerId}` : 'Not reviewed'}</dd></div>
        <div><dt>DM</dt><dd>{submission.dmStatus === 'FAILED' ? `⚠️ ${submission.dmError || 'Could not be delivered.'}` : submission.dmStatus}</dd></div>
      </div>
      <div className="application-answer-list">
        {submission.answers.map((answer) => (
          <div className="application-answer" key={answer.id}>
            <strong>{answer.questionLabel || answer.question?.label || 'Question'}</strong>
            <p>{answer.answer || 'No answer'}</p>
          </div>
        ))}
      </div>
      <Card title="Review history">
        {submission.history?.length ? (
          <ul className="list">
            {submission.history.map((event) => (
              <li key={event.id}>
                <div className="list-main">
                  <strong>{event.previousStatus ? `${event.previousStatus} → ` : ''}{event.newStatus}</strong>
                  <span className="subtle">{event.reviewerUsername ? `Reviewed by @${event.reviewerUsername}` : 'Submitted'} · {formatDate(event.createdAt)}</span>
                  {event.reason && <span className="subtle">Reason: {event.reason}</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={ClipboardList} title="No review history" />}
      </Card>
      <div className="form-row">
        {submission.status === 'PENDING' && (
          <>
            <button type="button" className="button" disabled={working} onClick={() => review('Approve', 'APPROVED')}><Check size={16} /> Approve</button>
            <button type="button" className="button button-ghost" disabled={working} onClick={() => review('Reject', 'REJECTED')}><X size={16} /> Reject</button>
          </>
        )}
        {submission.status === 'REJECTED' && (
          <button type="button" className="button button-ghost" disabled={working} onClick={reopen}><RotateCcw size={16} /> Reopen</button>
        )}
        <button type="button" className="button button-ghost" onClick={remove}><Trash2 size={16} /> Delete</button>
      </div>
    </Card>
  );
}

export default function ApplicationsPage() {
  const { guild, notify } = useDashboard();
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedTypeId) params.set('formId', selectedTypeId);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (sort !== 'newest') params.set('sort', sort);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', page);
    return `applications?${params.toString()}`;
  }, [selectedTypeId, status, search, sort, from, to, page]);
  const feature = useGuildData(query);
  const selectedType = feature.data?.selectedType;

  useEffect(() => {
    if (!selectedTypeId && feature.data?.types?.[0]) setSelectedTypeId(feature.data.types[0].id);
  }, [feature.data, selectedTypeId]);

  useEffect(() => {
    if (selectedType) {
      setDraft({
        ...EMPTY_FORM,
        ...selectedType,
        questions: selectedType.questions?.length ? selectedType.questions : [{ ...EMPTY_QUESTION }],
      });
    }
  }, [selectedType]);

  async function openSubmission(id) {
    try {
      const result = await guildApi(guild.id, `applications/${id}`);
      setDetail(result.submission);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function reloadDetail() {
    if (detail) await openSubmission(detail.id);
    await feature.reload();
  }

  async function saveType() {
    setSaving(true);
    try {
      const result = await guildApi(guild.id, 'applications', {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setSelectedTypeId(result.form.id);
      notify('Application type saved.');
      await feature.reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteType() {
    if (!window.confirm('Delete this application type? Existing records will be hidden but preserved.')) return;
    try {
      await guildApi(guild.id, 'applications', {
        method: 'DELETE',
        body: JSON.stringify({ id: draft.id }),
      });
      setSelectedTypeId(null);
      setDraft(null);
      notify('Application type deleted.');
      await feature.reload();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function newType() {
    setSelectedTypeId(-1);
    setDraft({ ...EMPTY_FORM, questions: [{ ...EMPTY_QUESTION }] });
  }

  if (feature.error) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Applications" description="Review real submissions from the Mellune dashboard." />
        <ErrorNotice onRetry={feature.reload}>{feature.error}</ErrorNotice>
      </>
    );
  }
  if (!feature.data) {
    return <><PageHeader icon={ClipboardList} title="Applications" description="Review real submissions from the Mellune dashboard." /><Skeleton height={420} /></>;
  }
  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Applications"
        description="Create application types, review submissions, and keep a complete decision history."
        actions={<button type="button" className="button" onClick={newType}><Plus size={16} /> New type</button>}
      />
      <section className="stats">
        {[
          ['Pending', feature.data.overview.pending],
          ['Approved', feature.data.overview.approved],
          ['Rejected', feature.data.overview.rejected],
          ['Total', feature.data.overview.total],
        ].map(([label, value]) => (
          <article className="card stat" key={label}><div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString()}</div></div></article>
        ))}
      </section>
      <div className="grid-2">
        <Card title="Application types" description="Each type has its own questions, requirements, and statistics.">
          {feature.data.types.length ? (
            <div className="application-type-list">
              {feature.data.types.map((item) => (
                <TypeStats item={item} key={item.id} onClick={() => { setSelectedTypeId(item.id); setPage(1); setDetail(null); }} />
              ))}
            </div>
          ) : <EmptyState icon={ClipboardList} title="No application types yet">Create a type to start collecting applications.</EmptyState>}
        </Card>
        {draft ? (
          <ApplicationBuilder
            data={feature.data}
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSave={saveType}
            onDelete={deleteType}
          />
        ) : (
          <Card title="Application types" description="Select a type to edit its builder and review inbox.">
            <EmptyState icon={Eye} title="Choose an application type" />
          </Card>
        )}
      </div>
      {selectedTypeId > 0 && (
        <Card title={`${selectedType?.title || 'Application'} inbox`} description="Search and review paginated submissions without loading the full archive.">
          <div className="toolbar">
            <div className="form-row">
              <label className="search"><Search size={16} /><input value={search} placeholder="Search name, username, or ID" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <label className="field-inline">From <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
              <label className="field-inline">To <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
            </div>
          </div>
          {detail ? (
            <ApplicationReview submission={detail} guildId={guild.id} notify={notify} onClose={() => setDetail(null)} onReload={reloadDetail} />
          ) : feature.data.submissions.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Applicant</th><th>Status</th><th>Submitted</th><th /></tr></thead>
                <tbody>
                  {feature.data.submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td><Applicant submission={submission} compact /></td>
                      <td><ApplicationStatus status={submission.status} /></td>
                      <td>{formatDate(submission.submittedAt)}</td>
                      <td><button type="button" className="button button-small button-ghost" onClick={() => openSubmission(submission.id)}>Review</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={ClipboardList} title="No applications found">Try another filter or wait for the next submission.</EmptyState>}
          {!detail && (
            <div className="pagination">
              <span className="subtle">Page {feature.data.pagination.page} of {feature.data.pagination.pages} · {feature.data.pagination.total} submissions</span>
              <div className="form-row">
                <button type="button" className="button button-small button-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className="button button-small button-ghost" disabled={page >= feature.data.pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
