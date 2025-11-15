const { dbGet, dbAll } = require('./database');

/**
 * Analytics Functions - Deterministic calculations for financial insights
 * These functions are called by the AI to get accurate data
 */

// 1. Get spending by category
async function getSpendingByCategory(category, startDate, endDate) {
  const sql = `
    SELECT
      SUM(amount) as total,
      COUNT(*) as count,
      AVG(amount) as average,
      MIN(amount) as min,
      MAX(amount) as max,
      GROUP_CONCAT(transaction_id) as transaction_ids
    FROM transactions
    WHERE amount > 0
      AND category LIKE ?
      AND date BETWEEN ? AND ?
  `;

  const result = await dbGet(sql, [`%${category}%`, startDate, endDate]);

  if (!result || result.count === 0) {
    return { total: 0, count: 0, message: 'No transactions found' };
  }

  return {
    category,
    startDate,
    endDate,
    total: parseFloat(result.total.toFixed(2)),
    count: result.count,
    average: parseFloat(result.average.toFixed(2)),
    min: parseFloat(result.min.toFixed(2)),
    max: parseFloat(result.max.toFixed(2)),
    transactionIds: result.transaction_ids ? result.transaction_ids.split(',') : []
  };
}

// 2. Get total spending in a date range
async function getTotalSpending(startDate, endDate) {
  const sql = `
    SELECT
      SUM(amount) as total,
      COUNT(*) as count,
      AVG(amount) as average
    FROM transactions
    WHERE amount > 0
      AND date BETWEEN ? AND ?
      AND pending = 0
  `;

  const result = await dbGet(sql, [startDate, endDate]);

  return {
    startDate,
    endDate,
    total: result.total ? parseFloat(result.total.toFixed(2)) : 0,
    count: result.count || 0,
    average: result.average ? parseFloat(result.average.toFixed(2)) : 0
  };
}

// 3. Get top merchants by spending
async function getTopMerchants(limit = 10, startDate, endDate) {
  const sql = `
    SELECT
      merchant_name,
      SUM(amount) as total,
      COUNT(*) as count,
      AVG(amount) as average,
      category
    FROM transactions
    WHERE amount > 0
      AND merchant_name IS NOT NULL
      AND date BETWEEN ? AND ?
    GROUP BY merchant_name
    ORDER BY total DESC
    LIMIT ?
  `;

  const results = await dbAll(sql, [startDate, endDate, limit]);

  return results.map(r => ({
    merchant: r.merchant_name,
    total: parseFloat(r.total.toFixed(2)),
    count: r.count,
    average: parseFloat(r.average.toFixed(2)),
    category: r.category
  }));
}

// 4. Get spending trend by month
async function getMonthlySpendingTrend(months = 6) {
  const sql = `
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(amount) as total,
      COUNT(*) as count,
      AVG(amount) as average
    FROM transactions
    WHERE amount > 0
      AND date >= date('now', '-${months} months')
    GROUP BY month
    ORDER BY month ASC
  `;

  const results = await dbAll(sql);

  return results.map(r => ({
    month: r.month,
    total: parseFloat(r.total.toFixed(2)),
    count: r.count,
    average: parseFloat(r.average.toFixed(2))
  }));
}

// 5. Get category breakdown
async function getCategoryBreakdown(startDate, endDate) {
  const sql = `
    SELECT
      category,
      SUM(amount) as total,
      COUNT(*) as count,
      ROUND((SUM(amount) * 100.0 / (SELECT SUM(amount) FROM transactions WHERE amount > 0 AND date BETWEEN ? AND ?)), 2) as percentage
    FROM transactions
    WHERE amount > 0
      AND category IS NOT NULL
      AND date BETWEEN ? AND ?
    GROUP BY category
    ORDER BY total DESC
  `;

  const results = await dbAll(sql, [startDate, endDate, startDate, endDate]);

  return results.map(r => ({
    category: r.category,
    total: parseFloat(r.total.toFixed(2)),
    count: r.count,
    percentage: r.percentage
  }));
}

// 6. Get total income
async function getTotalIncome(startDate, endDate) {
  const sql = `
    SELECT
      SUM(ABS(amount)) as total,
      COUNT(*) as count,
      AVG(ABS(amount)) as average
    FROM transactions
    WHERE amount < 0
      AND date BETWEEN ? AND ?
      AND pending = 0
  `;

  const result = await dbGet(sql, [startDate, endDate]);

  return {
    startDate,
    endDate,
    total: result.total ? parseFloat(result.total.toFixed(2)) : 0,
    count: result.count || 0,
    average: result.average ? parseFloat(result.average.toFixed(2)) : 0
  };
}

