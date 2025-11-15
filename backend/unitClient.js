const axios = require('axios');
const { dbRun, dbGet, dbAll } = require('./database');

// Unit API configuration
const UNIT_API_URL = process.env.UNIT_API_URL || 'https://api.s.unit.sh';
const UNIT_API_TOKEN = process.env.UNIT_API_TOKEN || 'your_unit_sandbox_token_here';

// Create axios instance for Unit API
const unitApi = axios.create({
  baseURL: UNIT_API_URL,
  headers: {
    'Authorization': `Bearer ${UNIT_API_TOKEN}`,
    'Content-Type': 'application/vnd.api+json'
  }
});

/**
 * Unit API Wrapper
 * Handles all interactions with Unit's Banking API
 */

// ===== Customer Management =====

/**
 * Create a new Unit customer (Individual)
 */
async function createCustomer(customerData) {
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
    ssn = '000000001' // For sandbox testing
  } = customerData;

  try {
    const requestBody = {
      data: {
        type: 'individualApplication',
        attributes: {
          ssn, // For sandbox only
          fullName: {
            first: firstName,
            last: lastName
          },
          dateOfBirth,
          address: {
            street: address,
            city,
            state,
            postalCode,
            country
          },
          email,
          phone: {
            countryCode: '1',
            number: phone
          },
          occupation: 'ArchitectOrEngineer',
          annualIncome: 'Between50kAnd100k',
          sourceOfIncome: 'EmploymentOrPayrollIncome'
        }
      }
    };

    console.log('Creating Unit application with request:', JSON.stringify(requestBody, null, 2));

    // Create application in Unit using API (will auto-approve in sandbox and create customer)
    const response = await unitApi.post('/applications', requestBody);

    console.log('Unit application response:', JSON.stringify(response.data, null, 2));

    // Extract customer ID from the application response
    // In sandbox, application is auto-approved and customer is created
    const applicationId = response.data.data.id;
    const unitCustomerId = response.data.data.relationships?.customer?.data?.id || applicationId;

    // Save to database
    await dbRun(`
      INSERT INTO unit_customers (
        unit_customer_id, first_name, last_name, email, phone,
        date_of_birth, address, city, state, postal_code, country,
        status, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      unitCustomerId,
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
      response.data.data.attributes.status,
      JSON.stringify(response.data.data)
    ]);

    return {
      success: true,
      customerId: unitCustomerId,
      status: response.data.data.attributes.status,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error creating Unit customer:', error.message);
    if (error.response) {
      console.error('Unit API Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    }
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.detail || error.response?.data?.message || error.message
    };
  }
}

/**
 * Get customer by ID
 */
async function getCustomer(customerId) {
  try {
    const response = await unitApi.get(`/customers/${customerId}`);
    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error getting Unit customer:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get customer from database
 */
async function getCustomerFromDb(unitCustomerId) {
  return await dbGet(`
    SELECT * FROM unit_customers WHERE unit_customer_id = ?
  `, [unitCustomerId]);
}

// ===== Account Management =====

/**
 * Create a deposit account (main account)
 */
async function createDepositAccount(customerId, accountName = 'Main Account') {
  try {
    const response = await unitApi.post('/accounts', {
      data: {
        type: 'depositAccount',
        attributes: {
          depositProduct: '8725',
          tags: {
            name: accountName
          }
        },
        relationships: {
          customer: {
            data: {
              type: 'customer',
              id: customerId
            }
          }
        }
      }
    });

    const unitAccountId = response.data.data.id;
    const balance = response.data.data.attributes.balance || 0;

    // Save to database
    await dbRun(`
      INSERT INTO unit_accounts (
        unit_account_id, unit_customer_id, account_type, name,
        balance, status, is_main_account, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      unitAccountId,
      customerId,
      'depositAccount',
      accountName,
      balance,
      response.data.data.attributes.status,
      1, // This is the main account
      JSON.stringify(response.data.data)
    ]);

    return {
      success: true,
      accountId: unitAccountId,
      balance,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error creating deposit account:', error.message);
    if (error.response) {
      console.error('Unit API Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    }
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.title || error.response?.data?.message || error.message
    };
  }
}

/**
 * Create a vault (sub-account)
 */
async function createVault(customerId, vaultData) {
  const { name, purpose, goalAmount } = vaultData;

  try {
    // Create as a deposit account with specific tags
    const requestBody = {
      data: {
        type: 'depositAccount',
        attributes: {
          depositProduct: '8725',
          tags: {
            name,
            purpose,
            type: 'vault'
          }
        },
        relationships: {
          customer: {
            data: {
              type: 'customer',
              id: customerId
            }
          }
        }
      }
    };

    console.log('Creating vault with request:', JSON.stringify(requestBody, null, 2));
    const response = await unitApi.post('/accounts', requestBody);

    const unitAccountId = response.data.data.id;
    const balance = response.data.data.attributes.balance || 0;

    // Save to database
    await dbRun(`
      INSERT INTO unit_accounts (
        unit_account_id, unit_customer_id, account_type, name,
        balance, status, is_main_account, purpose, goal_amount, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      unitAccountId,
      customerId,
      'vault',
      name,
      balance,
      response.data.data.attributes.status,
      0, // Not a main account
      purpose,
      goalAmount || null,
      JSON.stringify(response.data.data)
    ]);

    return {
      success: true,
      vaultId: unitAccountId,
      name,
      balance,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error creating vault:', error.message);
    if (error.response) {
      console.error('Unit API Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    }
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.title || error.response?.data?.message || error.message
    };
  }
}

/**
 * Get account details
 */
async function getAccount(accountId) {
  try {
    const response = await unitApi.get(`/accounts/${accountId}`);
    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error getting account:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all accounts for a customer
 */
async function getCustomerAccounts(customerId) {
  try {
    // Get from database
    const accounts = await dbAll(`
      SELECT * FROM unit_accounts
      WHERE unit_customer_id = ?
      ORDER BY is_main_account DESC, created_at ASC
    `, [customerId]);

    return {
      success: true,
      accounts: accounts.map(acc => ({
        id: acc.unit_account_id,
        type: acc.account_type,
        name: acc.name,
        balance: acc.balance,
        status: acc.status,
        isMainAccount: acc.is_main_account === 1,
        purpose: acc.purpose,
        goalAmount: acc.goal_amount,
        createdAt: acc.created_at
      }))
    };
  } catch (error) {
    console.error('Error getting customer accounts:', error);
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
    UPDATE unit_accounts
    SET balance = ?, updated_at = CURRENT_TIMESTAMP
    WHERE unit_account_id = ?
  `, [newBalance, accountId]);
}

// ===== Transfers =====

/**
 * Create a book transfer (move money between accounts)
 */
async function createBookTransfer(fromAccountId, toAccountId, amount, description) {
  try {
    const response = await unitApi.post('/payments', {
      data: {
        type: 'bookPayment',
        attributes: {
          amount: Math.round(amount * 100), // Convert to cents
          description: description || 'Transfer between accounts',
          direction: 'Credit'
        },
        relationships: {
          account: {
            data: {
              type: 'depositAccount',
              id: fromAccountId
            }
          },
          counterpartyAccount: {
            data: {
              type: 'depositAccount',
              id: toAccountId
            }
          }
        }
      }
    });

    // Save transactions to database
    const transactionId = response.data.data.id;

    // Debit from source
    await dbRun(`
      INSERT INTO unit_transactions (
        unit_transaction_id, unit_account_id, amount, direction,
        description, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `${transactionId}_debit`,
      fromAccountId,
      -amount,
      'Debit',
      description,
      JSON.stringify(response.data.data)
    ]);

    // Credit to destination
    await dbRun(`
      INSERT INTO unit_transactions (
        unit_transaction_id, unit_account_id, amount, direction,
        description, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `${transactionId}_credit`,
      toAccountId,
      amount,
      'Credit',
      description,
      JSON.stringify(response.data.data)
    ]);

    // Update balances (get fresh data from Unit)
    const fromAccount = await getAccount(fromAccountId);
    const toAccount = await getAccount(toAccountId);

    if (fromAccount.success && fromAccount.data) {
      await updateAccountBalance(fromAccountId, fromAccount.data.attributes.balance);
    }

    if (toAccount.success && toAccount.data) {
      await updateAccountBalance(toAccountId, toAccount.data.attributes.balance);
    }

    return {
      success: true,
      transactionId,
      data: response.data.data
    };
  } catch (error) {
    console.error('Error creating book transfer:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get transactions for an account
 */
async function getAccountTransactions(accountId, limit = 50) {
  try {
    const transactions = await dbAll(`
      SELECT * FROM unit_transactions
      WHERE unit_account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [accountId, limit]);

    return {
      success: true,
      transactions: transactions.map(txn => ({
        id: txn.unit_transaction_id,
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

module.exports = {
  // Customer operations
  createCustomer,
  getCustomer,
  getCustomerFromDb,

  // Account operations
  createDepositAccount,
  createVault,
  getAccount,
  getCustomerAccounts,
  updateAccountBalance,

  // Transfer operations
  createBookTransfer,
  getAccountTransactions
};
