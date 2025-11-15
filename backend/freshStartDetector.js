const { dbRun, dbGet } = require('./database');

/**
 * Fresh-Start Days Detector
 *
 * Behavioral Economics Insight: People are 2x more likely to pursue goals
 * around temporal landmarks (Milkman et al., Management Science, 2014)
 *
 * Detects:
 * - New month (1st)
 * - New week (Monday)
 * - New year (Jan 1)
 * - User birthday (if configured)
 */

/**
 * Check if today is a fresh start day
 */
function detectFreshStart(userSettings = {}) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
  const month = today.getMonth(); // 0 = January

  const freshStarts = [];

  // 1. New Year
  if (month === 0 && dayOfMonth === 1) {
    freshStarts.push({
      type: 'new_year',
      priority: 1,
      title: '🎊 Happy New Year!',
      message: "It's a new year — the perfect time for fresh financial habits!",
      suggestedBump: 20, // Suggest 20% increase
      emoji: '🎊'
    });
  }

  // 2. New Month
  if (dayOfMonth === 1 && month !== 0) { // Exclude Jan 1 (already covered)
    freshStarts.push({
      type: 'new_month',
      priority: 2,
      title: '🌱 New Month, Fresh Start!',
      message: "It's a new month — a great time to level up your savings!",
      suggestedBump: 10, // Suggest 10% increase
      emoji: '🌱'
    });
  }

  // 3. New Week (Monday)
  if (dayOfWeek === 1) {
    freshStarts.push({
      type: 'new_week',
      priority: 3,
      title: '💪 Monday Momentum!',
      message: "New week, new you — let's boost your savings this week!",
      suggestedBump: 5, // Suggest 5% increase
      emoji: '💪'
    });
  }

  // 4. User Birthday (if provided)
  if (userSettings.birthday) {
    const birthday = new Date(userSettings.birthday);
    if (today.getMonth() === birthday.getMonth() &&
        today.getDate() === birthday.getDate()) {
      freshStarts.push({
        type: 'birthday',
        priority: 1,
        title: '🎂 Happy Birthday!',
        message: "It's your birthday — start your new year around the sun with stronger savings!",
        suggestedBump: 15, // Suggest 15% increase
        emoji: '🎂'
      });
    }
  }

  // Return highest priority fresh start (if any)
  if (freshStarts.length > 0) {
    freshStarts.sort((a, b) => a.priority - b.priority);
    return {
      isFreshStart: true,
      ...freshStarts[0]
    };
  }

  return {
    isFreshStart: false,
    message: 'No fresh start detected today'
  };
}

/**
 * Check if user has already been prompted today
 */
async function shouldShowFreshStartPrompt(userId = 'default_user') {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const lastPrompt = await dbGet(`
      SELECT last_fresh_start_prompt
      FROM user_settings
      WHERE user_id = ?
    `, [userId]);

    if (!lastPrompt || !lastPrompt.last_fresh_start_prompt) {
      return true; // Never prompted
    }

    // Check if last prompt was today
    const lastPromptDate = lastPrompt.last_fresh_start_prompt.split('T')[0];
    return lastPromptDate !== today;
  } catch (error) {
    console.error('Error checking fresh start prompt:', error);
    return true; // Default to showing prompt on error
  }
}

/**
 * Record that we showed the fresh start prompt
 */
async function recordFreshStartPrompt(userId = 'default_user') {
  try {
    await dbRun(`
      UPDATE user_settings
      SET last_fresh_start_prompt = ?
      WHERE user_id = ?
    `, [new Date().toISOString(), userId]);
    return { success: true };
  } catch (error) {
    console.error('Error recording fresh start prompt:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's current auto-save settings
 */
async function getCurrentAutoSave(userId = 'default_user') {
  try {
    const settings = await dbGet(`
      SELECT auto_save_amount, auto_save_percentage
      FROM user_settings
      WHERE user_id = ?
    `, [userId]);

    return {
      amount: settings?.auto_save_amount || 0,
      percentage: settings?.auto_save_percentage || 0
    };
  } catch (error) {
    console.error('Error getting auto-save settings:', error);
    return { amount: 0, percentage: 0 };
  }
}

/**
 * Apply fresh start bump to auto-save
 */
async function applyFreshStartBump(userId = 'default_user', bumpPercentage = 10) {
  try {
    const current = await getCurrentAutoSave(userId);

    // Calculate new amounts
    const newAmount = current.amount * (1 + bumpPercentage / 100);
    const newPercentage = current.percentage * (1 + bumpPercentage / 100);

    await dbRun(`
      UPDATE user_settings
      SET auto_save_amount = ?,
          auto_save_percentage = ?
      WHERE user_id = ?
    `, [newAmount, newPercentage, userId]);

    return {
      success: true,
      oldAmount: current.amount,
      newAmount: newAmount,
      oldPercentage: current.percentage,
      newPercentage: newPercentage,
      bumpPercentage: bumpPercentage
    };
  } catch (error) {
    console.error('Error applying fresh start bump:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main function to check and get fresh start prompt
 */
async function getFreshStartPrompt(userId = 'default_user') {
  try {
    // Get user settings
    const userSettings = await dbGet(`
      SELECT * FROM user_settings WHERE user_id = ?
    `, [userId]);

    // Detect fresh start
    const freshStart = detectFreshStart(userSettings || {});

    if (!freshStart.isFreshStart) {
      return {
        shouldShow: false,
        reason: 'Not a fresh start day'
      };
    }

    // Check if already prompted today
    const shouldShow = await shouldShowFreshStartPrompt(userId);

    if (!shouldShow) {
      return {
        shouldShow: false,
        reason: 'Already prompted today'
      };
    }

    // Get current auto-save for context
    const currentAutoSave = await getCurrentAutoSave(userId);

    return {
      shouldShow: true,
      freshStart: {
        ...freshStart,
        currentAutoSave: currentAutoSave,
        newAutoSaveAmount: currentAutoSave.amount * (1 + freshStart.suggestedBump / 100),
        newAutoSavePercentage: currentAutoSave.percentage * (1 + freshStart.suggestedBump / 100)
      }
    };
  } catch (error) {
    console.error('Error getting fresh start prompt:', error);
    return {
      shouldShow: false,
      error: error.message
    };
  }
}

module.exports = {
  detectFreshStart,
  shouldShowFreshStartPrompt,
  recordFreshStartPrompt,
  getCurrentAutoSave,
  applyFreshStartBump,
  getFreshStartPrompt
};