// 7. Calculate savings rate
async function getSavingsRate(startDate, endDate) {
  const income = await getTotalIncome(startDate, endDate);
  const spending = await getTotalSpending(startDate, endDate);

  if (income.total === 0) {
    return {
      startDate,
      endDate,
      savingsRate: 0,
      message: 'No income found in this period'
    };
  }

  const savings = income.total - spending.total;
  const savingsRate = (savings / income.total) * 100;

  return {
    startDate,
    endDate,
    income: income.total,
    spending: spending.total,
    savings: parseFloat(savings.toFixed(2)),
    savingsRate: parseFloat(savingsRate.toFixed(2))
  };
}

// 8. Compare month over month
async function compareMonthOverMonth(currentMonth, previousMonth) {
  const currentSpending = await getTotalSpending(
    `${currentMonth}-01`,
    `${currentMonth}-31`
  );

  const previousSpending = await getTotalSpending(
    `${previousMonth}-01`,
    `${previousMonth}-31`
  );

  const difference = currentSpending.total - previousSpending.total;
  const percentageChange = previousSpending.total > 0
    ? ((difference / previousSpending.total) * 100)
    : 0;

  return {
    currentMonth,
    previousMonth,
    currentTotal: currentSpending.total,
    previousTotal: previousSpending.total,
    difference: parseFloat(difference.toFixed(2)),
    percentageChange: parseFloat(percentageChange.toFixed(2)),
    trend: difference > 0 ? 'increased' : difference < 0 ? 'decreased' : 'unchanged'
  };
}

// 9. Search transactions
async function searchTransactions(query, limit = 50) {
  const sql = `
    SELECT *
    FROM transactions
    WHERE (name LIKE ? OR merchant_name LIKE ? OR category LIKE ?)
    ORDER BY date DESC
    LIMIT ?
  `;

  const searchPattern = `%${query}%`;
  const results = await dbAll(sql, [searchPattern, searchPattern, searchPattern, limit]);

  return results.map(txn => ({
    id: txn.transaction_id,
    date: txn.date,
    name: txn.name,
    merchant: txn.merchant_name,
    amount: parseFloat(txn.amount),
    category: txn.category
  }));
}

// 10. Get unusual spending (anomaly detection)
async function getUnusualSpending(category, threshold = 2.0) {
  // Get average and standard deviation
  const statsSql = `
    SELECT
      AVG(amount) as avg,
      COUNT(*) as count
    FROM transactions
    WHERE amount > 0
      AND category LIKE ?
  `;

  const stats = await dbGet(statsSql, [`%${category}%`]);

  if (!stats || stats.count < 5) {
    return { message: 'Not enough data for anomaly detection' };
  }

  // Get transactions above threshold
  const anomaliesSql = `
    SELECT *
    FROM transactions
    WHERE amount > 0
      AND category LIKE ?
      AND amount > ? * ?
    ORDER BY amount DESC
    LIMIT 20
  `;

  const anomalies = await dbAll(anomaliesSql, [`%${category}%`, stats.avg, threshold]);

  return {
    category,
    average: parseFloat(stats.avg.toFixed(2)),
    threshold: threshold,
    anomalies: anomalies.map(txn => ({
      id: txn.transaction_id,
      date: txn.date,
      name: txn.name,
      merchant: txn.merchant_name,
      amount: parseFloat(txn.amount),
      timesAboveAverage: parseFloat((txn.amount / stats.avg).toFixed(2))
    }))
  };
}

// 11. Get recurring transactions from DB
async function getRecurringTransactions() {
  const sql = `
    SELECT *
    FROM recurring_streams
    WHERE is_active = 1
    ORDER BY average_amount DESC
  `;

  const results = await dbAll(sql);

  return {
    inflow: results.filter(r => r.type === 'inflow'),
    outflow: results.filter(r => r.type === 'outflow')
  };
}

// 12. Get transactions by date range (for context)
async function getTransactionsByDateRange(startDate, endDate, limit = 100) {
  const sql = `
    SELECT *
    FROM transactions
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC
    LIMIT ?
  `;

  const results = await dbAll(sql, [startDate, endDate, limit]);

  return results.map(txn => ({
    id: txn.transaction_id,
    date: txn.date,
    name: txn.name,
    merchant: txn.merchant_name,
    amount: parseFloat(txn.amount),
    category: txn.category,
    pending: txn.pending === 1
  }));
}

module.exports = {
  getSpendingByCategory,
  getTotalSpending,
  getTopMerchants,
  getMonthlySpendingTrend,
  getCategoryBreakdown,
  getTotalIncome,
  getSavingsRate,
  compareMonthOverMonth,
  searchTransactions,
  getUnusualSpending,
  getRecurringTransactions,
  getTransactionsByDateRange
};
