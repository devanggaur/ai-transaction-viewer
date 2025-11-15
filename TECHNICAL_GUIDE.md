# Technical Implementation Guide

## 📚 Learning Resource for Building Similar Integrations

This guide documents the complete architecture, patterns, and implementation details of our AI-Powered Transaction Viewer with Smart Savings. Use this as a reference for building similar fintech integrations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Integration Patterns](#api-integration-patterns)
3. [Database Design](#database-design)
4. [Frontend-Backend Communication](#frontend-backend-communication)
5. [AI Integration](#ai-integration)
6. [Payment Infrastructure](#payment-infrastructure)
7. [Step-by-Step Implementation](#step-by-step-implementation)
8. [Best Practices](#best-practices)
9. [Common Patterns](#common-patterns)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐   │
│  │Transactions│ │AI Chat  │ │ Vaults  │  │ Locus Wallet │   │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  API Routes Layer                      │   │
│  │  /api/plaid/*  /api/chat  /api/savings/*  /api/locus/* │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Business Logic Layer                   │   │
│  │  savingsAgent.js  rewardsManager.js  analytics.js    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Integration Clients                     │   │
│  │  plaidClient  openaiClient  locusClient  increaseClient│   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Data Access Layer (SQLite)                │   │
│  │  database.js - dbRun, dbGet, dbAll helpers            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕ API Calls
┌─────────────────────────────────────────────────────────────┐
│                    External Services                          │
│  ┌──────┐  ┌────────┐  ┌─────────┐  ┌──────┐  ┌────────┐  │
│  │Plaid │  │OpenAI  │  │Increase │  │Locus │  │ Unit   │  │
│  └──────┘  └────────┘  └─────────┘  └──────┘  └────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Layered Architecture**: Clear separation between routes, logic, and data access
3. **API Client Abstraction**: Each external service has a dedicated client module
4. **Database Abstraction**: Promisified SQLite operations for async/await
5. **Environment-Based Configuration**: All credentials in `.env` file

---

## API Integration Patterns

### Pattern 1: OAuth-Based Integration (Plaid)

**Use Case:** When the service requires user authorization

**Implementation:**

```javascript
// 1. Create Link Token (server-side)
app.post('/api/create_link_token', async (req, res) => {
  const request = {
    user: { client_user_id: 'user-id' },
    client_name: 'Your App Name',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en'
  };

  const response = await plaidClient.linkTokenCreate(request);
  res.json({ link_token: response.data.link_token });
});

// 2. Exchange Public Token for Access Token
app.post('/api/exchange_public_token', async (req, res) => {
  const { public_token } = req.body;
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: public_token
  });

  // Store access_token securely
  const access_token = response.data.access_token;
  res.json({ access_token });
});
```

**Frontend Implementation:**

```javascript
import { usePlaidLink } from 'react-plaid-link';

// 1. Fetch link token on mount
useEffect(() => {
  async function createLinkToken() {
    const response = await axios.post('/api/create_link_token');
    setLinkToken(response.data.link_token);
  }
  createLinkToken();
}, []);

// 2. Handle successful link
const onSuccess = async (public_token) => {
  const response = await axios.post('/api/exchange_public_token', {
    public_token: public_token
  });
  setAccessToken(response.data.access_token);
};

// 3. Initialize Plaid Link
const { open, ready } = usePlaidLink({
  token: linkToken,
  onSuccess
});
```

**Key Learnings:**
- Always create link tokens server-side (requires secret)
- Store access tokens securely (database or encrypted storage)
- Handle token expiration and re-authentication
- Use webhooks for real-time updates (optional)

---

### Pattern 2: API Key Authentication (Increase, Locus)

**Use Case:** Direct API access with API key

**Implementation:**

```javascript
// Create client with API key
const axios = require('axios');

const apiClient = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Example: Create a resource
async function createResource(data) {
  try {
    const response = await apiClient.post('/v1/resource', data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}
```

**Key Learnings:**
- Use axios instances for consistent configuration
- Always return structured responses `{ success, data/error }`
- Log errors with context
- Handle rate limiting and retries

---

### Pattern 3: AI/LLM Integration (OpenAI)

**Use Case:** Natural language processing and AI reasoning

**Implementation:**

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeWithAI(prompt, context) {
  const messages = [
    {
      role: 'system',
      content: 'You are a financial advisor...'
    },
    {
      role: 'user',
      content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${prompt}`
    }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}
```

**Function Calling Pattern:**

```javascript
const tools = [
  {
    type: 'function',
    function: {
      name: 'getTotalSpending',
      description: 'Calculate total spending in date range',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      }
    }
  }
];

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  tools: tools
});

// Handle function calls
if (response.choices[0].message.tool_calls) {
  const functionCall = response.choices[0].message.tool_calls[0];
  const result = await executeFunctionCall(functionCall);
  // Send result back to AI
}
```

**Key Learnings:**
- Use system prompts to define AI behavior
- Provide context in structured format (JSON)
- Implement function calling for actions
- Handle streaming responses for better UX
- Set appropriate temperature (0.7 for creative, 0.2 for factual)

---

## Database Design

### Schema Philosophy

**Principles:**
1. **Normalized Data**: Avoid redundancy
2. **Foreign Keys**: Maintain referential integrity
3. **Timestamps**: Track creation and updates
4. **JSON Storage**: Store complex objects as TEXT
5. **Indexes**: Optimize common queries

### Core Tables

#### Transactions Table
```sql
CREATE TABLE transactions (
  transaction_id TEXT PRIMARY KEY,      -- Plaid transaction ID
  account_id TEXT NOT NULL,              -- Which account
  amount REAL NOT NULL,                  -- Transaction amount
  date TEXT NOT NULL,                    -- Transaction date
  name TEXT NOT NULL,                    -- Merchant name
  category TEXT,                         -- Category
  merchant_name TEXT,                    -- Standardized merchant
  raw_data TEXT,                         -- Full JSON from Plaid
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_date ON transactions(date);
CREATE INDEX idx_merchant ON transactions(merchant_name);
```

**Why This Design:**
- Primary key from external system (Plaid) for idempotency
- Timestamps for audit trail
- Raw JSON for debugging and future features
- Indexes on common query fields

#### User Settings Table (State Management)
```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT DEFAULT 'default_user',
  locus_wallet_balance REAL DEFAULT 0,  -- Current balance
  savings_streak INTEGER DEFAULT 0,     -- Gamification
  last_savings_date TEXT,                -- For streak calculation
  autonomous_mode_enabled INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Why This Design:**
- Single source of truth for user state
- Supports multi-user with user_id
- Tracks gamification metrics
- Easy to query and update

#### Relational Design Pattern

```sql
-- Parent table
CREATE TABLE increase_entities (
  increase_entity_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  -- ... other fields
);

-- Child table with foreign key
CREATE TABLE increase_accounts (
  increase_account_id TEXT UNIQUE NOT NULL,
  increase_entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  balance REAL DEFAULT 0,
  FOREIGN KEY (increase_entity_id)
    REFERENCES increase_entities(increase_entity_id)
);
```

**Key Learnings:**
- Use TEXT for external IDs (more flexible than INTEGER)
- Store money as REAL (for simple apps) or INTEGER cents (for precision)
- Always add timestamps
- Use UNIQUE constraints on external IDs
- Create indexes after understanding query patterns

---

## Frontend-Backend Communication

### API Call Pattern (Frontend)

```javascript
// 1. Centralize API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// 2. Create reusable fetch function
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  return await response.json();
}

// 3. Use in components
const handleAction = async () => {
  setLoading(true);
  try {
    const data = await apiCall('/api/savings/analyze', 'POST', {
      transactions: transactions
    });

    if (data.success) {
      setOpportunities(data.opportunities);
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('API Error:', error);
    alert('Network error');
  } finally {
    setLoading(false);
  }
};
```

### Response Format Standard

```javascript
// Success response
{
  "success": true,
  "data": { /* payload */ },
  "message": "Optional success message"
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE" // optional
}
```

**Key Learnings:**
- Consistent response format across all endpoints
- Always handle loading states
- Show user-friendly error messages
- Log detailed errors to console
- Use try-catch for network errors

---

## AI Integration

### Savings Analysis Pattern

**File:** `backend/savingsAgent.js`

```javascript
// 1. Data Analysis Function
async function detectWindfall(transactions) {
  // Calculate median income
  const incomeTransactions = transactions
    .filter(t => t.amount < 0)  // Plaid: negative = income
    .map(t => Math.abs(t.amount));

  const median = calculateMedian(incomeTransactions);

  // Detect outliers (windfall = >1.5x median)
  const recentLarge = transactions.filter(t =>
    Math.abs(t.amount) > (median * 1.5) &&
    isRecent(t.date, 30)
  );

  if (recentLarge.length === 0) {
    return { isWindfall: false };
  }

  // Generate user-facing prompt
  const suggestedSavings = recentLarge[0].amount * 0.20;

  return {
    isWindfall: true,
    amount: recentLarge[0].amount,
    suggestedSavings,
    prompt: {
      title: "💰 Windfall Detected!",
      message: `I noticed you received $${recentLarge[0].amount}...`,
      options: [
        { label: "Save $400 (20%)", value: suggestedSavings },
        { label: "Save $200 (10%)", value: suggestedSavings * 0.5 },
        { label: "Not now", value: 0 }
      ]
    }
  };
}
```

**Key Patterns:**
1. **Data-Driven Detection**: Use statistical methods (median, averages)
2. **User-Friendly Prompts**: Convert analysis to actionable options
3. **Behavioral Economics**: Default to optimal choice (20% savings)
4. **Flexibility**: Give users options, not commands

---

## Payment Infrastructure

### Dual-Mode Pattern (Demo + Production)

**Problem:** Need reliable demos without depending on external APIs

**Solution:** Simulation layer with production code path commented

```javascript
async function sendPayment(paymentData) {
  // DEMO MODE: Simulated transaction
  console.log('🔷 Locus Demo Transaction:', paymentData);

  const simulatedResponse = {
    data: {
      payment_id: `locus_${Date.now()}`,
      transaction_hash: `0x${randomHex()}`,
      status: 'completed'
    }
  };

  /*
  // PRODUCTION MODE (when integrated):
  const response = await locusApi.post('/v1/payments/send', {
    to: paymentData.to,
    amount: paymentData.amount,
    currency: 'USDC'
  });
  */

  // Save to database (works in both modes)
  await dbRun(`
    INSERT INTO locus_payments (...)
    VALUES (...)
  `, [simulatedResponse.data.payment_id, ...]);

  return {
    success: true,
    paymentId: simulatedResponse.data.payment_id
  };
}
```

**Key Learnings:**
- Preserve production code path in comments
- Use feature flags for mode switching
- Database layer works identically in both modes
- Generate realistic mock data

---

## Step-by-Step Implementation

### Adding a New API Integration

**Example: Adding a new savings vault provider**

#### Step 1: Create Client Module

```javascript
// backend/newProviderClient.js
const axios = require('axios');

const api = axios.create({
  baseURL: process.env.NEW_PROVIDER_URL,
  headers: {
    'Authorization': `Bearer ${process.env.NEW_PROVIDER_KEY}`
  }
});

async function createVault(data) {
  try {
    const response = await api.post('/vaults', data);
    return { success: true, vault: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { createVault };
```

#### Step 2: Add Database Tables

```javascript
// backend/database.js - in initializeDatabase()
db.run(`
  CREATE TABLE IF NOT EXISTS new_provider_vaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_vault_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    balance REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
```

#### Step 3: Create API Endpoints

```javascript
// backend/server.js
const newProvider = require('./newProviderClient');

app.post('/api/new-provider/vault', async (req, res) => {
  const { name, initialDeposit } = req.body;

  const result = await newProvider.createVault({
    name,
    initial_deposit: initialDeposit
  });

  if (result.success) {
    // Save to database
    await database.dbRun(`
      INSERT INTO new_provider_vaults (provider_vault_id, name, balance)
      VALUES (?, ?, ?)
    `, [result.vault.id, name, initialDeposit]);
  }

  res.json(result);
});
```

#### Step 4: Create Frontend Component

```javascript
// frontend/src/NewProviderVaults.js
import React, { useState, useEffect } from 'react';

function NewProviderVaults() {
  const [vaults, setVaults] = useState([]);

  useEffect(() => {
    fetchVaults();
  }, []);

  const fetchVaults = async () => {
    const response = await fetch(`${API_URL}/api/new-provider/vaults`);
    const data = await response.json();
    if (data.success) {
      setVaults(data.vaults);
    }
  };

  const createVault = async (name, amount) => {
    const response = await fetch(`${API_URL}/api/new-provider/vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, initialDeposit: amount })
    });

    const data = await response.json();
    if (data.success) {
      fetchVaults(); // Refresh list
    }
  };

  return (
    <div>
      {vaults.map(vault => (
        <div key={vault.id}>{vault.name}: ${vault.balance}</div>
      ))}
    </div>
  );
}
```

#### Step 5: Add to Main App

```javascript
// frontend/src/App.js
import NewProviderVaults from './NewProviderVaults';

// Add tab
<button onClick={() => setActiveTab('new-provider')}>
  New Provider
</button>

// Add route
{activeTab === 'new-provider' && <NewProviderVaults />}
```

---

## Best Practices

### 1. Error Handling

```javascript
// ❌ Bad: Swallow errors
async function bad() {
  try {
    await api.call();
  } catch (e) {
    // Nothing
  }
}

// ✅ Good: Log and return structured errors
async function good() {
  try {
    const response = await api.call();
    return { success: true, data: response.data };
  } catch (error) {
    console.error('API call failed:', {
      endpoint: '/api/endpoint',
      error: error.message,
      data: error.response?.data
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}
```

### 2. Environment Variables

```javascript
// ❌ Bad: Hardcoded values
const API_KEY = 'sk-1234567890';

// ✅ Good: Environment variables with defaults
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn('API_KEY not set - using demo mode');
}

// ✅ Better: Validation on startup
function validateEnv() {
  const required = ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}
```

### 3. Database Operations

```javascript
// ❌ Bad: Blocking database calls
function bad() {
  db.run('INSERT INTO ...', [], function(err) {
    if (err) console.error(err);
  });
}

// ✅ Good: Promisified with async/await
async function good() {
  try {
    await dbRun('INSERT INTO ... VALUES (?, ?)', [val1, val2]);
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}
```

### 4. API Response Consistency

```javascript
// All endpoints follow same pattern
app.post('/api/endpoint', async (req, res) => {
  try {
    const result = await businessLogic(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## Common Patterns

### Pattern: Streak Tracking

```javascript
// Increment streak on action
async function incrementStreak(userId) {
  const settings = await dbGet(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [userId]
  );

  const today = new Date().toISOString().split('T')[0];
  const lastAction = settings.last_action_date;

  // Check if action is consecutive
  const isConsecutive = isNextDay(lastAction, today);

  const newStreak = isConsecutive ? settings.streak + 1 : 1;

  await dbRun(`
    UPDATE user_settings
    SET streak = ?, last_action_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [newStreak, today, userId]);

  // Check for milestone rewards
  if (newStreak % 4 === 0) {
    await awardStreakBonus(userId, newStreak);
  }
}
```

### Pattern: Conditional Rewards

```javascript
// Reward based on conditions
async function checkAndReward(userId, action) {
  const conditions = [
    { check: hasStreak(userId, 4), reward: 10 },
    { check: reachedGoal(userId), reward: 25 },
    { check: firstTime(userId, action), reward: 5 }
  ];

  for (const condition of conditions) {
    if (await condition.check) {
      await grantReward(userId, condition.reward);
    }
  }
}
```

### Pattern: Batch Processing

```javascript
// Process array of items
async function saveTransactions(transactions) {
  const promises = transactions.map(txn => saveTransaction(txn));
  const results = await Promise.all(promises);

  const successful = results.filter(r => r.success).length;
  console.log(`Saved ${successful}/${transactions.length} transactions`);
}
```

---

## Production Checklist

Before deploying to production:

- [ ] Remove all console.log (use proper logging)
- [ ] Add rate limiting to APIs
- [ ] Implement authentication/authorization
- [ ] Validate all user inputs
- [ ] Add request timeouts
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure CORS properly
- [ ] Use HTTPS everywhere
- [ ] Rotate API keys regularly
- [ ] Add database backups
- [ ] Set up health check endpoint
- [ ] Configure environment-specific variables
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Load test critical endpoints
- [ ] Set up CI/CD pipeline

---

## Next Steps for Learning

1. **Add Authentication**: Implement JWT or OAuth for multi-user
2. **Webhook Integration**: Real-time updates from Plaid
3. **Background Jobs**: Scheduled analysis with cron/Bull
4. **Caching Layer**: Redis for performance
5. **Migration Scripts**: Database versioning
6. **Testing**: Unit tests, integration tests, E2E tests
7. **Monitoring**: Logs, metrics, alerts
8. **Mobile App**: React Native version

---

## Resources

- [Plaid API Docs](https://plaid.com/docs/)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Increase API Docs](https://increase.com/documentation)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [React Hooks Guide](https://react.dev/reference/react)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**This guide is a living document. As you build similar integrations, update it with your learnings!**
