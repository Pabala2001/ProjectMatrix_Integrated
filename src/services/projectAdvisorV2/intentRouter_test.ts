import { deepStrictEqual, ok } from "node:assert/strict";
import {
  normalizeQuestion,
  parseDateRange,
  parseSpecificDate,
  parseDiaryTime,
  parseCategory,
  parseLoggedBy,
  detectTargetField,
  parseDetailsKeyword,
  matchIntent,
} from "./intentRouter";

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

const test = typeof (globalThis as unknown as { Deno?: { test: (name: string, fn: () => void) => void } }).Deno !== "undefined"
  ? (globalThis as unknown as { Deno: { test: (name: string, fn: () => void) => void } }).Deno.test
  : (name: string, fn: () => void) => {
      try {
        fn();
        console.log(`✓ ${name}`);
      } catch (err) {
        console.error(`✗ ${name}`);
        throw err;
      }
    };

// Fixed mock reference date for deterministic testing: Friday 2026-07-31
const MOCK_NOW = new Date("2026-07-31T12:00:00.000Z");

test("Project Advisor 2.0: 1. Question normalisation strips punctuation and standardises casing", () => {
  const input = "  How MANY site diaries ARE recorded??? ";
  const norm = normalizeQuestion(input);
  assertEquals(norm, "how many site diaries are recorded");
});

test("Project Advisor 2.0: 2. Date parser resolves 'today' to exact current date", () => {
  const range = parseDateRange("What was logged today?", MOCK_NOW);
  assert(range !== null);
  assertEquals(range.label, "Today");
  assertEquals(range.startDate, "2026-07-31");
  assertEquals(range.endDate, "2026-07-31");
});

test("Project Advisor 2.0: 3. Specific date parser resolves '1 August 2026' to YYYY-MM-DD", () => {
  const parsed = parseSpecificDate("What was recorded on 1 August 2026?");
  assert(parsed !== null);
  assertEquals(parsed.specificDate, "2026-08-01");
  assertEquals(parsed.formatted, "1 August 2026");
});

test("Project Advisor 2.0: 4. Target field detector identifies 'what time', 'who', 'what category', 'what date'", () => {
  assertEquals(detectTargetField("What time were the site offices delivered?"), "TIME");
  assertEquals(detectTargetField("Who recorded that the site offices were delivered?"), "LOGGER");
  assertEquals(detectTargetField("What category was the site offices delivery recorded under?"), "CATEGORY");
  assertEquals(detectTargetField("What date was the excavation entry logged?"), "DATE");
  assertEquals(detectTargetField("What did Pabala Letuka record on 1 August 2026?"), "DETAILS");
});

test("Project Advisor 2.0: 5. Intent router maps 'What was recorded on 1 August 2026?' to SITE_DIARY_EXACT_MATCH with date filter", () => {
  const match = matchIntent("What was recorded on 1 August 2026?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_EXACT_MATCH");
  if (match.type === "SITE_DIARY_EXACT_MATCH") {
    assertEquals(match.exactFilters.specificDate, "2026-08-01");
    assertEquals(match.exactFilters.targetField, "DETAILS");
  }
});

test("Project Advisor 2.0: 6. Intent router extracts Logger AND Date together for 'What did Pabala Letuka record on 1 August 2026?'", () => {
  const match = matchIntent("What did Pabala Letuka record on 1 August 2026?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_EXACT_MATCH");
  if (match.type === "SITE_DIARY_EXACT_MATCH") {
    assertEquals(match.exactFilters.loggedBy, "Pabala Letuka");
    assertEquals(match.exactFilters.specificDate, "2026-08-01");
    assertEquals(match.exactFilters.targetField, "DETAILS");
  }
});

test("Project Advisor 2.0: 7. Intent router extracts Time AND Date AND Logger for 'What did Pabala Letuka record at 03:05 on 1 August 2026?'", () => {
  const match = matchIntent("What did Pabala Letuka record at 03:05 on 1 August 2026?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_EXACT_MATCH");
  if (match.type === "SITE_DIARY_EXACT_MATCH") {
    assertEquals(match.exactFilters.diaryTime, "03:05");
    assertEquals(match.exactFilters.loggedBy, "Pabala Letuka");
    assertEquals(match.exactFilters.specificDate, "2026-08-01");
    assertEquals(match.exactFilters.targetField, "DETAILS");
  }
});

test("Project Advisor 2.0: 8. Intent router maps 'Who recorded the excavation entry on 1 August 2026?' to targetField LOGGER with AND conditions", () => {
  const match = matchIntent("Who recorded the excavation entry on 1 August 2026?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_EXACT_MATCH");
  if (match.type === "SITE_DIARY_EXACT_MATCH") {
    assertEquals(match.exactFilters.detailsKeyword, "excavation");
    assertEquals(match.exactFilters.specificDate, "2026-08-01");
    assertEquals(match.exactFilters.targetField, "LOGGER");
  }
});

test("Project Advisor 2.0: 9. Intent router maps 'How many site diaries are recorded?' to SITE_DIARY_COUNT", () => {
  const match = matchIntent("How many site diaries are recorded?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_COUNT");
});

test("Project Advisor 2.0: 10. Intent router gives Delays intent highest priority when generic delay question is asked", () => {
  const match = matchIntent("What delays were recorded this week?", MOCK_NOW);
  assertEquals(match.type, "SITE_DIARY_DELAYS");
  if (match.type === "SITE_DIARY_DELAYS") {
    assert(match.dateRange !== null);
    assertEquals(match.dateRange.label, "This Week");
  }
});

test("Project Advisor 2.0: 11. Intent router maps unsupported questions safely to UNSUPPORTED", () => {
  const match = matchIntent("What is the weather forecast for tomorrow?", MOCK_NOW);
  assertEquals(match.type, "UNSUPPORTED");
});
