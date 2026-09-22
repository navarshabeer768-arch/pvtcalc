import { describe, expect, it } from 'vitest';
import { dateSeparatorLabel, groupByDate } from './dateGrouping';

describe('dateSeparatorLabel', () => {
  const now = new Date('2026-09-23T12:00:00');

  it('labels today and yesterday', () => {
    expect(dateSeparatorLabel('2026-09-23T09:00:00', now)).toBe('Today');
    expect(dateSeparatorLabel('2026-09-22T09:00:00', now)).toBe('Yesterday');
  });

  it('labels the past week by weekday', () => {
    const label = dateSeparatorLabel('2026-09-19T09:00:00', now);
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    expect(label).not.toMatch(/\d{4}/);
  });

  it('falls back to a full date beyond a week', () => {
    expect(dateSeparatorLabel('2026-01-01T09:00:00', now)).toContain('2026');
  });
});

describe('groupByDate', () => {
  it('groups consecutive same-day items together', () => {
    const items = [
      { createdAt: '2026-09-23T09:00:00' },
      { createdAt: '2026-09-23T10:00:00' },
      { createdAt: '2026-09-22T09:00:00' },
    ];
    const groups = groupByDate(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });
});
