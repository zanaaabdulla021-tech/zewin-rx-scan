// Central place for subscription plan limits — nothing else in the app
// should hard-code a number like "10 users" or "3 branches". Changing a
// limit means editing only this file.
//
// `null` means unlimited.

const PLAN_LIMITS = {
  free: { label: 'Free', maxBranches: 1, maxUsers: 2, maxScansPerMonth: 100 },
  basic: { label: 'Basic', maxBranches: 3, maxUsers: 10, maxScansPerMonth: 2000 },
  business: { label: 'Business', maxBranches: null, maxUsers: null, maxScansPerMonth: 20000 },
  enterprise: { label: 'Enterprise', maxBranches: null, maxUsers: null, maxScansPerMonth: null },
};

const ALLOWED_PLANS = Object.keys(PLAN_LIMITS);

// Per-branch billing: what a company actually owes is its branch count
// times this rate — not tied to which plan tier they're on (the plan
// tier only governs usage limits, above).
const PRICE_PER_BRANCH = { monthly: 10, yearly: 100 };
const ALLOWED_BILLING_CYCLES = Object.keys(PRICE_PER_BRANCH);

function limitsFor(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

// branchCount × the per-branch rate for that billing cycle.
function billingFor(billingCycle, branchCount) {
  const cycle = ALLOWED_BILLING_CYCLES.includes(billingCycle) ? billingCycle : 'monthly';
  const pricePerBranch = PRICE_PER_BRANCH[cycle];
  return {
    cycle,
    pricePerBranch,
    branchCount,
    totalCost: pricePerBranch * branchCount,
    currency: 'USD',
  };
}

module.exports = { PLAN_LIMITS, ALLOWED_PLANS, limitsFor, PRICE_PER_BRANCH, ALLOWED_BILLING_CYCLES, billingFor };
