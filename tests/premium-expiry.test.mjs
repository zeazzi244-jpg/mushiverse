// Standalone regression for the fail-closed premium expiry rule.
import assert from "node:assert/strict";
import test from "node:test";

const isPremium = (row, now) => {
  const periodEnd = row?.current_period_end ? Date.parse(row.current_period_end) : NaN;
  return !!row && row.plan === "premium" && ["trialing", "active"].includes(row.status)
    && Number.isFinite(periodEnd) && periodEnd > now;
};
const now = Date.parse("2026-11-12T00:00:00Z");
test("valid active premium remains active", () =>
  assert.equal(isPremium({plan:"premium",status:"active",current_period_end:"2026-12-12T00:00:00Z"},now),true));
test("expired active premium is not active", () =>
  assert.equal(isPremium({plan:"premium",status:"active",current_period_end:"2026-11-11T00:00:00Z"},now),false));
test("missing expiry fails closed", () =>
  assert.equal(isPremium({plan:"premium",status:"active",current_period_end:null},now),false));
test("invalid expiry fails closed", () =>
  assert.equal(isPremium({plan:"premium",status:"trialing",current_period_end:"invalid"},now),false));
test("cancelled premium fails closed", () =>
  assert.equal(isPremium({plan:"premium",status:"canceled",current_period_end:"2026-12-12T00:00:00Z"},now),false));
test("free plan cannot become premium", () =>
  assert.equal(isPremium({plan:"free",status:"active",current_period_end:"2026-12-12T00:00:00Z"},now),false));
