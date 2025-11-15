const { dbRun, dbGet, dbAll } = require('./database');
const locusClient = require('./locusClient');

/**
 * Rewards Manager
 * Handles AI rewards, streak tracking, and gamification
 */

// Get or create user settings
async function getUserSettings(userId = 'default_user') {
  let settings = await dbGet(`
    SELECT * FROM user_settings WHERE user_id = ?
  `, [userId]);

  if (!settings) {
    // Create default settings
    await dbRun(`
      INSERT INTO user_settings (user_id, locus_wallet_balance)
      VALUES (?, 0)
    `, [userId]);

    settings = await dbGet(`
      SELECT * FROM user_settings WHERE user_id = ?
    `, [userId]);
  }

  return settings;
}

// Update user settings
async function updateUserSettings(userId, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await dbRun(`
    UPDATE user_settings
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [...values, userId]);
}

// Calculate streak bonus amount based on streak length
function calculateStreakBonus(streakCount) {
  if (streakCount < 4) return 0;

  // Reward tiers
  if (streakCount >= 12) return 25; // 3 months
  if (streakCount >= 8) return 15;  // 2 months
  if (streakCount >= 4) return 10;  // 1 month

  return 5; // Default
}

// Check and award streak bonus
async function checkAndAwardStreakBonus(userId = 'default_user') {
  const settings = await getUserSettings(userId);

  // Check if user qualifies for a streak bonus (every 4 weeks)
  if (settings.savings_streak > 0 && settings.savings_streak % 4 === 0) {
    const bonusAmount = calculateStreakBonus(settings.savings_streak);

    if (bonusAmount > 0) {
      // Check if we already awarded this streak level
      const existingReward = await dbGet(`
        SELECT * FROM rewards_history
        WHERE streak_count = ? AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 1
      `, [settings.savings_streak]);

      // Only award if we haven't given this streak bonus yet
      if (!existingReward ||
          new Date(existingReward.created_at) < new Date(settings.last_savings_date)) {

        const reason = `🎉 ${settings.savings_streak}-week savings streak bonus!`;

        // For demo: simulate Locus payment
        // In production: execute real Locus transfer
        const locusPaymentId = `reward_${Date.now()}`;

        // Record reward
        await dbRun(`
          INSERT INTO rewards_history (
            reward_type, amount, reason, locus_payment_id, streak_count, status
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, ['streak_bonus', bonusAmount, reason, locusPaymentId, settings.savings_streak, 'completed']);

        // Update total rewards
        await updateUserSettings(userId, {
          total_ai_rewards: settings.total_ai_rewards + bonusAmount,
          locus_wallet_balance: settings.locus_wallet_balance + bonusAmount
        });

        return {
          awarded: true,
          amount: bonusAmount,
          reason,
          newStreak: settings.savings_streak
        };
      }
    }
  }

  return { awarded: false };
}

// Increment savings streak
async function incrementSavingsStreak(userId = 'default_user') {
  const settings = await getUserSettings(userId);
  const today = new Date().toISOString().split('T')[0];

  await updateUserSettings(userId, {
    savings_streak: settings.savings_streak + 1,
    last_savings_date: today
  });

  // Check for streak bonus
  return await checkAndAwardStreakBonus(userId);
}

// Reset savings streak (if user misses a week)
async function resetSavingsStreak(userId = 'default_user') {
  await updateUserSettings(userId, {
    savings_streak: 0
  });
}

// Get rewards history
async function getRewardsHistory(userId = 'default_user', limit = 50) {
  const rewards = await dbAll(`
    SELECT * FROM rewards_history
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);

  return rewards;
}

// Award milestone bonus (when user reaches a savings goal)
async function awardMilestoneBonus(userId, vaultName, goalAmount) {
  const bonusAmount = Math.round(goalAmount * 0.01); // 1% of goal
  const reason = `🎯 Reached ${vaultName} goal of $${goalAmount}!`;

  const locusPaymentId = `milestone_${Date.now()}`;

  await dbRun(`
    INSERT INTO rewards_history (
      reward_type, amount, reason, locus_payment_id, status
    ) VALUES (?, ?, ?, ?, ?)
  `, ['milestone', bonusAmount, reason, locusPaymentId, 'completed']);

  const settings = await getUserSettings(userId);
  await updateUserSettings(userId, {
    total_ai_rewards: settings.total_ai_rewards + bonusAmount,
    locus_wallet_balance: settings.locus_wallet_balance + bonusAmount
  });

  return {
    awarded: true,
    amount: bonusAmount,
    reason
  };
}

// Fund Locus wallet from Increase account
async function fundLocusWallet(amount, sourceAccountId, userId = 'default_user') {
  try {
    const settings = await getUserSettings(userId);

    // For demo: Simulate funding (in production, would trigger actual Increase -> USDC conversion)
    await dbRun(`
      INSERT INTO locus_funding (
        amount, source, source_account_id, locus_balance_after, description
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      amount,
      'increase_account',
      sourceAccountId,
      settings.locus_wallet_balance + amount,
      `Funded AI Wallet with $${amount}`
    ]);

    // Update wallet balance
    await updateUserSettings(userId, {
      locus_wallet_balance: settings.locus_wallet_balance + amount
    });

    return {
      success: true,
      newBalance: settings.locus_wallet_balance + amount,
      amount
    };
  } catch (error) {
    console.error('Error funding Locus wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get Locus wallet balance
async function getLocusWalletBalance(userId = 'default_user') {
  const settings = await getUserSettings(userId);
  return {
    balance: settings.locus_wallet_balance,
    totalRewards: settings.total_ai_rewards,
    currency: 'USDC'
  };
}

// Send charity donation via Locus
async function sendCharityDonation(charityId, amount, userId = 'default_user') {
  try {
    const settings = await getUserSettings(userId);

    // Check balance
    if (settings.locus_wallet_balance < amount) {
      return {
        success: false,
        error: 'Insufficient Locus wallet balance'
      };
    }

    // Get charity info
    const charity = await dbGet(`
      SELECT * FROM charity_recipients WHERE id = ? AND active = 1
    `, [charityId]);

    if (!charity) {
      return {
        success: false,
        error: 'Charity not found'
      };
    }

    // For demo: simulate Locus payment
    const locusPaymentId = `charity_${Date.now()}`;

    // Record payment
    await dbRun(`
      INSERT INTO locus_payments (
        locus_payment_id, to_address, amount, description, status
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      locusPaymentId,
      charity.wallet_address,
      amount,
      `Donation to ${charity.name}`,
      'completed'
    ]);

    // Update wallet balance
    await updateUserSettings(userId, {
      locus_wallet_balance: settings.locus_wallet_balance - amount
    });

    return {
      success: true,
      paymentId: locusPaymentId,
      charity: charity.name,
      amount,
      newBalance: settings.locus_wallet_balance - amount
    };
  } catch (error) {
    console.error('Error sending charity donation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get list of charities
async function getCharities() {
  const charities = await dbAll(`
    SELECT * FROM charity_recipients WHERE active = 1
  `);

  return charities;
}

module.exports = {
  getUserSettings,
  updateUserSettings,
  incrementSavingsStreak,
  resetSavingsStreak,
  checkAndAwardStreakBonus,
  getRewardsHistory,
  awardMilestoneBonus,
  fundLocusWallet,
  getLocusWalletBalance,
  sendCharityDonation,
  getCharities
};
