'use client';

import { LogOut, Settings } from 'lucide-react';
import { useDashboard } from '../../../components/dashboard/DashboardContext';
import { Avatar, Card, PageHeader } from '../../../components/dashboard/ui';

export default function SettingsPage() {
  const { user, guild } = useDashboard();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/';
  }

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Your account and the server you are managing."
      />
      <div className="grid-2">
        <Card title="Account" description="Signed in with Discord.">
          {user && (
            <div className="identity">
              <Avatar user={user} size={56} />
              <div>
                <strong>{user.global_name || user.username}</strong>
                <span className="subtle block">@{user.username}</span>
                <span className="subtle block mono">{user.id}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="button button-ghost"
            onClick={logout}
          >
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </Card>
        <Card
          title="Server"
          description="Access is limited to the Mellune owner role."
        >
          {guild && (
            <dl className="details">
              <div>
                <dt>Name</dt>
                <dd>{guild.name}</dd>
              </div>
              <div>
                <dt>Server id</dt>
                <dd className="mono">{guild.id}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>
    </>
  );
}
