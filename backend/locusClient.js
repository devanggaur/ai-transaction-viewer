const axios = require('axios');
const { dbRun, dbGet, dbAll } = require('./database');

// Locus API configuration
const LOCUS_API_URL = process.env.LOCUS_API_URL || 'https://api.paywithlocus.com';
const LOCUS_API_KEY = process.env.LOCUS_API_KEY;
const LOCUS_WALLET_ADDRESS = process.env.LOCUS_WALLET_ADDRESS;

// Validate Locus configuration
const isLocusConfigured = !!(LOCUS_API_KEY && LOCUS_WALLET_ADDRESS);

if (isLocusConfigured) {
  console.log('✓ Locus configured with API Key:', LOCUS_API_KEY.substring(0, 20) + '...');
  console.log('✓ Locus wallet address:', LOCUS_WALLET_ADDRESS);
} else {
  console.log('⚠ Locus running in demo mode (credentials not configured)');
}

// Create axios instance for Locus API
const locusApi = axios.create({
  baseURL: LOCUS_API_URL,
  headers: {
    'Authorization': `Bearer ${LOCUS_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Locus API Client
 * AI-native payment infrastructure for autonomous payments
 */

// ===== Wallet Management =====

/**
 * Get wallet balance (USDC)
 */
async function getWalletBalance() {
  try {
    const response = await locusApi.get('/v1/wallet/balance');
    return {
      success: true,
      balance: response.data.balance,
      currency: 'USDC',
      data: response.data
    };
  } catch (error) {
    console.error('Error getting wallet balance:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Get wallet address
 */
async function getWalletAddress() {
  try {
    const response = await locusApi.get('/v1/wallet/address');
    return {
      success: true,
      address: response.data.address,
      network: response.data.network,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting wallet address:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// ===== Payment Operations =====

/**
 * Send payment via Locus
 *
 * NOTE: Demo Mode for Hackathon
 * ---------------------------
 * Locus uses MCP (Model Context Protocol) for AI-native payments, not traditional REST APIs.
 * For the hackathon demo, we're simulating Locus transactions in the database while keeping
 * the proper integration architecture. This ensures:
 *   - Reliable demo (no API failures)
 *   - Shows the UX and concept clearly
 *   - Credentials are configured and ready
 *
 * To enable real Locus payments:
 *   1. Install: npm install @locus-technologies/langchain-mcp-m2m
 *   2. Integrate MCP client with your AI chat
 *   3. Payments will execute via natural language through Locus MCP
 *
 * Current mode: DEMO (simulated transactions tracked in database)
 */
async function sendPayment(paymentData) {
  const {
    to,
    amount,
    description = 'AI Savings Agent Transfer',
    policyGroupId = null
  } = paymentData;

  try {
    // DEMO MODE: Generate simulated transaction instead of API call
    console.log('🔷 Locus Demo Transaction:', {
      to,
      amount: `$${amount} USDC`,
      description,
      wallet: LOCUS_WALLET_ADDRESS,
      mode: 'SIMULATED'
    });

    // Simulate successful Locus payment
    const simulatedPaymentId = `locus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const simulatedTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    const response = {
      data: {
        payment_id: simulatedPaymentId,
        transaction_hash: simulatedTxHash,
        status: 'completed',
        amount: parseFloat(amount),
        currency: 'USDC',
        to: to,
        from: LOCUS_WALLET_ADDRESS,
        description: description,
        timestamp: new Date().toISOString()
      }
    };

    /*
    // PRODUCTION MODE (when MCP is integrated):
    const requestBody = {
      to,
      amount: parseFloat(amount),
      currency: 'USDC',
      description,
      ...(policyGroupId && { policy_group_id: policyGroupId })
    };

    const response = await locusApi.post('/v1/payments/send', requestBody);
    */

    console.log('Locus payment response:', JSON.stringify(response.data, null, 2));

    // Save to database
    await dbRun(`
      INSERT INTO locus_payments (
        locus_payment_id, to_address, amount, currency, description,
        status, transaction_hash, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      response.data.payment_id,
      to,
      amount,
      'USDC',
      description,
      response.data.status,
      response.data.transaction_hash || null,
      JSON.stringify(response.data)
    ]);

    return {
      success: true,
      paymentId: response.data.payment_id,
      transactionHash: response.data.transaction_hash,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error sending Locus payment:', error.message);
    if (error.response) {
      console.error('Locus API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Get payment status
 */
async function getPaymentStatus(paymentId) {
  try {
    const response = await locusApi.get(`/v1/payments/${paymentId}`);
    return {
      success: true,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting payment status:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Get payment history
 */
async function getPaymentHistory(limit = 50) {
  try {
    const response = await locusApi.get(`/v1/payments?limit=${limit}`);
    return {
      success: true,
      payments: response.data.payments,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting payment history:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// ===== Policy Management =====

/**
 * Get policy groups
 */
async function getPolicyGroups() {
  try {
    const response = await locusApi.get('/v1/policies');
    return {
      success: true,
      policies: response.data.policies,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting policy groups:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Create policy group
 */
async function createPolicyGroup(policyData) {
  const {
    name,
    monthlyBudget,
    allowedRecipients = [],
    description = ''
  } = policyData;

  try {
    const requestBody = {
      name,
      description,
      rules: {
        monthly_budget: parseFloat(monthlyBudget),
        allowed_recipients: allowedRecipients
      }
    };

    const response = await locusApi.post('/v1/policies', requestBody);

    return {
      success: true,
      policyGroupId: response.data.policy_id,
      data: response.data
    };
  } catch (error) {
    console.error('Error creating policy group:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Check if payment is within policy
 */
async function checkPolicy(policyGroupId, amount, recipient) {
  try {
    const response = await locusApi.post(`/v1/policies/${policyGroupId}/check`, {
      amount: parseFloat(amount),
      recipient
    });

    return {
      success: true,
      allowed: response.data.allowed,
      reason: response.data.reason,
      data: response.data
    };
  } catch (error) {
    console.error('Error checking policy:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// ===== AI Savings Agent Functions =====

/**
 * AI-powered savings analysis and execution
 * This is the core autonomous agent function
 */
async function executeAutonomousSavings(analysisData) {
  const {
    recommendedAmount,
    reason,
    vaultWalletAddress,
    policyGroupId = null
  } = analysisData;

  try {
    console.log('🤖 AI Savings Agent: Analyzing savings opportunity...');
    console.log(`Recommended savings: $${recommendedAmount}`);
    console.log(`Reason: ${reason}`);

    // Step 1: Check policy (if provided)
    if (policyGroupId) {
      const policyCheck = await checkPolicy(policyGroupId, recommendedAmount, vaultWalletAddress);
      if (!policyCheck.success || !policyCheck.allowed) {
        return {
          success: false,
          error: `Policy check failed: ${policyCheck.reason || 'Amount exceeds limits'}`,
          policyViolation: true
        };
      }
    }

    // Step 2: Execute payment via Locus
    const payment = await sendPayment({
      to: vaultWalletAddress,
      amount: recommendedAmount,
      description: `AI Auto-Save: ${reason}`,
      policyGroupId
    });

    if (!payment.success) {
      return {
        success: false,
        error: `Payment failed: ${payment.error}`
      };
    }

    // Step 3: Log autonomous action
    await dbRun(`
      INSERT INTO autonomous_actions (
        action_type, amount, description, locus_payment_id, status, ai_reasoning
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'auto_save',
      recommendedAmount,
      reason,
      payment.paymentId,
      'completed',
      reason
    ]);

    console.log('✅ AI Savings Agent: Successfully executed autonomous savings!');

    return {
      success: true,
      paymentId: payment.paymentId,
      amount: recommendedAmount,
      transactionHash: payment.transactionHash,
      message: `AI Agent saved $${recommendedAmount}: ${reason}`
    };
  } catch (error) {
    console.error('Error in autonomous savings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get autonomous action history
 */
async function getAutonomousActionHistory(limit = 50) {
  try {
    const actions = await dbAll(`
      SELECT * FROM autonomous_actions
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    return {
      success: true,
      actions: actions.map(action => ({
        id: action.id,
        type: action.action_type,
        amount: action.amount,
        description: action.description,
        status: action.status,
        aiReasoning: action.ai_reasoning,
        paymentId: action.locus_payment_id,
        createdAt: action.created_at
      }))
    };
  } catch (error) {
    console.error('Error getting autonomous action history:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  // Wallet operations
  getWalletBalance,
  getWalletAddress,

  // Payment operations
  sendPayment,
  getPaymentStatus,
  getPaymentHistory,

  // Policy management
  getPolicyGroups,
  createPolicyGroup,
  checkPolicy,

  // AI Savings Agent
  executeAutonomousSavings,
  getAutonomousActionHistory
};
