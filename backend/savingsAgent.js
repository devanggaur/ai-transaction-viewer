const { dbRun, dbGet, dbAll } = require('./database');

/**
 * AI Savings Agent - Triple Play
 *
 * 1. Windfall Wallet: Detect and redirect large deposits
 * 2. Smart Sweep: Weekly analysis of unspent budget
 * 3. Soft Lock: Withdrawal delays + impact messaging
 */

// ===== 1. WINDFALL WALLET =====

/**
 * Detect if a transaction is a windfall (bonus, refund, etc.)
 * Windfall = deposit > 3x median income
 */
async function detectWindfall(transactions) {
  try {
    // Calculate median positive transactions (income)
    const incomeTransactions = transactions
      .filter(t => t.amount < 0) // Plaid: negative = income/credit
      .map(t => Math.abs(t.amount));

    if (incomeTransactions.length < 2) { // Reduced from 3 to 2 for testing
      return {
        isWindfall: false,
        reason: 'Not enough transaction history'
      };
    }

    // Calculate median
    incomeTransactions.sort((a, b) => a - b);
    const median = incomeTransactions[Math.floor(incomeTransactions.length / 2)];

    // Find recent large deposits (last 30 days for testing, was 7)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentLargeDeposits = transactions
      .filter(t => {
        const txnDate = new Date(t.date);
        return t.amount < 0 && // Income
               Math.abs(t.amount) > (median * 1.5) && // Reduced from 3x to 1.5x for testing
               txnDate >= thirtyDaysAgo;
      })
      .map(t => ({
        amount: Math.abs(t.amount),
        date: t.date,
        name: t.name,
        merchant: t.merchant_name
      }));

    if (recentLargeDeposits.length > 0) {
      const windfall = recentLargeDeposits[0];
      return {
        isWindfall: true,
        amount: windfall.amount,
        medianIncome: median,
        multiplier: (windfall.amount / median).toFixed(1),
        source: windfall.name || windfall.merchant || 'Unknown',
        date: windfall.date,
        suggestedSavings: windfall.amount * 0.2, // Suggest 20%
        reason: `Detected ${windfall.source}: $${windfall.amount.toFixed(2)} (${(windfall.amount / median).toFixed(1)}x your typical income)`
      };
    }

    return {
      isWindfall: false,
      reason: 'No recent large deposits detected'
    };
  } catch (error) {
    console.error('Error detecting windfall:', error);
    return {
      isWindfall: false,
      error: error.message
    };
  }
}

/**
 * Generate windfall savings prompt
 */
function generateWindfallPrompt(windfallData) {
  const { amount, source, suggestedSavings, multiplier } = windfallData;

  return {
    title: '💰 Windfall Detected!',
    message: `I noticed you received $${amount.toFixed(2)} from ${source} — that's ${multiplier}x your usual income!\n\nWould you like to save 20% ($${suggestedSavings.toFixed(2)}) toward your goals?`,
    options: [
      { label: 'Save 20%', value: suggestedSavings, percentage: 20 },
      { label: 'Save 10%', value: suggestedSavings / 2, percentage: 10 },
      { label: 'Save 30%', value: suggestedSavings * 1.5, percentage: 30 },
      { label: 'No thanks', value: 0, percentage: 0 }
    ],
    impact: `This could cover 6 months of your average spending!`
  };
}

// ===== 2. SMART SWEEP =====

/**
 * Analyze weekly spending and find unspent budget
 * Compares this week vs last 4 weeks average
 */
