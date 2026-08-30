import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExpiry,
  expiryEditorDefaults,
  isHoldIdempotent,
  parseExpiryDateTime,
  parseHoldHours,
  reserveUntilInput,
  shouldReserve,
} from "./hold.ts";

describe("computeExpiry", () => {
  it("adds hold hours to the start time", () => {
    const from = new Date("2026-08-24T12:00:00.000Z");
    assert.equal(
      computeExpiry(from, 72).toISOString(),
      "2026-08-27T12:00:00.000Z",
    );
    assert.equal(
      computeExpiry(from, 24).toISOString(),
      "2026-08-25T12:00:00.000Z",
    );
    assert.equal(
      computeExpiry(from, 168).toISOString(),
      "2026-08-31T12:00:00.000Z",
    );
  });
});

describe("parseHoldHours", () => {
  it("accepts preset and custom hour values", () => {
    assert.equal(parseHoldHours(12), 12);
    assert.equal(parseHoldHours("48"), 48);
    assert.equal(parseHoldHours(720), 720);
  });

  it("falls back to 72 for invalid values", () => {
    assert.equal(parseHoldHours(0), 72);
    assert.equal(parseHoldHours(-1), 72);
    assert.equal(parseHoldHours(9000), 72);
    assert.equal(parseHoldHours("abc"), 72);
  });
});

describe("reserveUntilInput", () => {
  it("sends an ISO timestamp to reserve and null to release", () => {
    const until = new Date("2026-08-30T15:00:00.000Z");
    assert.equal(reserveUntilInput(until), "2026-08-30T15:00:00.000Z");
    assert.equal(reserveUntilInput(null), null);
  });
});

describe("expiryEditorDefaults", () => {
  it("keeps a future expiry and snaps a past one forward", () => {
    const now = new Date(2026, 7, 30, 20, 41, 0, 0);
    const future = expiryEditorDefaults(new Date(2026, 7, 31, 10, 0, 0, 0), now);
    assert.equal(future.date, "2026-08-31");
    assert.equal(future.time, "10:00");

    const snapped = expiryEditorDefaults(new Date(2026, 7, 30, 0, 0, 0, 0), now);
    assert.equal(snapped.date, "2026-08-30");
    assert.equal(snapped.time, "20:43");
  });
});

describe("parseExpiryDateTime", () => {
  const now = new Date(2026, 7, 25, 10, 0, 0, 0);

  it("combines a local date and time", () => {
    const parsed = parseExpiryDateTime("2026-08-28", "17:30", now);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.expiresAt.getFullYear(), 2026);
      assert.equal(parsed.expiresAt.getMonth(), 7);
      assert.equal(parsed.expiresAt.getDate(), 28);
      assert.equal(parsed.expiresAt.getHours(), 17);
      assert.equal(parsed.expiresAt.getMinutes(), 30);
    }
  });

  it("rejects a time in the past", () => {
    const parsed = parseExpiryDateTime("2026-08-25", "09:00", now);
    assert.equal(parsed.ok, false);
  });

  it("rejects a date more than one year away", () => {
    const parsed = parseExpiryDateTime("2028-08-25", "10:00", now);
    assert.equal(parsed.ok, false);
  });
});

describe("shouldReserve", () => {
  it("reserves on invoice_sent status", () => {
    assert.equal(
      shouldReserve("invoice_sent", { status: "invoice_sent" }),
      true,
    );
  });

  it("reserves when invoice_sent_at is set even if status is still open", () => {
    assert.equal(
      shouldReserve("invoice_sent", {
        status: "open",
        invoice_sent_at: "2026-08-24T12:00:00-04:00",
      }),
      true,
    );
  });

  it("does not treat a missing invoice as sent", () => {
    assert.equal(
      shouldReserve("invoice_sent", {
        status: "open",
        invoice_sent_at: null,
      }),
      false,
    );
  });

  it("never reserves a completed draft", () => {
    assert.equal(
      shouldReserve("invoice_sent", {
        status: "completed",
        invoice_sent_at: "2026-08-24T12:00:00-04:00",
      }),
      false,
    );
    assert.equal(
      shouldReserve("draft_created", { status: "COMPLETED" }),
      false,
    );
  });

  it("reserves any non-completed draft when trigger is draft_created", () => {
    assert.equal(shouldReserve("draft_created", { status: "open" }), true);
    assert.equal(
      shouldReserve("draft_created", { status: "invoice_sent" }),
      true,
    );
  });
});

describe("isHoldIdempotent", () => {
  it("creates a hold when none exists and the event is reserve", () => {
    assert.equal(isHoldIdempotent(null, { kind: "reserve" }), "create");
  });

  it("skips paid or deleted events when no hold exists", () => {
    assert.equal(isHoldIdempotent(null, { kind: "paid" }), "skip");
    assert.equal(isHoldIdempotent(null, { kind: "deleted" }), "skip");
  });

  it("does not double-reserve or extend an active hold", () => {
    assert.equal(
      isHoldIdempotent({ status: "active" }, { kind: "reserve" }),
      "skip",
    );
  });

  it("does not reserve again after the draft is paid", () => {
    assert.equal(
      isHoldIdempotent({ status: "paid" }, { kind: "reserve" }),
      "skip",
    );
  });

  it("allows a new reserve after expiry, release, or error", () => {
    assert.equal(
      isHoldIdempotent({ status: "expired" }, { kind: "reserve" }),
      "update",
    );
    assert.equal(
      isHoldIdempotent({ status: "released" }, { kind: "reserve" }),
      "update",
    );
    assert.equal(
      isHoldIdempotent({ status: "error" }, { kind: "reserve" }),
      "update",
    );
  });

  it("marks an existing hold paid once", () => {
    assert.equal(
      isHoldIdempotent({ status: "active" }, { kind: "paid" }),
      "update",
    );
    assert.equal(
      isHoldIdempotent({ status: "paid" }, { kind: "paid" }),
      "skip",
    );
  });

  it("releases an active hold on delete, but not a paid one", () => {
    assert.equal(
      isHoldIdempotent({ status: "active" }, { kind: "deleted" }),
      "update",
    );
    assert.equal(
      isHoldIdempotent({ status: "paid" }, { kind: "deleted" }),
      "skip",
    );
    assert.equal(
      isHoldIdempotent({ status: "released" }, { kind: "deleted" }),
      "skip",
    );
  });
});
