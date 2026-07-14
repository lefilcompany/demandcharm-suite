import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  adjustDueDateToBusinessDay,
  adjustToBusinessDay,
  calculateBusinessDueDate,
  calculateNextRunDate,
  isAuthorized,
  isValidFrequency,
} from "./lib.ts";

// ---------- isAuthorized ----------
Deno.test("isAuthorized: rejects when secret is missing", () => {
  assertEquals(isAuthorized("Bearer anything", undefined), false);
  assertEquals(isAuthorized("Bearer anything", ""), false);
});

Deno.test("isAuthorized: rejects when header is missing", () => {
  assertEquals(isAuthorized(null, "secret"), false);
  assertEquals(isAuthorized(undefined, "secret"), false);
  assertEquals(isAuthorized("", "secret"), false);
});

Deno.test("isAuthorized: rejects wrong scheme or wrong value", () => {
  assertEquals(isAuthorized("secret", "secret"), false);
  assertEquals(isAuthorized("Bearer wrong", "secret"), false);
  assertEquals(isAuthorized("bearer secret", "secret"), false); // case sensitive
});

Deno.test("isAuthorized: accepts exact Bearer match", () => {
  assertEquals(isAuthorized("Bearer s3cr3t", "s3cr3t"), true);
});

// ---------- isValidFrequency ----------
Deno.test("isValidFrequency accepts the 5 known values", () => {
  for (const f of ["daily", "weekly", "biweekly", "monthly", "yearly"]) {
    assertEquals(isValidFrequency(f), true);
  }
  assertEquals(isValidFrequency("quarterly"), false);
  assertEquals(isValidFrequency(""), false);
  assertEquals(isValidFrequency(null), false);
});

// ---------- adjustToBusinessDay ----------
Deno.test("adjustToBusinessDay: Saturday → Monday", () => {
  // 2026-06-06 is a Saturday
  const sat = new Date("2026-06-06T12:00:00Z");
  const adjusted = adjustToBusinessDay(sat);
  assertEquals(adjusted.toISOString().slice(0, 10), "2026-06-08");
});

Deno.test("adjustToBusinessDay: Sunday → Monday", () => {
  const sun = new Date("2026-06-07T12:00:00Z");
  const adjusted = adjustToBusinessDay(sun);
  assertEquals(adjusted.toISOString().slice(0, 10), "2026-06-08");
});

Deno.test("adjustToBusinessDay: weekday unchanged", () => {
  const wed = new Date("2026-06-10T12:00:00Z");
  assertEquals(adjustToBusinessDay(wed).toISOString().slice(0, 10), "2026-06-10");
});

// ---------- adjustDueDateToBusinessDay ----------
Deno.test("adjustDueDateToBusinessDay returns end-of-day on next business day", () => {
  const iso = adjustDueDateToBusinessDay("2026-06-06"); // Saturday
  assertEquals(iso.slice(0, 10), "2026-06-08");
  assertEquals(iso.endsWith("23:59:59.000Z"), true);
});

// ---------- calculateBusinessDueDate ----------
Deno.test("calculateBusinessDueDate: 8h => +1 business day", () => {
  // Start 2026-06-10 (Wed) + 1 business day => 2026-06-11 (Thu)
  const iso = calculateBusinessDueDate("2026-06-10", 8);
  assertEquals(iso.slice(0, 10), "2026-06-11");
});

Deno.test("calculateBusinessDueDate: skips weekend", () => {
  // Start 2026-06-12 (Fri) + 1 business day => 2026-06-15 (Mon)
  const iso = calculateBusinessDueDate("2026-06-12", 8);
  assertEquals(iso.slice(0, 10), "2026-06-15");
});

Deno.test("calculateBusinessDueDate: <1 hour rounds up to 1 day", () => {
  const iso = calculateBusinessDueDate("2026-06-10", 0.5);
  assertEquals(iso.slice(0, 10), "2026-06-11");
});

// ---------- calculateNextRunDate: daily ----------
Deno.test("daily: simple next-day, weekday", () => {
  assertEquals(calculateNextRunDate("daily", "2026-06-10", null, null), "2026-06-11");
});

Deno.test("daily: from Friday → Monday (skips weekend)", () => {
  assertEquals(calculateNextRunDate("daily", "2026-06-12", null, null), "2026-06-15");
});

// ---------- calculateNextRunDate: weekly ----------
Deno.test("weekly without weekdays: +7 with business adjustment", () => {
  // 2026-06-10 (Wed) + 7 = 2026-06-17 (Wed)
  assertEquals(calculateNextRunDate("weekly", "2026-06-10", null, null), "2026-06-17");
});

Deno.test("weekly with weekdays: picks next configured day this week", () => {
  // 2026-06-10 is Wed (3). Days [1=Mon,5=Fri] → next is Fri 2026-06-12.
  assertEquals(calculateNextRunDate("weekly", "2026-06-10", [1, 5], null), "2026-06-12");
});

Deno.test("weekly with weekdays: wraps to next week's first day", () => {
  // 2026-06-12 is Fri (5). Days [1=Mon] → next Mon 2026-06-15.
  assertEquals(calculateNextRunDate("weekly", "2026-06-12", [1], null), "2026-06-15");
});

// ---------- calculateNextRunDate: monthly ----------
Deno.test("monthly: day_of_month=13 (next month falls on Saturday → Monday)", () => {
  // From 2026-05-13 → next is 2026-06-13 (Sat) → adjusted to 2026-06-15.
  assertEquals(calculateNextRunDate("monthly", "2026-05-13", null, 13), "2026-06-15");
});

// Short-month clamp: Jan 31 → Feb 28 (2026), then business-day shift.
// Feb 28 2026 is a Saturday → adjusted to Mon Mar 2.
Deno.test("monthly: day_of_month=31 clamps to short-month last day", () => {
  assertEquals(calculateNextRunDate("monthly", "2026-01-31", null, 31), "2026-03-02");
});

Deno.test("monthly: day_of_month=31 on a long month keeps the 31st", () => {
  // Mar 31 → Apr 30 (Apr has 30 days). Apr 30 2026 is Thu.
  assertEquals(calculateNextRunDate("monthly", "2026-03-31", null, 31), "2026-04-30");
});

// ---------- calculateNextRunDate: biweekly ----------
Deno.test("biweekly without weekdays: +14", () => {
  // 2026-06-10 (Wed) + 14 = 2026-06-24 (Wed)
  assertEquals(calculateNextRunDate("biweekly", "2026-06-10", null, null), "2026-06-24");
});

// ---------- calculateNextRunDate: yearly ----------
Deno.test("yearly: advances one year and keeps a business day", () => {
  assertEquals(calculateNextRunDate("yearly", "2026-06-10", null, null), "2027-06-10");
});
