import {
  BellRing,
  ChartColumn,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Gavel,
  Gift,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  Megaphone,
  Mic,
  MousePointerClick,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Ticket,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  HeartPulse,
  Database,
} from 'lucide-react';

/** Shared navigation metadata; each page is backed by a guild-scoped API. */
export const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      {
        slug: '',
        title: 'Overview',
        icon: LayoutDashboard,
        ready: true,
        blurb: 'A quiet snapshot of your community.',
      },
    ],
  },
  {
    label: 'Moderation',
    items: [
      {
        slug: 'moderation',
        title: 'Moderation',
        icon: Gavel,
        ready: true,
        blurb: 'Every case, searchable in one place.',
      },
      {
        slug: 'automod',
        title: 'AutoMod',
        icon: ShieldCheck,
        blurb: 'Rules that keep chat tidy without lifting a finger.',
      },
      {
        slug: 'raid-protection',
        title: 'Raid protection',
        icon: ShieldAlert,
        blurb: 'Automatic lockdowns when something looks wrong.',
      },
      {
        slug: 'logs',
        title: 'Logs',
        icon: ScrollText,
        blurb: 'A clear trail of everything that happens.',
      },
    ],
  },
  {
    label: 'Community',
    items: [
      {
        slug: 'tickets',
        title: 'Tickets',
        icon: Ticket,
        ready: true,
        blurb: 'Design the panel your members use to ask for help.',
      },
      {
        slug: 'welcome',
        title: 'Welcome',
        icon: DoorOpen,
        ready: true,
        blurb: 'Greet new members and say goodbye gracefully.',
      },
      {
        slug: 'roles',
        title: 'Roles',
        icon: Tags,
        blurb: 'Reaction roles, menus and self-assignable roles.',
      },
      {
        slug: 'verification',
        title: 'Verification',
        icon: UserCheck,
        blurb: 'Gate your server behind a friendly check.',
      },
      {
        slug: 'leveling',
        title: 'Leveling',
        icon: TrendingUp,
        ready: true,
        blurb: 'Reward activity and celebrate your most active members.',
      },
      {
        slug: 'auto-roles',
        title: 'Auto roles',
        icon: UserPlus,
        blurb: 'Assign safe, persistent roles when members join.',
      },
      {
        slug: 'member-counter',
        title: 'Live member counter',
        icon: Users,
        blurb: 'Display the real server member count in a locked voice channel.',
      },
      {
        slug: 'events',
        title: 'Events',
        icon: CalendarDays,
        blurb: 'Plan events, RSVPs, waitlists and reminders.',
      },
      {
        slug: 'giveaways',
        title: 'Giveaways',
        icon: Gift,
        blurb: 'Run fair giveaways with entry requirements.',
      },
      {
        slug: 'suggestions',
        title: 'Suggestions',
        icon: Lightbulb,
        blurb: 'Let members propose ideas and vote on them.',
      },
      {
        slug: 'applications',
        title: 'Applications',
        icon: ClipboardList,
        blurb: 'Collect and review staff applications.',
      },
      {
        slug: 'temporary-voice',
        title: 'Temporary voice',
        icon: Mic,
        blurb: 'Voice channels that appear on demand and clean up after.',
      },
      {
        slug: 'voice-presence',
        title: 'Always-on voice',
        icon: Mic,
        blurb: 'Keep Mellune connected to a voice channel 24/7.',
      },
      {
        slug: 'reminders',
        title: 'Reminders',
        icon: BellRing,
        blurb: 'Scheduled messages and personal reminders.',
      },
    ],
  },
  {
    label: 'Builders',
    items: [
      {
        slug: 'embeds',
        title: 'Embeds',
        icon: LayoutTemplate,
        blurb: 'Compose rich embeds with a live preview.',
      },
      {
        slug: 'announcements',
        title: 'Announcements',
        icon: Megaphone,
        blurb: 'Schedule and publish announcements.',
      },
      {
        slug: 'interactions',
        title: 'Interactions',
        icon: MousePointerClick,
        blurb: 'Buttons, menus and modals without code.',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        slug: 'analytics',
        title: 'Analytics',
        icon: ChartColumn,
        blurb: 'Growth and engagement over time.',
      },
      {
        slug: 'server-health',
        title: 'Server health',
        icon: HeartPulse,
        blurb: 'Diagnose real Discord, database and configuration health.',
      },
      {
        slug: 'backups',
        title: 'Backups',
        icon: Database,
        blurb: 'Create and safely restore server configuration snapshots.',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        slug: 'settings',
        title: 'Settings',
        icon: Settings,
        ready: true,
        blurb: 'Your account and server details.',
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function hrefFor(item) {
  return item.slug ? `/dashboard/${item.slug}` : '/dashboard';
}

export function findNavItem(pathname) {
  const segment = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  return NAV_ITEMS.find((item) => item.slug === segment);
}
