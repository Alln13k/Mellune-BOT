'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const DashboardContext = createContext(null);

export async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: options?.body
      ? { 'Content-Type': 'application/json', ...options.headers }
      : options?.headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function DashboardProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' });
  const [toasts, setToasts] = useState([]);
  const nextToast = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([request('/api/auth/session'), request('/api/guilds')])
      .then(([session, data]) => {
        if (!active) return;
        const guild = data.guilds[0];
        setState(
          guild
            ? { status: 'ready', user: session.user, guild }
            : {
                status: 'error',
                message:
                  'Mellune has not registered your server yet. Start the bot and try again.',
              },
        );
      })
      .catch((error) => {
        if (active) setState({ status: 'error', message: error.message });
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = 'success') => {
      const id = (nextToast.current += 1);
      setToasts((items) => [...items.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ ...state, notify }), [state, notify]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            {toast.tone === 'error' ? (
              <CircleAlert size={18} aria-hidden="true" />
            ) : (
              <CircleCheck size={18} aria-hidden="true" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used in the dashboard.');
  return context;
}

/** Loads guild-scoped data once the server is known, with reload support. */
export function useGuildData(path) {
  const { status, guild } = useDashboard();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const guildId = status === 'ready' ? guild.id : null;

  const load = useCallback(
    async (signal) => {
      if (!guildId) return;
      setLoading(true);
      try {
        const result = await request(`/api/guilds/${guildId}/${path}`, {
          signal,
        });
        setData(result);
        setError('');
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [guildId, path],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(), [load]);
  return { data, setData, error, loading, reload };
}

export function guildApi(guildId, path, options) {
  return request(`/api/guilds/${guildId}/${path}`, options);
}
