const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const RANGES = {
  '24h': { buckets: 24, size: HOUR },
  '7d': { buckets: 7, size: DAY },
  '30d': { buckets: 30, size: DAY },
};

function parseRange(value) {
  return Object.hasOwn(RANGES, value) ? value : '7d';
}

function getRangeStart(range, now = new Date()) {
  const { buckets, size } = RANGES[parseRange(range)];
  return new Date(alignToBucket(now.getTime(), size) - (buckets - 1) * size);
}

function alignToBucket(timestamp, size) {
  return Math.floor(timestamp / size) * size;
}

/**
 * Groups dates into fixed-size UTC buckets ending at `now`, so charts always
 * render a continuous series even when some buckets contain no events.
 */
function bucketize(dates, range, now = new Date()) {
  const { buckets, size } = RANGES[parseRange(range)];
  const lastBucket = alignToBucket(now.getTime(), size);
  const firstBucket = lastBucket - (buckets - 1) * size;
  const series = Array.from({ length: buckets }, (_, index) => ({
    start: new Date(firstBucket + index * size).toISOString(),
    count: 0,
  }));
  for (const value of dates) {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp) || timestamp < firstBucket) continue;
    const index = Math.floor((timestamp - firstBucket) / size);
    if (index >= 0 && index < buckets) series[index].count += 1;
  }
  return series;
}

module.exports = { RANGES, parseRange, getRangeStart, bucketize };
