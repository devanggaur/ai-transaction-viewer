const { dbRun, dbGet, dbAll } = require('./database');

/**
 * Weekly Challenges Manager
 *
 * Behavioral Economics Insight: Gamified challenges with visual progress
 * increase engagement 20-30% (Digit, MoneySavingExpert data)
 *
 * Simple Challenge: "Save $5 every day for 7 days"
 */

/**
 * Get or create this week's challenge
 */
async function getActiveChallenge(userId = 'default_user') {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    // Check if there's an active challenge for this week
    const existingChallenge = await dbGet(`
      SELECT * FROM weekly_challenges
      WHERE start_date = ? AND active = 1
      LIMIT 1
    `, [startOfWeek.toISOString().split('T')[0]]);

    let challenge;
    if (existingChallenge) {
      challenge = existingChallenge;
    } else {
      // Create this week's challenge
      const result = await dbRun(`
        INSERT INTO weekly_challenges (
          challenge_type, title, description, goal_days, reward_amount,
          start_date, end_date, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'daily_savings',
        '7-Day Savings Streak',
        'Save $5 every day for 7 days straight!',
        7,
        10.0, // $10 reward
        startOfWeek.toISOString().split('T')[0],
        endOfWeek.toISOString().split('T')[0],
        1
      ]);

      challenge = {
        id: result.lastID,
        challenge_type: 'daily_savings',
        title: '7-Day Savings Streak',
        description: 'Save $5 every day for 7 days straight!',
        goal_days: 7,
        reward_amount: 10.0,
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: endOfWeek.toISOString().split('T')[0],
        active: 1
      };
    }

    // Get user's progress on this challenge
    let progress = await dbGet(`
      SELECT * FROM user_challenge_progress
      WHERE user_id = ? AND challenge_id = ?
    `, [userId, challenge.id]);

    if (!progress) {
      // Create initial progress record
      await dbRun(`
        INSERT INTO user_challenge_progress (
          user_id, challenge_id, days_completed, status
        ) VALUES (?, ?, ?, ?)
      `, [userId, challenge.id, 0, 'active']);

      progress = {
        id: null,
        user_id: userId,
        challenge_id: challenge.id,
        days_completed: 0,
        last_save_date: null,
        status: 'active',
        completed_at: null,
        reward_claimed: 0
      };
    }

    return {
      success: true,
      challenge: {
        ...challenge,
        progress: progress.days_completed,
        goalDays: challenge.goal_days,
        rewardAmount: challenge.reward_amount,
        isCompleted: progress.status === 'completed',
        rewardClaimed: progress.reward_claimed === 1
      }
    };
  } catch (error) {
    console.error('Error getting active challenge:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Record a save action towards the challenge
 */
async function recordSaveForChallenge(userId = 'default_user', amount = 5) {
  try {
    const challengeData = await getActiveChallenge(userId);

    if (!challengeData.success) {
      return { success: false, error: 'No active challenge' };
    }

    const challenge = challengeData.challenge;

    // Check if already saved today
    const today = new Date().toISOString().split('T')[0];
    const progress = await dbGet(`
      SELECT * FROM user_challenge_progress
      WHERE user_id = ? AND challenge_id = ?
    `, [userId, challenge.id]);

    if (progress.last_save_date === today) {
      return {
        success: true,
        message: 'Already saved today!',
        alreadySavedToday: true,
        progress: progress.days_completed,
        goalDays: challenge.goalDays
      };
    }

    // Increment progress
    const newProgress = progress.days_completed + 1;
    const isNowCompleted = newProgress >= challenge.goalDays;

    await dbRun(`
      UPDATE user_challenge_progress
      SET days_completed = ?,
          last_save_date = ?,
          status = ?,
          completed_at = ?
      WHERE user_id = ? AND challenge_id = ?
    `, [
      newProgress,
      today,
      isNowCompleted ? 'completed' : 'active',
      isNowCompleted ? new Date().toISOString() : null,
      userId,
      challenge.id
    ]);

    return {
      success: true,
      progress: newProgress,
      goalDays: challenge.goalDays,
      isCompleted: isNowCompleted,
      rewardAmount: isNowCompleted ? challenge.rewardAmount : 0,
      message: isNowCompleted
        ? `🎉 Challenge complete! You earned $${challenge.rewardAmount}!`
        : `✅ Day ${newProgress}/${challenge.goalDays} complete!`
    };
  } catch (error) {
    console.error('Error recording save for challenge:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Claim reward for completed challenge
 */
async function claimChallengeReward(userId = 'default_user') {
  try {
    const challengeData = await getActiveChallenge(userId);

    if (!challengeData.success) {
      return { success: false, error: 'No active challenge' };
    }

    const challenge = challengeData.challenge;

    if (!challenge.isCompleted) {
      return { success: false, error: 'Challenge not completed yet' };
    }

    if (challenge.rewardClaimed) {
      return { success: false, error: 'Reward already claimed' };
    }

    // Mark reward as claimed
    await dbRun(`
      UPDATE user_challenge_progress
      SET reward_claimed = 1
      WHERE user_id = ? AND challenge_id = ?
    `, [userId, challenge.id]);

    // Add reward to Locus wallet
    await dbRun(`
      UPDATE user_settings
      SET locus_wallet_balance = locus_wallet_balance + ?,
          total_ai_rewards = total_ai_rewards + ?
      WHERE user_id = ?
    `, [challenge.rewardAmount, challenge.rewardAmount, userId]);

    // Record in rewards history
    await dbRun(`
      INSERT INTO rewards_history (
        reward_type, amount, reason, status
      ) VALUES (?, ?, ?, ?)
    `, [
      'challenge_completion',
      challenge.rewardAmount,
      `Completed: ${challenge.title}`,
      'completed'
    ]);

    return {
      success: true,
      message: `$${challenge.rewardAmount} added to your AI Wallet!`,
      rewardAmount: challenge.rewardAmount
    };
  } catch (error) {
    console.error('Error claiming challenge reward:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getActiveChallenge,
  recordSaveForChallenge,
  claimChallengeReward
};
