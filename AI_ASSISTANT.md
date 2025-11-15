# AI Financial Assistant - Setup Guide

## Overview

The AI Financial Assistant uses **OpenAI GPT-4** with function calling to provide accurate insights about your financial data. It combines natural language understanding with deterministic analytics functions to ensure 100% accurate calculations.

## Architecture

```
User Question → OpenAI (intent detection) → Analytics Functions (accurate calculations) → OpenAI (natural formatting) → User
```

### Key Features:
- ✅ **100% Accurate**: All calculations done by deterministic SQL functions
- ✅ **Transparent**: Shows which functions were called and raw data
- ✅ **Natural Language**: Ask questions in plain English
- ✅ **Verifiable**: Every answer includes source data

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### 2. Add API Key to Backend

Edit `backend/.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-key-here
```

### 3. Restart the Server

The backend will automatically detect the key when it restarts.

```bash
# If already running, the server will auto-restart
# Or manually restart:
npm run dev
```

## How to Use

### Step 1: Connect Your Bank Account
1. Click "Connect Bank Account" on the main page
2. Use Plaid Link to authenticate
3. For sandbox testing, use:
   - Username: `user_good`
   - Password: `pass_good`

### Step 2: Switch to AI Assistant Tab
1. Click the "💬 AI Assistant" tab
2. Click "Sync Transactions" to load your data into the database
3. Wait for the sync to complete

### Step 3: Ask Questions!

Example questions you can ask:

**Spending Analysis:**
- "How much did I spend last month?"
- "What did I spend on food in October?"
- "Show me my top 5 expenses"
- "What are my biggest spending categories?"

**Income & Savings:**
- "How much income did I have last month?"
- "What's my savings rate?"
- "Am I spending more or less than last month?"

**Trends:**
- "Show me my spending trend over the last 6 months"
- "How does my current spending compare to last month?"

**Search:**
- "Find all transactions at Starbucks"
- "Show me transactions over $100"

## Available Analytics Functions

The AI has access to these accurate functions:

1. **getSpendingByCategory** - Get spending for specific categories
2. **getTotalSpending** - Total spending in a date range
3. **getTopMerchants** - Highest spending merchants
4. **getMonthlySpendingTrend** - Spending over time
5. **getCategoryBreakdown** - Spending by all categories
6. **getTotalIncome** - Income in a date range
7. **getSavingsRate** - Calculate savings rate
8. **searchTransactions** - Find specific transactions

## Transparency Features

Every AI response shows:
- **Function Called**: Which analytics function was used
- **Parameters**: What inputs were provided
- **Raw Result**: The actual data returned

Click "🔍 Transparency: Function Called" to see the details.

## Technical Details

### Database
- **SQLite** database stores all transactions
- Located at `backend/transactions.db`
- Indexed for fast queries
- Automatically synced from Plaid

### OpenAI Function Calling
- Model: `gpt-4-turbo-preview`
- Temperature: `0.1` (very deterministic)
- System prompt enforces accuracy rules
- Never makes up numbers

### Accuracy Safeguards

1. **LLM never calculates** - Only formats results
2. **All math in SQL** - Deterministic database queries
3. **Source data shown** - User can verify
4. **Date validation** - Proper date range handling

## Costs

OpenAI API costs:
- ~$0.01 per chat message (GPT-4 Turbo)
- Functions calls are 2 API calls per question
- Budget ~$0.02-0.03 per question

## Troubleshooting

### "OpenAI configured: No"
- Check that `OPENAI_API_KEY` is set in `backend/.env`
- Restart the backend server

### "Please sync transactions first"
- Click "Sync Transactions" button in the chat interface
- Wait for confirmation message

### "Error fetching..."
- Check backend console for errors
- Verify OpenAI API key is valid
- Check API rate limits

### No transactions found
- Sync data first
- Check date ranges (default is last 30 days)
- Verify Plaid connection is active

## Advanced Usage

### Custom Date Ranges

The AI understands various date formats:
- "last month" = previous calendar month
- "this month" = current calendar month
- "last 30 days" = rolling 30 days
- "October 2024" = specific month
- "Q3 2024" = third quarter

### Multi-turn Conversations

The AI remembers context:
```
User: "How much did I spend last month?"
AI: "$1,234.56"
User: "What about the month before?"
AI: [understands you mean the month before last month]
```

## Future Enhancements

Potential additions:
- Budget tracking and alerts
- Spending predictions
- Anomaly detection notifications
- Category-based insights
- Export to CSV/PDF
- Recurring expense optimization
- Multi-user support

## Security Notes

- OpenAI API key should be kept secret
- Never commit `.env` file to git
- Transactions are stored locally in SQLite
- No data sent to OpenAI except aggregate queries
- Individual transaction details not sent to AI

## Support

For issues:
1. Check backend console logs
2. Check frontend browser console
3. Verify all .env variables are set
4. Ensure database sync completed

---

**Powered by OpenAI GPT-4 + SQLite Analytics**
