export default function HomePage() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="eyebrow">Mellune / command center</div>
        <h1>Make your community feel like home.</h1>
        <p>
          A calm, focused control room for moderation, tickets, automations and
          the small details that make a Discord server feel alive.
        </p>
        <a className="button" href="/api/auth/login">
          Continue with Discord <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}
