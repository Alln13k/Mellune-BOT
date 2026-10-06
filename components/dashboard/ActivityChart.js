const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 32 };

const COLORS = {
  members: 'var(--lavender)',
  cases: 'var(--pink)',
  tickets: 'var(--green)',
  joins: 'var(--green)',
  leaves: 'var(--pink)',
  messages: 'var(--lavender)',
  moderation: 'var(--pink)',
  levelUps: 'var(--green)',
};

function labelFor(start, range) {
  const date = new Date(start);
  return range === '24h'
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit' }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
      }).format(date);
}

export default function ActivityChart({ series, range }) {
  const length = series[0]?.points.length ?? 0;
  const peak = Math.max(
    1,
    ...series.flatMap((item) => item.points.map((point) => point.count)),
  );
  const top = Math.max(4, Math.ceil(peak / 4) * 4);
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index) =>
    PAD.left + (length > 1 ? (index / (length - 1)) * innerWidth : 0);
  const y = (count) => PAD.top + innerHeight - (count / top) * innerHeight;
  const ticks = [0, 1, 2, 3, 4].map((step) => (top / 4) * step);
  const labelEvery = Math.ceil(length / 6);
  const total = series.reduce(
    (sum, item) => sum + item.points.reduce((a, p) => a + p.count, 0),
    0,
  );

  return (
    <figure className="chart">
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: COLORS[item.key] }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Activity over the selected period, ${total} events in total`}
      >
        <defs>
          {series.map((item) => (
            <linearGradient
              id={`fill-${item.key}`}
              key={item.key}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={COLORS[item.key]}
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor={COLORS[item.key]}
                stopOpacity="0"
              />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="chart-axis"
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {tick}
            </text>
          </g>
        ))}
        {series[0]?.points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              className="chart-axis"
              key={point.start}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
            >
              {labelFor(point.start, range)}
            </text>
          ) : null,
        )}
        {series.map((item) => {
          const line = item.points
            .map((point, index) => `${x(index)},${y(point.count)}`)
            .join(' ');
          const area = `${x(0)},${y(0)} ${line} ${x(length - 1)},${y(0)}`;
          return (
            <g key={item.key}>
              <polygon points={area} fill={`url(#fill-${item.key})`} />
              <polyline
                points={line}
                fill="none"
                stroke={COLORS[item.key]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {item.points.map((point, index) =>
                point.count > 0 ? (
                  <circle
                    key={point.start}
                    cx={x(index)}
                    cy={y(point.count)}
                    r="3.5"
                    fill={COLORS[item.key]}
                  >
                    <title>
                      {`${item.label}: ${point.count} · ${labelFor(point.start, range)}`}
                    </title>
                  </circle>
                ) : null,
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
