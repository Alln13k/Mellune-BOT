'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, LogOut, Menu, Moon, X } from 'lucide-react';
import { DashboardProvider, useDashboard } from './DashboardContext';
import { NAV_GROUPS, findNavItem, hrefFor } from './nav';
import { Avatar, Skeleton } from './ui';

function isActive(pathname, item) {
  const href = hrefFor(item);
  return item.slug ? pathname.startsWith(href) : pathname === '/dashboard';
}

function Brand() {
  return (
    <Link className="brand" href="/dashboard">
      <span className="brand-mark" aria-hidden="true">
        <Moon size={18} strokeWidth={2} />
      </span>
      <span>mellune</span>
    </Link>
  );
}

function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { status, user, guild } = useDashboard();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/';
  }

  return (
    <>
      <div
        className={`scrim ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${open ? 'is-open' : ''}`}
        aria-label="Dashboard"
      >
        <div className="sidebar-top">
          <Brand />
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="server-card">
          {status === 'ready' ? (
            <>
              <span className="server-icon" aria-hidden="true">
                {guild.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="server-meta">
                <strong title={guild.name}>{guild.name}</strong>
                <span className="subtle">Managed server</span>
              </div>
            </>
          ) : (
            <Skeleton height={40} />
          )}
        </div>

        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.title}
                    href={hrefFor(item)}
                    className={`nav-link ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="profile">
          {user ? (
            <>
              <Avatar user={user} />
              <div className="profile-meta">
                <strong>{user.global_name || user.username}</strong>
                <span className="subtle">@{user.username}</span>
              </div>
            </>
          ) : (
            <Skeleton height={36} />
          )}
          <button
            type="button"
            className="icon-button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}

function Frame({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { status, message } = useDashboard();
  const current = findNavItem(pathname);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  return (
    <div className="dashboard">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="workspace">
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <strong>{current?.title ?? 'Dashboard'}</strong>
        </div>
        <main className="main" id="content">
          {status === 'error' ? (
            <section className="card access-card">
              <span className="icon-tile icon-tile-lg" aria-hidden="true">
                <Moon size={24} />
              </span>
              <h1>We could not open your console.</h1>
              <p className="error">{message}</p>
              <a className="button" href="/api/auth/login">
                Sign in with Discord <ArrowRight size={16} aria-hidden="true" />
              </a>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  return (
    <DashboardProvider>
      <Frame>{children}</Frame>
    </DashboardProvider>
  );
}
