'use client';

import { useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import {
  guildApi,
  useDashboard,
  useGuildData,
} from '../../../components/dashboard/DashboardContext';
import {
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeader,
  Skeleton,
  Toggle,
} from '../../../components/dashboard/ui';

export default function LevelingPage() {
  const { guild, notify } = useDashboard();
  const { data, setData, error, reload } = useGuildData('leveling');
  const [saving, setSaving] = useState(false);

  async function setEnabled(enabled) {
    setSaving(true);
    try {
      await guildApi(guild.id, 'leveling', {
        method: 'POST',
        body: JSON.stringify({
          enabled,
          levelUpEnabled: data?.levelUpEnabled,
          levelUpChannelId: data?.levelUpChannelId,
          levelUpPayload: data?.levelUpPayload,
          levelUpMention: data?.levelUpMention,
        }),
      });
      setData({ ...data, enabled });
      notify(enabled ? 'Leveling enabled.' : 'Leveling disabled.');
    } catch (requestError) {
      notify(requestError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveLevelUp(patch) {
    try {
      const result = await guildApi(guild.id, 'leveling', {
        method: 'POST',
        body: JSON.stringify({
          enabled: data.enabled,
          levelUpEnabled: data.levelUpEnabled,
          levelUpChannelId: data.levelUpChannelId,
          levelUpPayload: data.levelUpPayload,
          levelUpMention: data.levelUpMention,
          ...patch,
        }),
      });
      setData({ ...data, ...result });
      notify('Level-up notifications saved.');
    } catch (requestError) {
      notify(requestError.message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title="Leveling"
        description="Reward activity and celebrate your most active members."
      />
      {error && <ErrorNotice onRetry={reload}>{error}</ErrorNotice>}

      <div className="grid-2 grid-2-wide-right">
        <Card title="Experience" description="Members earn XP by chatting.">
          {data ? (
            <Toggle
              label="Enable leveling"
              description="Awards XP for messages, with a cooldown to prevent spam."
              checked={data.enabled}
              disabled={saving}
              onChange={setEnabled}
            />
          ) : (
            <Skeleton height={48} />
          )}
          {data && (
            <p className="subtle">
              {data.total.toLocaleString()} member
              {data.total === 1 ? '' : 's'} currently ranked.
            </p>
          )}
        </Card>

        <Card title="Level-up notifications" description="Notify members when real XP crosses a level.">
          {data ? (
            <>
              <Toggle
                label="Enable notifications"
                checked={data.levelUpEnabled}
                onChange={(value) => saveLevelUp({ levelUpEnabled: value })}
              />
              <Field label="Notification channel">
                <select
                  value={data.levelUpChannelId || ''}
                  onChange={(event) =>
                    saveLevelUp({ levelUpChannelId: event.target.value })
                  }
                >
                  <option value="">Choose a channel…</option>
                  {(data.channels || []).map((channel) => (
                    <option value={channel.id} key={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Message">
                <textarea
                  rows="3"
                  value={data.levelUpPayload?.description || ''}
                  onChange={(event) =>
                    setData({
                      ...data,
                      levelUpPayload: {
                        ...(data.levelUpPayload || {}),
                        description: event.target.value,
                      },
                    })
                  }
                  onBlur={() => saveLevelUp({ levelUpPayload: data.levelUpPayload })}
                  placeholder="🎉 {user} reached level {level}!"
                />
              </Field>
              <Toggle
                label="Mention member"
                checked={data.levelUpMention}
                onChange={(value) => saveLevelUp({ levelUpMention: value })}
              />
            </>
          ) : <Skeleton height={180} />}
        </Card>

        <Card title="Leaderboard" description="The ten most active members.">
          {!data ? (
            <Skeleton height={220} />
          ) : data.leaderboard.length ? (
            <ol className="list ranking">
              {data.leaderboard.map((entry, index) => (
                <li key={entry.userId}>
                  <span
                    className={`rank ${index < 3 ? `rank-${index + 1}` : ''}`}
                  >
                    {index === 0 ? (
                      <Trophy size={16} aria-label="First place" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="list-main">
                    <strong>{entry.username ?? 'Unknown member'}</strong>
                    <span className="subtle">
                      {entry.messages.toLocaleString()} messages
                    </span>
                  </div>
                  <div className="rank-stats">
                    <strong>Lv. {entry.level}</strong>
                    <span className="subtle">
                      {entry.xp.toLocaleString()} XP
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={TrendingUp} title="No ranking yet">
              Enable leveling and members will appear here as they chat.
            </EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
