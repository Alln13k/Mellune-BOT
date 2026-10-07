import { CircleAlert } from 'lucide-react';

export function PageHeader({ icon: Icon, title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-title">
        {Icon && (
          <span className="icon-tile icon-tile-lg" aria-hidden="true">
            <Icon size={22} strokeWidth={1.75} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {description && <p className="subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, action, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <div className="card-heading">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="subtle">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'lavender' }) {
  return (
    <article className={`card stat stat-${tone}`}>
      <span className="icon-tile" aria-hidden="true">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty-state">
      <span className="icon-tile icon-tile-lg" aria-hidden="true">
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <strong>{title}</strong>
      {children && <p className="subtle">{children}</p>}
    </div>
  );
}

export function ErrorNotice({ children, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="button button-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%' }) {
  return <span className="skeleton" style={{ height, width }} aria-hidden />;
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        {description && <span className="subtle block">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="toggle"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options = [],
  hint,
  placeholder = 'Choose an option…',
  disabled = false,
  getLabel = (option) => option.name,
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="select-control"
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function RoleSelect({
  label = 'Role',
  value,
  onChange,
  roles = [],
  hint,
  placeholder = 'Choose a role…',
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      options={roles.filter((role) => !role.managed && role.name !== '@everyone')}
      hint={hint}
      placeholder={placeholder}
      getLabel={(role) => `@${role.name}`}
    />
  );
}

export function RoleMultiSelect({
  label = 'Roles',
  value = [],
  onChange,
  roles = [],
  hint,
}) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const availableRoles = roles.filter(
    (role) => !role.managed && role.name !== '@everyone',
  );
  return (
    <Field label={label} hint={hint}>
      <div className="role-picker" role="group" aria-label={label}>
        {availableRoles.length ? (
          availableRoles.map((role) => (
            <label className={`role-option${selected.has(role.id) ? ' is-selected' : ''}`} key={role.id}>
              <input
                type="checkbox"
                checked={selected.has(role.id)}
                onChange={() => {
                  const next = new Set(selected);
                  if (next.has(role.id)) next.delete(role.id);
                  else next.add(role.id);
                  onChange([...next]);
                }}
              />
              <span
                className="role-dot"
                style={{
                  backgroundColor: role.color
                    ? `#${role.color.toString(16).padStart(6, '0')}`
                    : undefined,
                }}
              />
              <span className="role-option-name">@{role.name}</span>
              {selected.has(role.id) && <span className="role-check">Selected</span>}
            </label>
          ))
        ) : (
          <span className="field-hint">No selectable roles are available.</span>
        )}
      </div>
    </Field>
  );
}

export function Avatar({ user, size = 36 }) {
  const name = user?.global_name || user?.username || '?';
  const src = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
    : null;
  return src ? (
    <img
      className="avatar"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatRelative(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(seconds, 'second');
}
