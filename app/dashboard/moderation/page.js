'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Gavel, Search } from 'lucide-react';
import { useGuildData } from '../../../components/dashboard/DashboardContext';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Skeleton,
  formatDate,
} from '../../../components/dashboard/ui';

export default function ModerationPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('q', query);
  if (action) params.set('action', action);
  const { data, error, loading, reload } = useGuildData(`moderation?${params}`);

  return (
    <>
      <PageHeader
        icon={Gavel}
        title="Moderation"
        description="Every case recorded by Mellune, searchable by member or reason."
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      <Card>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by member, id or reason"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Search moderation cases"
            />
          </label>
          <div className="chips" role="group" aria-label="Filter by action">
            <button
              type="button"
              className={`chip ${action === '' ? 'is-active' : ''}`}
              onClick={() => {
                setAction('');
                setPage(1);
              }}
            >
              All
            </button>
            {data?.actions.map((item) => (
              <button
                type="button"
                key={item.action}
                className={`chip ${action === item.action ? 'is-active' : ''}`}
                onClick={() => {
                  setAction(item.action);
                  setPage(1);
                }}
              >
                {item.action}
                <span className="chip-count">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {!data ? (
          <Skeleton height={260} />
        ) : data.cases.length ? (
          <div className={`table-wrap ${loading ? 'is-refreshing' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Action</th>
                  <th>Member</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Case">#{item.id}</td>
                    <td data-label="Action">
                      <span className="pill">{item.action}</span>
                    </td>
                    <td data-label="Member">
                      <strong>{item.targetName ?? 'Unknown'}</strong>
                      <span className="subtle block mono">{item.targetId}</span>
                    </td>
                    <td data-label="Reason" className="cell-reason">
                      {item.reason}
                    </td>
                    <td data-label="Date" className="nowrap subtle">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Gavel} title="No cases found">
            {query || action
              ? 'Try a different search or clear the filters.'
              : 'Cases appear here as soon as moderators use the bot.'}
          </EmptyState>
        )}

        {data && data.pages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            <span className="subtle">
              Page {data.page} of {data.pages} · {data.total} cases
            </span>
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}
      </Card>
    </>
  );
}
