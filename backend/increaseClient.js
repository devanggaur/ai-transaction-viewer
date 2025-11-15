const axios = require('axios');
const { dbRun, dbGet, dbAll } = require('./database');

// Increase API configuration
const INCREASE_API_URL = process.env.INCREASE_API_URL || 'https://api.increase.com';
const INCREASE_API_KEY = process.env.INCREASE_API_KEY || 'your_increase_sandbox_key_here';

// Create axios instance for Increase API
const increaseApi = axios.create({
  baseURL: INCREASE_API_URL,
  headers: {
    'Authorization': `Bearer ${INCREASE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Increase API Wrapper
 * Handles all interactions with Increase's Banking API
 *
 * Key differences from Unit:
 * - Entities (not customers) - can be natural_person, corporation, trust, etc.
 * - Accounts are separate from account numbers
 * - Account transfers are free and synchronous
 */

// ===== Entity Management (Similar to Customer) =====

/**
 * Create a new Increase entity (Individual/Natural Person)
 * This is equivalent to creating a customer in Unit
 */
async function createEntity(entityData) {
  const {
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    address,
    city,
    state,
    postalCode,
    country = 'US',
    ssn = '123456789' // For sandbox testing
  } = entityData;

  try {
    const requestBody = {
      structure: 'natural_person',
      natural_person: {
        name: `${firstName} ${lastName}`,
        date_of_birth: dateOfBirth, // Format: YYYY-MM-DD
        address: {
          line1: address,
          city,
          state,
          zip: postalCode
        },
        identification: {
          method: 'social_security_number',
          number: ssn // For sandbox only
        }
      }
    };

    console.log('Creating Increase entity with request:', JSON.stringify(requestBody, null, 2));

    const response = await increaseApi.post('/entities', requestBody);

    console.log('Increase entity response:', JSON.stringify(response.data, null, 2));

    const entityId = response.data.id;

    // Save to database
    await dbRun(`
      INSERT INTO increase_entities (
        increase_entity_id, first_name, last_name, email, phone,
        date_of_birth, address, city, state, postal_code, country,
        status, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entityId,
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      city,
      state,
      postalCode,
      country,
      response.data.status || 'active',
      JSON.stringify(response.data)
    ]);

    return {
      success: true,
      entityId,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error creating Increase entity:', error.message);
    if (error.response) {
      console.error('Increase API Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    }
    return {
      success: false,
      error: error.response?.data?.detail || error.response?.data?.title || error.message
    };
  }
}

/**
 * Get entity by ID
 */
async function getEntity(entityId) {
  try {
    const response = await increaseApi.get(`/entities/${entityId}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting Increase entity:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all entities
 */
async function listEntities() {
  try {
    const response = await increaseApi.get('/entities');
    return {
      success: true,
      entities: response.data.data,
      data: response.data
    };
  } catch (error) {
    console.error('Error listing Increase entities:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get entity from database
 */
async function getEntityFromDb(increaseEntityId) {
  return await dbGet(`
    SELECT * FROM increase_entities WHERE increase_entity_id = ?
  `, [increaseEntityId]);
}

// ===== Account Management =====

/**
 * Create an account (main account or vault)
 * In Increase, all accounts are created the same way - we use naming and DB to distinguish vaults
 */
async function createAccount(entityId, accountData) {
  const { name, isMainAccount = false, purpose = null, goalAmount = null } = accountData;

  try {
    const requestBody = {
      name,
      entity_id: entityId
      // program_id is optional - only needed if you have multiple programs
    };

    console.log('Creating Increase account with request:', JSON.stringify(requestBody, null, 2));

    const response = await increaseApi.post('/accounts', requestBody);

    console.log('Increase account response:', JSON.stringify(response.data, null, 2));

    const accountId = response.data.id;

    // Save to database
    const accountType = isMainAccount ? 'main' : 'vault';
    await dbRun(`
      INSERT INTO increase_accounts (
        increase_account_id, increase_entity_id, account_type, name,
        balance, status, is_main_account, purpose, goal_amount, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      accountId,
      entityId,
      accountType,
      name,
      0, // Initial balance is 0
      response.data.status,
      isMainAccount ? 1 : 0,
      purpose,
      goalAmount || null,
      JSON.stringify(response.data)
    ]);

    return {
      success: true,
      accountId,
      name,
      balance: 0,
      data: response.data
    };
  } catch (error) {
    console.error('Error creating Increase account:', error.message);
    if (error.response) {
      console.error('Increase API Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    }
    return {
      success: false,
      error: error.response?.data?.detail || error.response?.data?.title || error.message
    };
  }
}

/**
 * Create a vault (convenience wrapper for createAccount)
 */
async function createVault(entityId, vaultData) {
  return createAccount(entityId, {
    ...vaultData,
    isMainAccount: false
  });
}

/**
 * Get account details and balance
 */
async function getAccount(accountId) {
  try {
    const response = await increaseApi.get(`/accounts/${accountId}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting Increase account:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get account balance
 */
async function getAccountBalance(accountId) {
  try {
    const response = await increaseApi.get(`/accounts/${accountId}/balance`);
    return {
      success: true,
      availableBalance: response.data.available_balance / 100, // Convert cents to dollars
      currentBalance: response.data.current_balance / 100,
      data: response.data
    };
  } catch (error) {
    console.error('Error getting account balance:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all accounts for an entity
 */
async function getEntityAccounts(entityId) {
  try {
    // Get from database
    const accounts = await dbAll(`
      SELECT * FROM increase_accounts
      WHERE increase_entity_id = ?
      ORDER BY is_main_account DESC, created_at ASC
    `, [entityId]);

    // Fetch current balances from Increase API
    const accountsWithBalances = await Promise.all(
      accounts.map(async (acc) => {
        const balanceResult = await getAccountBalance(acc.increase_account_id);
        return {
          id: acc.increase_account_id,
          type: acc.account_type,
          name: acc.name,
          balance: balanceResult.success ? balanceResult.currentBalance : acc.balance,
          availableBalance: balanceResult.success ? balanceResult.availableBalance : acc.balance,
          status: acc.status,
          isMainAccount: acc.is_main_account === 1,
          purpose: acc.purpose,
          goalAmount: acc.goal_amount,
          createdAt: acc.created_at
        };
      })
    );

    return {
      success: true,
      accounts: accountsWithBalances
    };
  } catch (error) {
    console.error('Error getting entity accounts:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update account balance in database
 */
async function updateAccountBalance(accountId, newBalance) {
  await dbRun(`
    UPDATE increase_accounts
    SET balance = ?, updated_at = CURRENT_TIMESTAMP
    WHERE increase_account_id = ?
  `, [newBalance, accountId]);
}

// ===== Transfers =====

/**
 * Create an account transfer (move money between accounts)
 * In Increase, these are free and synchronous!
 */
async function createAccountTransfer(fromAccountId, toAccountId, amount, description) {
  try {
    const requestBody = {
      account_id: fromAccountId,
      destination_account_id: toAccountId,
      amount: Math.round(amount * 100), // Convert dollars to cents
      description: description || 'Transfer between accounts'
    };

    console.log('Creating account transfer:', JSON.stringify(requestBody, null, 2));

    const response = await increaseApi.post('/account_transfers', requestBody);

    console.log('Account transfer response:', JSON.stringify(response.data, null, 2));

    const transferId = response.data.id;

    // Save transactions to database
    await dbRun(`
      INSERT INTO increase_transactions (
        increase_transaction_id, increase_account_id, amount, direction,
        description, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      response.data.transaction_id, // Debit transaction
      fromAccountId,
      -amount,
      'Debit',
      description,
      JSON.stringify(response.data)
    ]);

    await dbRun(`
      INSERT INTO increase_transactions (
        increase_transaction_id, increase_account_id, amount, direction,
        description, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      response.data.destination_transaction_id, // Credit transaction
      toAccountId,
      amount,
      'Credit',
      description,
      JSON.stringify(response.data)
    ]);

    // Update balances in database (fetch fresh data from API)
    const fromAccountBalance = await getAccountBalance(fromAccountId);
    const toAccountBalance = await getAccountBalance(toAccountId);

    if (fromAccountBalance.success) {
      await updateAccountBalance(fromAccountId, fromAccountBalance.currentBalance);
    }

    if (toAccountBalance.success) {
      await updateAccountBalance(toAccountId, toAccountBalance.currentBalance);
    }

    return {
      success: true,
      transferId,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('Error creating account transfer:', error.message);
    if (error.response) {
      console.error('Increase API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.response?.data?.detail || error.response?.data?.title || error.message
    };
  }
}

/**
 * Get transactions for an account
 */
async function getAccountTransactions(accountId, limit = 50) {
  try {
    const transactions = await dbAll(`
      SELECT * FROM increase_transactions
      WHERE increase_account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [accountId, limit]);

    return {
      success: true,
      transactions: transactions.map(txn => ({
        id: txn.increase_transaction_id,
        amount: txn.amount,
        direction: txn.direction,
        description: txn.description,
        balance: txn.balance,
        createdAt: txn.created_at
      }))
    };
  } catch (error) {
    console.error('Error getting account transactions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ===== Sandbox Simulation APIs =====

/**
 * Simulate an inbound ACH transfer (add funds to account) - SANDBOX ONLY
 */
async function simulateInboundACH(accountId, amount, description = 'Test deposit') {
  try {
    const response = await increaseApi.post('/simulations/inbound_ach_transfers', {
      account_id: accountId,
      amount: Math.round(amount * 100), // Convert to cents
      description
    });

    console.log('Simulated inbound ACH:', JSON.stringify(response.data, null, 2));

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error simulating inbound ACH:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

module.exports = {
  // Entity operations (similar to customers)
  createEntity,
  getEntity,
  listEntities,
  getEntityFromDb,

  // Account operations
  createAccount,
  createVault,
  getAccount,
  getAccountBalance,
  getEntityAccounts,
  updateAccountBalance,

  // Transfer operations
  createAccountTransfer,
  getAccountTransactions,

  // Sandbox simulation
  simulateInboundACH
};
