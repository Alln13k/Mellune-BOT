'use client';

import { useEffect, useState } from 'react';
import {
  Gavel,
  LayoutDashboard,
  ShieldAlert,
  Ticket,
  TriangleAlert,
  Users,
} from 'lucide-react';
import ActivityChart from '../../components/dashboard/ActivityChart';
import {
  useDashboard,
  useGuildData,
} from '../../components/dashboard/DashboardContext';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Skeleton,
  StatCard,
  formatRelative,
} from '../../components/dashboard/ui';

const RANGES = [
  ['24h', '24 hours'],
  ['7d', '7 days'],
  ['30d', '30 days'],
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewPage() {
  const { user, guild } = useDashboard();
  const [range, setRange] = useState('7d');
  const { data, error, loading, reload } = useGuildData(
    `overview?range=${range}`,
  );
  const name = user?.global_name || user?.username;

  useEffect(() => {
    const timer = setInterval(() => reload(), 30_000);
    return () => clearInterval(timer);
  }, [range]);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={name ? `${greeting()}, ${name}.` : `${greeting()}.`}
        description={`A quiet snapshot of ${guild?.name ?? 'your community'}.`}
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      <section className="stats" aria-label="Server statistics">
        {data ? (
          <>
            <StatCard
              icon={Users}
              label="Server members"
              value={data.stats.members}
            />
            <StatCard
              icon={Ticket}
              label="Open tickets"
              value={data.stats.openTickets}
              tone="green"
            />
            <StatCard
              icon={TriangleAlert}
              label="Warnings"
              value={data.stats.warnings}
              tone="pink"
            />
            <StatCard
              icon={Gavel}
              label="Moderation cases"
              value={data.stats.cases}
              tone="pink"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((key) => (
            <div className="card stat" key={key}>
              <Skeleton height={44} />
            </div>
          ))
        )}
      </section>

      <div className="grid-2">
        <Card
          title="Activity"
          description="New members, moderation and tickets over time."
          action={
            <div className="segmented" role="group" aria-label="Time range">
              {RANGES.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={range === value ? 'is-active' : ''}
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {data ? (
            <div className={loading ? 'is-refreshing' : undefined}>
              <ActivityChart series={data.activity} range={data.range} />
            </div>
          ) : (
            <Skeleton height={240} />
          )}
        </Card>

        <Card
          title="Recent moderation"
          description="The latest cases recorded by Mellune."
        >
          {!data ? (
            <Skeleton height={180} />
          ) : data.recentCases.length ? (
            <ul className="list">
              {data.recentCases.map((item) => (
                <li key={item.id}>
                  <span className="icon-tile" aria-hidden="true">
                    <ShieldAlert size={18} strokeWidth={1.75} />
                  </span>
                  <div className="list-main">
                    <strong>
                      #{item.id} · {item.action}
                    </strong>
                    <span className="subtle clamp">
                      {item.targetName ? `${item.targetName} · ` : ''}
                      {item.reason}
                    </span>
                  </div>
                  <time className="subtle" dateTime={item.createdAt}>
                    {formatRelative(item.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Gavel} title="Nothing to review">
              No moderation cases have been recorded yet.
            </EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
