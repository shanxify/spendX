'use strict';

/**
 * financeContext.js — Server-side financial context builder for ArthX AI Assistant.
 *
 * Queries the authenticated user's transactions from Supabase and returns a
 * compact, structured summary suitable for injection into the Gemini system prompt.
 *
 * Security model:
 *  - Receives a pre-authenticated Supabase client (service-role key + user's token).
 *  - All queries are hard-scoped to the verified user.id.
 *  - Never returns raw personal data to the client.
 *  - Follows the EXACT same calculation rules as Dashboard.jsx.
 */

// ── Date helpers ──────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function previousMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function monthLabel(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Core aggregation (mirrors Dashboard.jsx calculations exactly) ─────────────

function aggregateTransactions(txns, openingBalance = 0) {
  const nonFailed = (txns || []).filter(t => t.status !== 'Failed');
  const debits    = nonFailed.filter(t => t.type === 'debit');
  const credits   = nonFailed.filter(t => t.type === 'credit');

  // Totals
  const totalExpenses = Math.round(debits.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) * 100) / 100;
  const totalIncome   = Math.round(credits.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) * 100) / 100;
  const transactionCount = (txns || []).length; // ALL (matches dashboard's transactionCount)

  // Balance calculations:
  // Current Balance = Opening Balance + Total Income - Total Expenses (matches Dashboard.jsx stats.totals.net formula)
  const currentBalance = Math.round(((openingBalance || 0) + totalIncome - totalExpenses) * 100) / 100;
  // Net Transaction Balance = Total Income - Total Expenses (pure cashflow excluding opening balance)
  const transactionBalance = Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Average: expenses / ALL-transaction-count (matches Dashboard.jsx formula)
  const avgTransaction = transactionCount > 0
    ? Math.round((totalExpenses / transactionCount) * 100) / 100
    : 0;

  // Category breakdown (expenses only)
  const catMap = {};
  debits.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
    catMap[cat].total += parseFloat(t.amount) || 0;
    catMap[cat].count++;
  });
  const categories = Object.entries(catMap)
    .map(([name, { total, count }]) => ({
      name,
      total: Math.round(total * 100) / 100,
      count,
      percentage: totalExpenses > 0 ? ((total / totalExpenses) * 100).toFixed(1) : '0.0',
    }))
    .sort((a, b) => b.total - a.total);

  // Top merchants by spend (expenses only, top 5)
  const merchantMap = {};
  debits.forEach(t => {
    const key = t.normalizedMerchant || t.merchant || 'Unknown';
    if (!merchantMap[key]) merchantMap[key] = { display: t.merchant || key, total: 0, count: 0, category: t.category || 'Uncategorized' };
    merchantMap[key].total += parseFloat(t.amount) || 0;
    merchantMap[key].count++;
  });
  const sortedBySpend = Object.values(merchantMap)
    .map(m => ({ ...m, total: Math.round(m.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
  const topMerchants = sortedBySpend.slice(0, 5);

  // Most frequent merchant (tiebreak by spend)
  const mostFrequent = [...Object.values(merchantMap)]
    .sort((a, b) => b.count !== a.count ? b.count - a.count : b.total - a.total)[0] || null;

  // Biggest single expense
  const biggestExpenseRow = debits.reduce(
    (max, t) => (parseFloat(t.amount) || 0) > (parseFloat(max.amount) || 0) ? t : max,
    debits[0] || null
  );
  const biggestExpense = biggestExpenseRow ? {
    merchant: biggestExpenseRow.merchant || 'Unknown',
    amount: Math.round((parseFloat(biggestExpenseRow.amount) || 0) * 100) / 100,
    date: biggestExpenseRow.date,
    category: biggestExpenseRow.category || 'Uncategorized',
  } : null;

  return {
    openingBalance: Math.round((openingBalance || 0) * 100) / 100,
    totalExpenses,
    totalIncome,
    net: currentBalance, // Matches Dashboard.jsx stats.totals.net
    currentBalance,
    transactionBalance,
    netTransactions: transactionBalance,
    transactionCount,
    avgTransaction,
    categories,
    topMerchants,
    mostFrequent,
    biggestExpense,
  };
}

// ── Supabase query helper ─────────────────────────────────────────────────────

/**
 * Fetches all transactions for a given user within an optional date range.
 * Throws if the Supabase query fails.
 */
async function fetchTransactions(supabase, userId, { from, to } = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    return [];
  }

  let query = supabase
    .from('transactions')
    .select('type, amount, category, merchant, normalizedMerchant, date, status')
    .eq('user_id', userId);

  if (from) query = query.gte('date', from);
  if (to)   query = query.lte('date', to);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  return data || [];
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Builds a compact, structured financial context object for the authenticated user.
 *
 * @param {object} supabase           Authenticated Supabase client (already has user token set)
 * @param {string} userId             Verified user ID (from Supabase Auth, never client-supplied)
 * @param {object|number} [optionsOrBalance=0] Options object { openingBalance } or numeric opening balance
 * @returns {object}                  { summary: string, raw: object, dateRanges: object }
 *                                    or throws on DB error
 */
async function buildFinanceContext(supabase, userId, optionsOrBalance = {}) {
  let openingBalance = 0;
  if (typeof optionsOrBalance === 'number') {
    openingBalance = optionsOrBalance;
  } else if (optionsOrBalance && typeof optionsOrBalance === 'object') {
    if (optionsOrBalance.openingBalance !== undefined && optionsOrBalance.openingBalance !== null) {
      openingBalance = Number(optionsOrBalance.openingBalance) || 0;
    }
  }

  if (openingBalance === 0 && supabase && supabase.auth && typeof supabase.auth.getUser === 'function') {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.user_metadata?.opening_balance !== undefined) {
        openingBalance = Number(data.user.user_metadata.opening_balance) || 0;
      } else if (data?.user?.user_metadata?.openingBalance !== undefined) {
        openingBalance = Number(data.user.user_metadata.openingBalance) || 0;
      }
    } catch {
      // Ignore if auth lookup fails
    }
  }

  if (openingBalance === 0 && process.env.OPENING_BALANCE !== undefined) {
    const envVal = Number(process.env.OPENING_BALANCE);
    if (!isNaN(envVal) && isFinite(envVal)) {
      openingBalance = envVal;
    }
  }

  const currentRange  = currentMonthRange();
  const previousRange = previousMonthRange();

  // Parallel queries: all-time, current month, previous month
  const [allTxns, currentTxns, previousTxns] = await Promise.all([
    fetchTransactions(supabase, userId),
    fetchTransactions(supabase, userId, currentRange),
    fetchTransactions(supabase, userId, previousRange),
  ]);

  const allTime  = aggregateTransactions(allTxns, openingBalance);
  const current  = aggregateTransactions(currentTxns, 0);
  const previous = aggregateTransactions(previousTxns, 0);

  const hasData = (allTxns && allTxns.length > 0);

  // ── Build compact text summary for Gemini system prompt ──────────────────
  const lines = [];

  if (!hasData) {
    lines.push('USER FINANCIAL DATA: No transactions found. The user has not uploaded any transaction data yet.');
    if (allTime.openingBalance > 0) {
      lines.push(`Opening Balance recorded: ${formatINR(allTime.openingBalance)}. Current Balance: ${formatINR(allTime.currentBalance)}.`);
    }
    lines.push('Do not invent or assume any financial figures. Encourage the user to upload their transaction PDF first.');
  } else {
    const curLabel = monthLabel(currentRange.from);
    const prevLabel = monthLabel(previousRange.from);

    lines.push('=== USER FINANCIAL SUMMARY (verified from Supabase, do NOT invent data) ===');
    lines.push('');
    lines.push('-- ALL-TIME SUMMARY --');
    lines.push(`Total Transactions: ${allTime.transactionCount}`);
    lines.push(`Opening Balance: ${formatINR(allTime.openingBalance)}`);
    lines.push(`Total Income: ${formatINR(allTime.totalIncome)}`);
    lines.push(`Total Expenses: ${formatINR(allTime.totalExpenses)}`);
    lines.push(`Current Balance / Net Balance (Opening Balance + Total Income - Total Expenses): ${formatINR(allTime.currentBalance)}`);
    lines.push(`Net Transaction Balance (Total Income - Total Expenses, excluding opening balance): ${formatINR(allTime.transactionBalance)}`);
    lines.push(`Average Transaction Amount: ${formatINR(allTime.avgTransaction)}`);

    if (allTime.biggestExpense) {
      lines.push(`Biggest Single Expense: ${formatINR(allTime.biggestExpense.amount)} at ${allTime.biggestExpense.merchant} (${allTime.biggestExpense.category}) on ${allTime.biggestExpense.date}`);
    }

    lines.push('');
    lines.push('-- SPENDING BY CATEGORY (all-time, descending) --');
    if (allTime.categories.length > 0) {
      allTime.categories.forEach(c => {
        lines.push(`  ${c.name}: ${formatINR(c.total)} (${c.count} txns, ${c.percentage}%)`);
      });
    } else {
      lines.push('  No expense categories found.');
    }

    lines.push('');
    lines.push('-- TOP 5 MERCHANTS BY SPEND (all-time, expenses only) --');
    if (allTime.topMerchants.length > 0) {
      allTime.topMerchants.forEach((m, i) => {
        lines.push(`  ${i + 1}. ${m.display}: ${formatINR(m.total)} (${m.count} transactions, category: ${m.category})`);
      });
    } else {
      lines.push('  No merchant data found.');
    }

    if (allTime.mostFrequent) {
      lines.push(`Most Frequently Used Merchant: ${allTime.mostFrequent.display} (${allTime.mostFrequent.count} transactions)`);
    }

    lines.push('');
    lines.push(`-- ${curLabel.toUpperCase()} (current month) --`);
    lines.push(`Date Range: ${currentRange.from} to ${currentRange.to}`);
    lines.push(`Expenses: ${formatINR(current.totalExpenses)} | Income: ${formatINR(current.totalIncome)} | Transactions: ${current.transactionCount}`);

    if (current.categories.length > 0) {
      lines.push('  Top categories this month:');
      current.categories.slice(0, 5).forEach(c => {
        lines.push(`    ${c.name}: ${formatINR(c.total)} (${c.percentage}%)`);
      });
    }

    lines.push('');
    lines.push(`-- ${prevLabel.toUpperCase()} (previous month) --`);
    lines.push(`Date Range: ${previousRange.from} to ${previousRange.to}`);
    lines.push(`Expenses: ${formatINR(previous.totalExpenses)} | Income: ${formatINR(previous.totalIncome)} | Transactions: ${previous.transactionCount}`);

    // Month-over-month comparison
    const expChangePct = previous.totalExpenses > 0
      ? (((current.totalExpenses - previous.totalExpenses) / previous.totalExpenses) * 100).toFixed(1)
      : null;
    if (expChangePct !== null) {
      const direction = parseFloat(expChangePct) >= 0 ? 'increase' : 'decrease';
      lines.push(`Month-over-Month Expense Change: ${Math.abs(expChangePct)}% ${direction} (${prevLabel} → ${curLabel})`);
    }

    lines.push('');
    lines.push('=== END OF USER FINANCIAL SUMMARY ===');
  }

  return {
    summary: lines.join('\n'),
    hasData,
    dateRanges: { currentRange, previousRange },
    raw: { allTime, current, previous },
  };
}

module.exports = { buildFinanceContext };
