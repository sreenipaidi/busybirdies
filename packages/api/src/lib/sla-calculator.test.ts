import { describe, it, expect } from 'vitest';
import {
  calculateDeadline,
  isWithinBusinessHours,
  getBusinessMinutesElapsed,
} from './sla-calculator.js';
import type { BusinessHours } from './sla-calculator.js';

const DEFAULT_BH: BusinessHours = {
  start: '09:00',
  end: '17:00',
  timezone: 'UTC',
  days: '1,2,3,4,5', // Mon-Fri
};

describe('SLA Calculator', () => {
  describe('calculateDeadline', () => {
    it('should return same time for zero minutes', () => {
      const start = new Date('2026-03-04T10:00:00Z'); // Wednesday
      const result = calculateDeadline(start, 0, DEFAULT_BH);
      expect(result.getTime()).toBe(start.getTime());
    });

    it('should add minutes within the same business day', () => {
      const start = new Date('2026-03-04T10:00:00Z'); // Wednesday 10:00
      const result = calculateDeadline(start, 60, DEFAULT_BH);
      // Should be 11:00 same day
      expect(result.toISOString()).toBe('2026-03-04T11:00:00.000Z');
    });

    it('should carry over to next business day when exceeding daily hours', () => {
      const start = new Date('2026-03-04T16:00:00Z'); // Wednesday 16:00, 1 hour left
      const result = calculateDeadline(start, 120, DEFAULT_BH); // 2 hours needed
      // 1 hour today (ends at 17:00), 1 hour next day (starts at 09:00)
      expect(result.toISOString()).toBe('2026-03-05T10:00:00.000Z');
    });

    it('should skip weekends when calculating deadlines', () => {
      const start = new Date('2026-03-06T16:00:00Z'); // Friday 16:00, 1 hour left
      const result = calculateDeadline(start, 120, DEFAULT_BH); // 2 hours
      // 1 hour Friday (ends at 17:00), skip Sat+Sun, 1 hour Monday
      expect(result.toISOString()).toBe('2026-03-09T10:00:00.000Z');
    });

    it('should handle start time before business hours', () => {
      const start = new Date('2026-03-04T07:00:00Z'); // Wednesday 07:00, before 09:00
      const result = calculateDeadline(start, 60, DEFAULT_BH);
      // Should start counting from 09:00, deadline at 10:00
      expect(result.toISOString()).toBe('2026-03-04T10:00:00.000Z');
    });

    it('should handle start time after business hours', () => {
      const start = new Date('2026-03-04T18:00:00Z'); // Wednesday 18:00, after 17:00
      const result = calculateDeadline(start, 60, DEFAULT_BH);
      // Should start counting from next business day 09:00, deadline at 10:00
      expect(result.toISOString()).toBe('2026-03-05T10:00:00.000Z');
    });

    it('should handle start time on a weekend', () => {
      const start = new Date('2026-03-07T10:00:00Z'); // Saturday
      const result = calculateDeadline(start, 60, DEFAULT_BH);
      // Should start counting from Monday 09:00
      expect(result.toISOString()).toBe('2026-03-09T10:00:00.000Z');
    });

    it('should handle multi-day SLA spanning weekends', () => {
      const start = new Date('2026-03-04T09:00:00Z'); // Wednesday 09:00
      // 8 hours per day * 5 days = 40 hours = 2400 minutes
      // Need all 5 business days: Wed, Thu, Fri, Mon, Tue
      const result = calculateDeadline(start, 2400, DEFAULT_BH);
      // Wed 480min + Thu 480min + Fri 480min + skip Sat+Sun + Mon 480min + Tue 480min = 2400 min
      // Ends at Tuesday March 10 at 17:00
      expect(result.toISOString()).toBe('2026-03-10T17:00:00.000Z');
    });

    it('should handle exactly one business day (480 minutes)', () => {
      const start = new Date('2026-03-04T09:00:00Z'); // Wednesday 09:00
      const result = calculateDeadline(start, 480, DEFAULT_BH);
      // Should be end of same business day
      expect(result.toISOString()).toBe('2026-03-04T17:00:00.000Z');
    });

    it('should fall back to calendar minutes when no business hours configured', () => {
      const bh: BusinessHours = {
        start: '09:00',
        end: '09:00', // 0 minutes per day
        timezone: 'UTC',
        days: '1,2,3,4,5',
      };
      const start = new Date('2026-03-04T10:00:00Z');
      const result = calculateDeadline(start, 60, bh);
      expect(result.toISOString()).toBe('2026-03-04T11:00:00.000Z');
    });

    it('should fall back to calendar minutes when no business days configured', () => {
      const bh: BusinessHours = {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC',
        days: '',
      };
      const start = new Date('2026-03-04T10:00:00Z');
      const result = calculateDeadline(start, 60, bh);
      expect(result.toISOString()).toBe('2026-03-04T11:00:00.000Z');
    });
  });

  describe('isWithinBusinessHours', () => {
    it('should return true for time during business hours on a business day', () => {
      const time = new Date('2026-03-04T12:00:00Z'); // Wednesday 12:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(true);
    });

    it('should return true at the start of business hours', () => {
      const time = new Date('2026-03-04T09:00:00Z'); // Wednesday 09:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(true);
    });

    it('should return false at exactly the end of business hours', () => {
      const time = new Date('2026-03-04T17:00:00Z'); // Wednesday 17:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(false);
    });

    it('should return false before business hours', () => {
      const time = new Date('2026-03-04T08:00:00Z'); // Wednesday 08:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(false);
    });

    it('should return false after business hours', () => {
      const time = new Date('2026-03-04T18:00:00Z'); // Wednesday 18:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(false);
    });

    it('should return false on a weekend day', () => {
      const time = new Date('2026-03-07T12:00:00Z'); // Saturday 12:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(false);
    });

    it('should return false on Sunday', () => {
      const time = new Date('2026-03-08T12:00:00Z'); // Sunday 12:00
      expect(isWithinBusinessHours(time, DEFAULT_BH)).toBe(false);
    });
  });

  describe('getBusinessMinutesElapsed', () => {
    it('should return 0 when end is before start', () => {
      const start = new Date('2026-03-04T12:00:00Z');
      const end = new Date('2026-03-04T10:00:00Z');
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(0);
    });

    it('should return 0 when start equals end', () => {
      const time = new Date('2026-03-04T12:00:00Z');
      expect(getBusinessMinutesElapsed(time, time, DEFAULT_BH)).toBe(0);
    });

    it('should count minutes within a single business day', () => {
      const start = new Date('2026-03-04T10:00:00Z'); // Wednesday 10:00
      const end = new Date('2026-03-04T12:00:00Z');   // Wednesday 12:00
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(120);
    });

    it('should not count minutes outside business hours', () => {
      const start = new Date('2026-03-04T16:00:00Z'); // Wednesday 16:00
      const end = new Date('2026-03-05T10:00:00Z');   // Thursday 10:00
      // Only 1 hour on Wednesday (16:00-17:00) + 1 hour Thursday (09:00-10:00) = 120 min
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(120);
    });

    it('should not count weekend time', () => {
      const start = new Date('2026-03-06T16:00:00Z'); // Friday 16:00
      const end = new Date('2026-03-09T10:00:00Z');   // Monday 10:00
      // 1 hour Friday (16:00-17:00) + 1 hour Monday (09:00-10:00) = 120 min
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(120);
    });

    it('should count a full business day as 480 minutes', () => {
      const start = new Date('2026-03-04T09:00:00Z'); // Wednesday 09:00
      const end = new Date('2026-03-04T17:00:00Z');   // Wednesday 17:00
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(480);
    });

    it('should handle start time before business hours', () => {
      const start = new Date('2026-03-04T07:00:00Z'); // Wednesday 07:00
      const end = new Date('2026-03-04T10:00:00Z');   // Wednesday 10:00
      // Only 09:00 to 10:00 = 60 min
      expect(getBusinessMinutesElapsed(start, end, DEFAULT_BH)).toBe(60);
    });
  });
});
