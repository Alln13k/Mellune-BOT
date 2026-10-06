import {
  ArrowRight,
  Gavel,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Gavel,
    title: 'Moderation, remembered',
    text: 'Every case searchable in one calm place.',
  },
  {
    icon: Ticket,
    title: 'Tickets that feel easy',
    text: 'Design the panel members use to ask for help.',
  },
  {
    icon: TrendingUp,
    title: 'Leveling & welcome',
    text: 'Greet newcomers and reward the regulars.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'Access is limited to the Mellune owner role.',
  },
];

export default function HomePage() {
  return (
    <main className="landing" id="content">
      <section className="hero">
        <div className="brand hero-brand">
          <span className="brand-mark" aria-hidden="true">
            <Moon size={18} strokeWidth={2} />
          </span>
          <span>mellune</span>
        </div>
        <div className="eyebrow">
          <Sparkles size={14} aria-hidden="true" /> Command center
        </div>
        <h1>Make your community feel like home.</h1>
        <p>
          A calm, focused control room for moderation, tickets, automations and
          the small details that make a Discord server feel alive.
        </p>
        <a className="button button-large" href="/api/auth/login">
          Continue with Discord <ArrowRight size={18} aria-hidden="true" />
        </a>
        <p className="hero-note">
          <Lock size={14} aria-hidden="true" /> We only read your Discord
          identity to verify your role.
        </p>
        <ul className="features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="icon-tile" aria-hidden="true">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <div>
                <strong>{title}</strong>
                <span className="subtle block">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
