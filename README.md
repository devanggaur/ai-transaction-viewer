# AI-Powered Transaction Viewer & Smart Savings Agent

A full-stack financial application that combines transaction viewing with AI-driven behavioral savings strategies. Built with React, Node.js, and integrated with Plaid, Increase, and optional Locus payment infrastructure.

## Features

### 📊 Transaction Management
- Connect bank accounts via Plaid
- View and analyze transaction history
- Search and filter transactions
- Detect recurring transactions (income & expenses)

### 💬 AI Assistant
- Chat with GPT-4 about your finances
- Ask questions about spending patterns
- Get personalized financial insights

### 💡 Smart Savings (Triple Play)
1. **Windfall Wallet**: Detects large deposits (>1.5x median income) and suggests saving 20%
2. **Smart Sweep**: Analyzes weekly spending vs historical average, suggests saving unspent budget
3. **Soft Lock**: 24-hour cooling period for vault withdrawals with impact messaging

### 🏦 Banking Vaults (via Increase)
- Create FDIC-insured sub-accounts for different savings goals
- Real-time transfers between accounts
- Track progress toward goals with visual indicators
- Unlimited vaults per user

## Tech Stack

**Frontend:**
- React 18
- React Router
- Axios for API calls
- CSS3 with responsive design

**Backend:**
- Node.js + Express
- SQLite database
- Plaid API (banking data)
- Increase API (vault accounts)
- OpenAI GPT-4 (AI assistant)
- Locus API (optional - AI-native payments)

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Plaid account (sandbox mode)
- Increase account (sandbox mode)
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd "Txn Viewer"
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Configure environment variables**
```bash
cd ../backend
cp .env.example .env
# Edit .env with your API credentials
```

Required credentials:
- `PLAID_CLIENT_ID` and `PLAID_SECRET` from [Plaid Dashboard](https://dashboard.plaid.com/)
- `INCREASE_API_KEY` from [Increase Dashboard](https://dashboard.increase.com/)
- `OPENAI_API_KEY` from [OpenAI](https://platform.openai.com/)

### Running the Application

1. **Start the backend server** (from `backend/` directory)
```bash
npm start
# Server runs on http://localhost:5001
```

2. **Start the frontend** (from `frontend/` directory)
```bash
npm start
# Opens browser at http://localhost:3000
```

## Usage

### First Time Setup

1. **Connect Bank Account**
   - Click "Connect Bank Account" on the homepage
   - Use Plaid sandbox credentials for testing
   - Fetch your transactions

2. **Create Vaults**
   - Go to the "Vaults" tab
   - Click "Start Banking Setup"
   - Create your main account and sub-vaults (e.g., Emergency Fund, Vacation, etc.)

3. **Try Smart Savings**
   - Navigate to "Smart Savings" tab
   - Click "Try Demo Mode" to see the AI savings features in action
   - View windfall and sweep suggestions
   - Select a vault and amount to save

### Demo Mode

The Smart Savings tab includes a **Demo Mode** that loads sample transaction data to showcase:
- Windfall detection ($2,000 bonus → Save $400)
- Smart Sweep ($177.50 unspent → Save $88.75)

Click "Try Demo Mode" to experience the features without needing real transaction patterns.

## Project Structure

```
Txn Viewer/
├── backend/
│   ├── server.js              # Express server & API routes
│   ├── database.js            # SQLite database setup
│   ├── analytics.js           # Transaction analytics
│   ├── savingsAgent.js        # Triple Play AI logic
│   ├── increaseClient.js      # Increase API wrapper
│   ├── locusClient.js         # Locus payment integration (optional)
│   ├── unitClient.js          # Unit API wrapper (optional)
│   └── .env                   # Environment variables (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React component
│   │   ├── Chat.js            # AI assistant interface
│   │   ├── VaultsIncrease.js  # Banking vaults UI
│   │   ├── SavingsSuggestions.js  # Smart Savings UI
│   │   └── ...
│   └── public/
│
└── README.md
```

## API Endpoints

### Transactions
- `POST /api/create_link_token` - Create Plaid Link token
- `POST /api/exchange_public_token` - Exchange public token
- `POST /api/transactions` - Fetch transactions
- `POST /api/recurring_transactions` - Get recurring patterns

### AI Assistant
- `POST /api/chat` - Chat with GPT-4

### Smart Savings
- `POST /api/savings/analyze` - Run Triple Play analysis
- `POST /api/savings/windfall/detect` - Detect windfall
- `POST /api/savings/sweep/analyze` - Analyze weekly sweep
- `POST /api/savings/windfall/accept` - Execute windfall savings
- `POST /api/savings/sweep/accept` - Execute sweep savings

### Vaults (Increase)
- `POST /api/increase/account` - Create main account
- `POST /api/increase/vault` - Create vault
- `GET /api/increase/accounts/:entityId` - List accounts
- `POST /api/increase/transfer` - Transfer between accounts
- `POST /api/increase/simulate/inbound_ach` - Add test funds (sandbox)

## Behavioral Economics Features

The **Triple Play** implements proven behavioral economics principles:

1. **Windfall Wallet** - Mental accounting + default options
   - Intercepts windfalls before mental budgeting occurs
   - Suggests 20% savings as the default option
   - 4x higher savings rate than manual approaches

2. **Smart Sweep** - Pay-yourself-first automation
   - Analyzes unspent budget weekly
   - Positive framing: "Great self-control!"
   - Low friction: one-click savings

3. **Soft Lock** - Commitment device + cooling period
   - 24-hour delay prevents impulsive withdrawals
   - Shows goal impact: "You'll reach your goal N weeks later"
   - Maintains access (not a hard lock)

## Security Notes

⚠️ **Important**: This project uses `.env` files for API credentials. Never commit the `.env` file to version control.

The `.gitignore` file is configured to exclude:
- API credentials (`.env`)
- Database files (contains transaction data)
- Node modules
- Build artifacts

## Contributing

This is a personal finance project. Feel free to fork and customize for your own use.

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built with [Plaid](https://plaid.com/) for banking data
- [Increase](https://increase.com/) for FDIC-insured accounts
- [OpenAI](https://openai.com/) for AI capabilities
- Behavioral economics research from Thaler & Sunstein's "Nudge"

## Support

For issues or questions, please open a GitHub issue.