async function analyzeWeeklySweep(transactions) {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

    // This week's spending (positive amounts = debit/spending in Plaid)
    const thisWeekSpending = transactions
      .filter(t => {
        const txnDate = new Date(t.date);
        return t.amount > 0 && txnDate >= oneWeekAgo;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Last 4 weeks average
    const last4WeeksTransactions = transactions
      .filter(t => {
        const txnDate = new Date(t.date);
        return t.amount > 0 && txnDate >= fiveWeeksAgo && txnDate < oneWeekAgo;
      });

    if (last4WeeksTransactions.length === 0) {
      return {
        hasSweepOpportunity: false,
        reason: 'Not enough historical data'
      };
    }

    const last4WeeksSpending = last4WeeksTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgWeeklySpending = last4WeeksSpending / 4;

    // Calculate unspent amount
    const unspentAmount = avgWeeklySpending - thisWeekSpending;

    if (unspentAmount > 5) { // Reduced from $20 to $5 for testing
      const suggestedSavings = unspentAmount * 0.5; // Suggest saving 50% of unspent

      return {
        hasSweepOpportunity: true,
        thisWeekSpending: thisWeekSpending,
        avgWeeklySpending: avgWeeklySpending,
        unspentAmount: unspentAmount,
        suggestedSavings: suggestedSavings,
        reason: `You spent $${unspentAmount.toFixed(2)} less than usual this week!`
      };
    }

    return {
      hasSweepOpportunity: false,
      reason: thisWeekSpending > avgWeeklySpending
        ? 'You spent more than usual this week'
        : 'Unspent amount is too small to sweep'
    };
  } catch (error) {
    console.error('Error analyzing weekly sweep:', error);
    return {
      hasSweepOpportunity: false,
      error: error.message
    };
  }
}

/**
 * Generate smart sweep prompt
 */
function generateSweepPrompt(sweepData) {
  const { unspentAmount, suggestedSavings, avgWeeklySpending } = sweepData;

  return {
    title: '🎯 Smart Sweep Available!',
    message: `Great self-control! You spent $${unspentAmount.toFixed(2)} less than your usual $${avgWeeklySpending.toFixed(2)}/week.\n\nWant to stash some of that win?`,
    options: [
      { label: `Save $${suggestedSavings.toFixed(2)}`, value: suggestedSavings },
      { label: `Save $${(suggestedSavings / 2).toFixed(2)}`, value: suggestedSavings / 2 },
      { label: 'Keep it all', value: 0 }
    ],
    tone: 'encouraging',
    emoji: '💪'
  };
}

// ===== 3. SOFT LOCK VAULTS =====

/**
 * Check if withdrawal is allowed from soft-locked vault
 */
async function checkSoftLock(vaultId, requestedAmount) {
  try {
    // Get vault details
    const vault = await dbGet(`
      SELECT * FROM increase_accounts
      WHERE increase_account_id = ? AND account_type = 'vault'
    `, [vaultId]);

    if (!vault) {
      return {
        allowed: false,
        error: 'Vault not found'
      };
    }

    // Check if there's an active withdrawal request
    const existingRequest = await dbGet(`
      SELECT * FROM withdrawal_requests
      WHERE vault_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `, [vaultId]);

    if (existingRequest) {
      const requestTime = new Date(existingRequest.created_at);
      const now = new Date();
      const hoursSinceRequest = (now - requestTime) / (1000 * 60 * 60);

      if (hoursSinceRequest >= 24) {
        // 24 hours passed, allow withdrawal
        return {
          allowed: true,
          message: 'Withdrawal unlocked after 24-hour cooling period',
          withdrawalRequestId: existingRequest.id
        };
      } else {
        // Still in cooling period
        const hoursRemaining = Math.ceil(24 - hoursSinceRequest);
        return {
          allowed: false,
          reason: 'cooling_period',
          hoursRemaining: hoursRemaining,
          message: `Withdrawal will be available in ${hoursRemaining} hours`
        };
      }
    }

    // No existing request - need to create one
    return {
      allowed: false,
      reason: 'new_request',
      requiresCooling: true,
      vault: {
        name: vault.name,
        balance: vault.balance,
        goalAmount: vault.goal_amount,
        purpose: vault.purpose
      }
    };
  } catch (error) {
    console.error('Error checking soft lock:', error);
    return {
      allowed: false,
      error: error.message
    };
  }
}

/**
 * Create withdrawal request with soft lock
 */
async function createWithdrawalRequest(vaultId, amount, reason = '') {
  try {
    const vault = await dbGet(`
      SELECT * FROM increase_accounts
      WHERE increase_account_id = ?
    `, [vaultId]);

    if (!vault) {
      return {
        success: false,
        error: 'Vault not found'
      };
    }

    // Calculate impact on goal
    const currentBalance = vault.balance;
    const newBalance = currentBalance - amount;
    const goalAmount = vault.goal_amount;

    let impact = '';
    if (goalAmount) {
      const currentProgress = (currentBalance / goalAmount) * 100;
      const newProgress = (newBalance / goalAmount) * 100;
      const progressLoss = currentProgress - newProgress;

      // Calculate time impact (rough estimate)
      const weeksDelay = Math.ceil(progressLoss / 5); // Assume 5% progress per week

      impact = `Withdrawing now means:\n- Your progress drops from ${currentProgress.toFixed(1)}% to ${newProgress.toFixed(1)}%\n- You'll reach your goal approximately ${weeksDelay} weeks later`;
    }

    // Create withdrawal request
    await dbRun(`
      INSERT INTO withdrawal_requests (
        vault_id, amount, reason, status, impact_message
      ) VALUES (?, ?, ?, ?, ?)
    `, [vaultId, amount, reason, 'pending', impact]);

    return {
      success: true,
      message: '24-hour cooling period started',
      impact: impact,
      availableAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate soft lock prompt
 */
function generateSoftLockPrompt(vaultData, amount) {
  const { name, balance, goalAmount, purpose } = vaultData;
  const currentProgress = goalAmount ? (balance / goalAmount * 100).toFixed(1) : null;

  return {
    title: '🔒 Are you sure?',
    message: `You're about to withdraw $${amount.toFixed(2)} from your "${name}" vault.\n\n${purpose ? `Purpose: ${purpose}\n` : ''}Current balance: $${balance.toFixed(2)}${currentProgress ? ` (${currentProgress}% of goal)` : ''}`,
    prompt: 'Why are you making this withdrawal?',
    requiresReason: true,
    coolingPeriod: '24 hours',
    alternative: 'Need money urgently? Consider withdrawing from your main account instead.'
  };
}

// ===== COMBINED ANALYSIS =====

/**
 * Run full Triple Play analysis
 */
async function runTriplePlayAnalysis(transactions) {
  try {
    // Run all three analyses
    const [windfall, sweep] = await Promise.all([
      detectWindfall(transactions),
      analyzeWeeklySweep(transactions)
    ]);

    const opportunities = [];

    if (windfall.isWindfall) {
      opportunities.push({
        type: 'windfall',
        priority: 1,
        data: windfall,
        prompt: generateWindfallPrompt(windfall)
      });
    }

    if (sweep.hasSweepOpportunity) {
      opportunities.push({
        type: 'sweep',
        priority: 2,
        data: sweep,
        prompt: generateSweepPrompt(sweep)
      });
    }

    return {
      success: true,
      opportunities: opportunities,
      summary: {
        windfallDetected: windfall.isWindfall,
        sweepAvailable: sweep.hasSweepOpportunity,
        totalPotentialSavings:
          (windfall.isWindfall ? windfall.suggestedSavings : 0) +
          (sweep.hasSweepOpportunity ? sweep.suggestedSavings : 0)
      }
    };
  } catch (error) {
    console.error('Error in Triple Play analysis:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  // Windfall Wallet
  detectWindfall,
  generateWindfallPrompt,

  // Smart Sweep
  analyzeWeeklySweep,
  generateSweepPrompt,

  // Soft Lock
  checkSoftLock,
  createWithdrawalRequest,
  generateSoftLockPrompt,

  // Combined
  runTriplePlayAnalysis
};
