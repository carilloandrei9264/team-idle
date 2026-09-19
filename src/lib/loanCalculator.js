import { numericValue } from "./number.js";

export function calculateLoanPrincipal(propertyPrice, downPaymentPercent) {
  const price = numericValue(propertyPrice, 0);
  const downPercent = Math.min(Math.max(numericValue(downPaymentPercent, 0), 0), 100);

  if (price <= 0) return 0;
  return Math.max(price * (1 - downPercent / 100), 0);
}

export function calculateMonthlyPayment(propertyPrice, downPaymentPercent, annualInterestRate, termYears) {
  const principal = calculateLoanPrincipal(propertyPrice, downPaymentPercent);
  const years = Math.max(numericValue(termYears, 0), 0);
  const months = Math.max(Math.round(years * 12), 0);
  const annualRate = Math.max(numericValue(annualInterestRate, 0), 0);

  if (principal <= 0 || months <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;

  const denominator = 1 - Math.pow(1 + monthlyRate, -months);
  if (denominator === 0) return 0;

  return principal * (monthlyRate / denominator);
}

export function calculateTotalInterest(principal, monthlyPayment, termYears) {
  const loanPrincipal = numericValue(principal, 0);
  const payment = numericValue(monthlyPayment, 0);
  const years = Math.max(numericValue(termYears, 0), 0);
  const months = Math.max(Math.round(years * 12), 0);

  if (loanPrincipal <= 0 || payment <= 0 || months <= 0) return 0;

  const totalPaid = payment * months;
  return Math.max(totalPaid - loanPrincipal, 0);
}
