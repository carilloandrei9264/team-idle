import test from "node:test";
import assert from "node:assert/strict";

import { calculateLoanPrincipal, calculateMonthlyPayment, calculateTotalInterest } from "./loanCalculator.js";

test("calculateLoanPrincipal reduces the price by the down payment percent", () => {
  assert.equal(calculateLoanPrincipal(1_000_000, 20), 800_000);
});

test("calculateMonthlyPayment reflects a standard fixed-rate amortization schedule", () => {
  const payment = calculateMonthlyPayment(1_000_000, 20, 7, 20);
  assert.ok(Math.abs(payment - 6202.39) < 0.05, `Expected about 6202.39, received ${payment}`);
});

test("calculateTotalInterest uses the financed principal and the full payment schedule", () => {
  const principal = calculateLoanPrincipal(1_000_000, 20);
  const payment = calculateMonthlyPayment(1_000_000, 20, 7, 20);
  assert.ok(Math.abs(calculateTotalInterest(principal, payment, 20) - 688_574) < 5000, `Expected ~688574, received ${calculateTotalInterest(principal, payment, 20)}`);
});

test("invalid or zero-value loan inputs resolve safely to zero", () => {
  assert.equal(calculateLoanPrincipal(null, "invalid"), 0);
  assert.equal(calculateMonthlyPayment(0, 20, 7, 20), 0);
  assert.equal(calculateTotalInterest(0, 2000, 20), 0);
});
