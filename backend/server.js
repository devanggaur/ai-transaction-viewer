require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const OpenAI = require('openai');
const { saveTransactions, saveRecurringStream } = require('./database');
const analytics = require('./analytics');
const unitClient = require('./unitClient');
const increaseClient = require('./increaseClient');
const savingsAgent = require('./savingsAgent');
const { dbGet, dbAll, dbRun } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// OpenAI client configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Store access tokens (in production, use a database)
const accessTokens = {};

// Create Link Token
app.post('/api/create_link_token', async (req, res) => {
  try {
    const request = {
      user: {
        client_user_id: 'user-' + Date.now(),
      },
      client_name: 'Transaction Viewer',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exchange public token for access token
app.post('/api/exchange_public_token', async (req, res) => {
  try {
    const { public_token } = req.body;

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store access token (in production, save to database with user association)
    accessTokens[itemId] = accessToken;

    res.json({
      access_token: accessToken,
      item_id: itemId
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Transactions
app.post('/api/transactions', async (req, res) => {
  try {
    const {
      access_token,
      start_date,
      end_date,
      count
    } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const request = {
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
      options: {
        count: count || 100,
        offset: 0,
      },
    };

    const response = await plaidClient.transactionsGet(request);

    res.json({
      transactions: response.data.transactions,
      accounts: response.data.accounts,
      total_transactions: response.data.total_transactions,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Account Info
app.post('/api/accounts', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await plaidClient.accountsGet({
      access_token: access_token,
    });

    res.json({ accounts: response.data.accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Item (shows available products for this connection)
app.post('/api/item', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await plaidClient.itemGet({
      access_token: access_token,
    });

    res.json({ item: response.data.item });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Recurring Transactions
app.post('/api/recurring_transactions', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await plaidClient.transactionsRecurringGet({
      access_token: access_token,
    });

    res.json({
      inflow_streams: response.data.inflow_streams,
      outflow_streams: response.data.outflow_streams,
    });
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync transactions to database
app.post('/api/sync_to_database', async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    console.log('Syncing transactions to database...');

    // Fetch transactions from Plaid
    const txnResponse = await plaidClient.transactionsGet({
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
      options: {
        count: 500,
        offset: 0,
      },
    });

    // Save transactions to database
    await saveTransactions(txnResponse.data.transactions);

    // Fetch and save recurring transactions
    try {
      const recurringResponse = await plaidClient.transactionsRecurringGet({
        access_token: access_token,
      });

      // Save inflow streams
      if (recurringResponse.data.inflow_streams) {
        for (const stream of recurringResponse.data.inflow_streams) {
          await saveRecurringStream(stream, 'inflow');
        }
      }

      // Save outflow streams
      if (recurringResponse.data.outflow_streams) {
        for (const stream of recurringResponse.data.outflow_streams) {
          await saveRecurringStream(stream, 'outflow');
        }
      }
    } catch (recurringError) {
      console.log('Recurring transactions not available or error:', recurringError.message);
    }

    res.json({
      success: true,
      message: 'Data synced to database',
      transactionCount: txnResponse.data.transactions.length,
      totalTransactions: txnResponse.data.total_transactions
    });
  } catch (error) {
    console.error('Error syncing to database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint with OpenAI function calling
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Define available functions for OpenAI
    const functions = [
      {
        name: 'getSpendingByCategory',
        description: 'Get total spending for a specific category within a date range',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category name (e.g., "Food", "Travel", "Shopping")' },
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['category', 'startDate', 'endDate']
        }
      },
      {
        name: 'getTotalSpending',
        description: 'Get total spending amount within a date range',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getTopMerchants',
        description: 'Get top merchants by spending amount',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of merchants to return (default 10)' },
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getMonthlySpendingTrend',
        description: 'Get monthly spending trend over time',
        parameters: {
          type: 'object',
          properties: {
            months: { type: 'number', description: 'Number of months to analyze (default 6)' }
          }
        }
      },
      {
        name: 'getCategoryBreakdown',
        description: 'Get spending breakdown by all categories',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getTotalIncome',
        description: 'Get total income within a date range',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getSavingsRate',
        description: 'Calculate savings rate (income - spending)',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'searchTransactions',
        description: 'Search for transactions by keyword in name, merchant, or category',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Maximum results (default 50)' }
          },
          required: ['query']
        }
      }
    ];

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `You are a helpful financial assistant. You help users understand their spending and income.

CRITICAL RULES:
1. NEVER make up numbers or calculations - ONLY use data from function calls
2. ALWAYS call the appropriate function to get accurate data
3. If you don't have enough information, ask the user for clarification
4. When showing numbers, always cite the source (date range, category, etc.)
5. Be concise but informative
6. Today's date is ${new Date().toISOString().split('T')[0]}

When interpreting dates:
- "last month" = previous calendar month
- "this month" = current calendar month
- "last 30 days" = 30 days from today
- If user doesn't specify dates, use last 30 days as default

FORMATTING RULES (Use Markdown):
- Use ## headings for main sections (e.g., "## 💰 Total Spending")
- Use **bold** for important currency amounts (e.g., **$1,234.56**)
- Use tables for category breakdowns with columns: Category | Amount | % of Total
- Use numbered lists for top merchants (1. **Merchant** - $amount (category))
- Add relevant emojis to headings: 💰 for money, 📊 for analysis, 🏆 for top items, 📈 for trends, ⚠️ for warnings
- For comparisons, show trend with arrows: ↑ increase, ↓ decrease, → no change
- Format all currency as $X,XXX.XX
- Format percentages with % symbol
- Keep explanatory text natural and friendly`
      },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call OpenAI with function calling
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages,
      functions: functions,
      function_call: 'auto',
      temperature: 0.1
    });

    const responseMessage = completion.choices[0].message;

    // Check if function call is needed
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      console.log(`Calling function: ${functionName}`, functionArgs);

      // Execute the function
      let functionResult;
      try {
        functionResult = await analytics[functionName](...Object.values(functionArgs));
      } catch (error) {
        functionResult = { error: error.message };
      }

      console.log('Function result:', functionResult);

      // Send function result back to OpenAI for natural language formatting
      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...messages,
          responseMessage,
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResult)
          }
        ],
        temperature: 0.1
      });

      const finalResponse = secondCompletion.choices[0].message.content;

      res.json({
        response: finalResponse,
        functionCalled: functionName,
        functionArgs: functionArgs,
        functionResult: functionResult
      });
    } else {
      // No function call needed, return direct response
      res.json({
        response: responseMessage.content
      });
    }
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Unit Banking API Routes =====

// Create a Unit customer
app.post('/api/unit/customer', async (req, res) => {
  console.log('=== UNIT CUSTOMER CREATE REQUEST ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const result = await unitClient.createCustomer(req.body);
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating Unit customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer details
app.get('/api/unit/customer/:customerId', async (req, res) => {
  try {
    const result = await unitClient.getCustomer(req.params.customerId);
    res.json(result);
  } catch (error) {
    console.error('Error getting Unit customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create main deposit account
app.post('/api/unit/account', async (req, res) => {
  try {
    const { customerId, accountName } = req.body;
    const result = await unitClient.createDepositAccount(customerId, accountName);
    res.json(result);
  } catch (error) {
    console.error('Error creating deposit account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a vault (sub-account)
app.post('/api/unit/vault', async (req, res) => {
  try {
    const { customerId, name, purpose, goalAmount } = req.body;
    const result = await unitClient.createVault(customerId, {
      name,
      purpose,
      goalAmount
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating vault:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts for a customer
app.get('/api/unit/accounts/:customerId', async (req, res) => {
  try {
    const result = await unitClient.getCustomerAccounts(req.params.customerId);
    res.json(result);
  } catch (error) {
    console.error('Error getting customer accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account details
app.get('/api/unit/account/:accountId', async (req, res) => {
  try {
    const result = await unitClient.getAccount(req.params.accountId);
    res.json(result);
  } catch (error) {
    console.error('Error getting account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transfer money between accounts
app.post('/api/unit/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description } = req.body;
    const result = await unitClient.createBookTransfer(
      fromAccountId,
      toAccountId,
      amount,
      description
    );
    res.json(result);
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for an account
app.get('/api/unit/transactions/:accountId', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const result = await unitClient.getAccountTransactions(req.params.accountId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Increase Banking API Routes =====

// Create an Increase entity (customer)
app.post('/api/increase/entity', async (req, res) => {
  console.log('=== INCREASE ENTITY CREATE REQUEST ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const result = await increaseClient.createEntity(req.body);
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating Increase entity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all entities
app.get('/api/increase/entities', async (req, res) => {
  try {
    const result = await increaseClient.listEntities();
    res.json(result);
  } catch (error) {
    console.error('Error listing Increase entities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get entity details
app.get('/api/increase/entity/:entityId', async (req, res) => {
  try {
    const result = await increaseClient.getEntity(req.params.entityId);
    res.json(result);
  } catch (error) {
    console.error('Error getting Increase entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create main account
app.post('/api/increase/account', async (req, res) => {
  try {
    const { entityId, name, isMainAccount } = req.body;
    const result = await increaseClient.createAccount(entityId, {
      name,
      isMainAccount: isMainAccount !== undefined ? isMainAccount : true
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating Increase account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a vault (sub-account)
app.post('/api/increase/vault', async (req, res) => {
  try {
    const { entityId, name, purpose, goalAmount } = req.body;
    const result = await increaseClient.createVault(entityId, {
      name,
      purpose,
      goalAmount
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating Increase vault:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts for an entity
app.get('/api/increase/accounts/:entityId', async (req, res) => {
  try {
    const result = await increaseClient.getEntityAccounts(req.params.entityId);
    res.json(result);
  } catch (error) {
    console.error('Error getting entity accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account details
app.get('/api/increase/account/:accountId', async (req, res) => {
  try {
    const result = await increaseClient.getAccount(req.params.accountId);
    res.json(result);
  } catch (error) {
    console.error('Error getting Increase account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account balance
app.get('/api/increase/balance/:accountId', async (req, res) => {
  try {
    const result = await increaseClient.getAccountBalance(req.params.accountId);
    res.json(result);
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transfer money between accounts
app.post('/api/increase/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description } = req.body;
    const result = await increaseClient.createAccountTransfer(
      fromAccountId,
      toAccountId,
      amount,
      description
    );
    res.json(result);
  } catch (error) {
    console.error('Error creating Increase transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for an account
app.get('/api/increase/transactions/:accountId', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const result = await increaseClient.getAccountTransactions(req.params.accountId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error getting Increase transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate inbound ACH (sandbox only - add test funds)
app.post('/api/increase/simulate/inbound_ach', async (req, res) => {
  try {
    const { accountId, amount, description } = req.body;
    const result = await increaseClient.simulateInboundACH(accountId, amount, description);
    res.json(result);
  } catch (error) {
    console.error('Error simulating inbound ACH:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TRIPLE PLAY SAVINGS AGENT ENDPOINTS =====

// Run Triple Play analysis on user's transactions
app.post('/api/savings/analyze', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array is required' });
    }

    const result = await savingsAgent.runTriplePlayAnalysis(transactions);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing savings opportunities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute windfall savings (user accepted the prompt)
app.post('/api/savings/windfall/accept', async (req, res) => {
  try {
    const { amount, toVaultId, fromAccountId, description } = req.body;

    if (!amount || !toVaultId || !fromAccountId) {
      return res.status(400).json({
        error: 'amount, toVaultId, and fromAccountId are required'
      });
    }

    // Execute transfer via Increase
    const result = await increaseClient.createAccountTransfer(
      fromAccountId,
      toVaultId,
      amount,
      description || 'Windfall Savings'
    );

    res.json(result);
  } catch (error) {
    console.error('Error executing windfall savings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute smart sweep savings
app.post('/api/savings/sweep/accept', async (req, res) => {
  try {
    const { amount, toVaultId, fromAccountId, description } = req.body;

    if (!amount || !toVaultId || !fromAccountId) {
      return res.status(400).json({
        error: 'amount, toVaultId, and fromAccountId are required'
      });
    }

    // Execute transfer via Increase
    const result = await increaseClient.createAccountTransfer(
      fromAccountId,
      toVaultId,
      amount,
      description || 'Smart Sweep Savings'
    );

    res.json(result);
  } catch (error) {
    console.error('Error executing sweep savings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request vault withdrawal (initiates soft lock)
app.post('/api/vault/withdraw/request', async (req, res) => {
  try {
    const { vaultId, amount, reason } = req.body;

    if (!vaultId || !amount) {
      return res.status(400).json({
        error: 'vaultId and amount are required'
      });
    }

    // Check soft lock status
    const lockCheck = await savingsAgent.checkSoftLock(vaultId, amount);

    if (lockCheck.allowed) {
      // Already past cooling period, can withdraw immediately
      return res.json(lockCheck);
    }

    if (lockCheck.reason === 'cooling_period') {
      // Still in cooling period
      return res.json(lockCheck);
    }

    if (lockCheck.reason === 'new_request') {
      // Create new withdrawal request
      const result = await savingsAgent.createWithdrawalRequest(vaultId, amount, reason);
      return res.json(result);
    }

    // Error case
    res.status(400).json(lockCheck);
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute vault withdrawal (after 24-hour cooling period)
app.post('/api/vault/withdraw/execute', async (req, res) => {
  try {
    const { vaultId, toAccountId, amount, withdrawalRequestId } = req.body;

    if (!vaultId || !toAccountId || !amount) {
      return res.status(400).json({
        error: 'vaultId, toAccountId, and amount are required'
      });
    }

    // Check if allowed
    const lockCheck = await savingsAgent.checkSoftLock(vaultId, amount);

    if (!lockCheck.allowed) {
      return res.status(403).json({
        error: 'Withdrawal not allowed yet',
        lockCheck
      });
    }

    // Execute transfer
    const result = await increaseClient.createAccountTransfer(
      vaultId,
      toAccountId,
      amount,
      'Vault Withdrawal'
    );

    if (result.success && withdrawalRequestId) {
      // Mark withdrawal request as completed
      await dbRun(`
        UPDATE withdrawal_requests
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [withdrawalRequestId]);
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing withdrawal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get withdrawal request status
app.get('/api/vault/withdraw/status/:vaultId', async (req, res) => {
  try {
    const { vaultId } = req.params;

    const request = await dbGet(`
      SELECT * FROM withdrawal_requests
      WHERE vault_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `, [vaultId]);

    if (!request) {
      return res.json({
        hasActiveRequest: false,
        message: 'No active withdrawal request'
      });
    }

    const requestTime = new Date(request.created_at);
    const now = new Date();
    const hoursSinceRequest = (now - requestTime) / (1000 * 60 * 60);
    const hoursRemaining = Math.ceil(24 - hoursSinceRequest);

    res.json({
      hasActiveRequest: true,
      request: {
        id: request.id,
        amount: request.amount,
        reason: request.reason,
        impactMessage: request.impact_message,
        createdAt: request.created_at,
        hoursRemaining: Math.max(0, hoursRemaining),
        canWithdraw: hoursSinceRequest >= 24
      }
    });
  } catch (error) {
    console.error('Error getting withdrawal status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect windfall opportunities
app.post('/api/savings/windfall/detect', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array is required' });
    }

    const result = await savingsAgent.detectWindfall(transactions);

    if (result.isWindfall) {
      const prompt = savingsAgent.generateWindfallPrompt(result);
      res.json({ ...result, prompt });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error detecting windfall:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze weekly sweep opportunities
app.post('/api/savings/sweep/analyze', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array is required' });
    }

    const result = await savingsAgent.analyzeWeeklySweep(transactions);

    if (result.hasSweepOpportunity) {
      const prompt = savingsAgent.generateSweepPrompt(result);
      res.json({ ...result, prompt });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error analyzing sweep:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== LOCUS WALLET & REWARDS ENDPOINTS =====

const rewardsManager = require('./rewardsManager');

// Get Locus wallet balance and stats
app.get('/api/locus/wallet', async (req, res) => {
  try {
    const userId = req.query.userId || 'default_user';
    const walletInfo = await rewardsManager.getLocusWalletBalance(userId);
    const settings = await rewardsManager.getUserSettings(userId);

    res.json({
      success: true,
      balance: walletInfo.balance,
      totalRewards: walletInfo.totalRewards,
      savingsStreak: settings.savings_streak,
      currency: 'USDC'
    });
  } catch (error) {
    console.error('Error getting Locus wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fund Locus wallet from Increase account
app.post('/api/locus/fund', async (req, res) => {
  try {
    const { amount, fromAccountId, userId = 'default_user' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await rewardsManager.fundLocusWallet(amount, fromAccountId, userId);
    res.json(result);
  } catch (error) {
    console.error('Error funding Locus wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rewards history
app.get('/api/locus/rewards', async (req, res) => {
  try {
    const userId = req.query.userId || 'default_user';
    const limit = parseInt(req.query.limit) || 50;

    const rewards = await rewardsManager.getRewardsHistory(userId, limit);
    res.json({
      success: true,
      rewards
    });
  } catch (error) {
    console.error('Error getting rewards history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of charities
app.get('/api/locus/charities', async (req, res) => {
  try {
    const charities = await rewardsManager.getCharities();
    res.json({
      success: true,
      charities
    });
  } catch (error) {
    console.error('Error getting charities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send charity donation via Locus
app.post('/api/locus/donate', async (req, res) => {
  try {
    const { charityId, amount, userId = 'default_user' } = req.body;

    if (!charityId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid charity or amount' });
    }

    const result = await rewardsManager.sendCharityDonation(charityId, amount, userId);
    res.json(result);
  } catch (error) {
    console.error('Error sending donation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Locus payment history
app.get('/api/locus/payments', async (req, res) => {
  try {
    const locusPayments = await database.dbAll(`
      SELECT * FROM locus_payments
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      payments: locusPayments
    });
  } catch (error) {
    console.error('Error getting Locus payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Increment savings streak (called when user accepts a savings suggestion)
app.post('/api/locus/streak/increment', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.body;
    const result = await rewardsManager.incrementSavingsStreak(userId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error incrementing streak:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`\n📊 API Integrations:`);
  console.log(`  ├─ Plaid: ${process.env.PLAID_ENV} mode`);
  console.log(`  ├─ OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  ├─ Unit: ${process.env.UNIT_API_TOKEN && process.env.UNIT_API_TOKEN !== 'your_unit_sandbox_token_here' ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  ├─ Increase: ${process.env.INCREASE_API_KEY && process.env.INCREASE_API_KEY !== 'your_increase_sandbox_key_here' ? '✓ Configured' : '✗ Not configured'}`);

  const locusConfigured = process.env.LOCUS_API_KEY && process.env.LOCUS_WALLET_ADDRESS;
  if (locusConfigured) {
    console.log(`  └─ Locus: ✓ Configured (Demo Mode)`);
    console.log(`      • API Key: ${process.env.LOCUS_API_KEY.substring(0, 20)}...`);
    console.log(`      • Wallet: ${process.env.LOCUS_WALLET_ADDRESS}`);
    console.log(`      • Mode: Simulated transactions for hackathon demo`);
  } else {
    console.log(`  └─ Locus: ✗ Not configured (add to .env)`);
  }

  console.log(`\n💡 AI Wallet Features:`);
  console.log(`  • Streak-based rewards`);
  console.log(`  • Charitable giving via Locus`);
  console.log(`  • Wallet funding from Increase`);
  console.log(`\n✨ Ready for hackathon demo!\n`);
});
