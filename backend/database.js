const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'transactions.db');

// Initialize database with read-write-create mode
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  db.serialize(() => {
    // Transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        iso_currency_code TEXT,
        unofficial_currency_code TEXT,
        category TEXT,
        category_id TEXT,
        date TEXT NOT NULL,
        authorized_date TEXT,
        name TEXT NOT NULL,
        merchant_name TEXT,
        pending INTEGER DEFAULT 0,
        pending_transaction_id TEXT,
        payment_channel TEXT,
        transaction_type TEXT,
        transaction_code TEXT,
        location_address TEXT,
        location_city TEXT,
        location_region TEXT,
        location_postal_code TEXT,
        location_country TEXT,
        location_lat REAL,
        location_lon REAL,
        payment_meta TEXT,
        personal_finance_category TEXT,
        account_owner TEXT,
        original_description TEXT,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for common queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_date ON transactions(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_category ON transactions(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_merchant ON transactions(merchant_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_account ON transactions(account_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_amount ON transactions(amount)`);

    // Recurring transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS recurring_streams (
        stream_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT,
        merchant_name TEXT,
        frequency TEXT,
        status TEXT,
        first_date TEXT,
        last_date TEXT,
        average_amount REAL,
        last_amount REAL,
        is_active INTEGER,
        transaction_count INTEGER,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User metadata table (for future multi-user support)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        item_id TEXT,
        institution_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Unit customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS unit_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_customer_id TEXT UNIQUE NOT NULL,
        user_id TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        date_of_birth TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT DEFAULT 'US',
        status TEXT DEFAULT 'pending',
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Unit accounts table (main account + sub-vaults)
    db.run(`
      CREATE TABLE IF NOT EXISTS unit_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_account_id TEXT UNIQUE NOT NULL,
        unit_customer_id TEXT NOT NULL,
        account_type TEXT NOT NULL,
        name TEXT NOT NULL,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'Open',
        is_main_account INTEGER DEFAULT 0,
        purpose TEXT,
        goal_amount REAL,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_customer_id) REFERENCES unit_customers(unit_customer_id)
      )
    `);

    // Unit transactions table (separate from Plaid transactions)
    db.run(`
      CREATE TABLE IF NOT EXISTS unit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_transaction_id TEXT UNIQUE NOT NULL,
        unit_account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        direction TEXT NOT NULL,
        description TEXT,
        summary TEXT,
        balance REAL,
        created_at_unit TEXT,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_account_id) REFERENCES unit_accounts(unit_account_id)
      )
    `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_unit_customer ON unit_accounts(unit_customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_unit_account ON unit_transactions(unit_account_id)`);

    // Increase entities table (similar to unit_customers)
    db.run(`
      CREATE TABLE IF NOT EXISTS increase_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        increase_entity_id TEXT UNIQUE NOT NULL,
        user_id TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        date_of_birth TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT DEFAULT 'US',
        status TEXT DEFAULT 'active',
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Increase accounts table (main account + vaults)
    db.run(`
      CREATE TABLE IF NOT EXISTS increase_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        increase_account_id TEXT UNIQUE NOT NULL,
        increase_entity_id TEXT NOT NULL,
        account_type TEXT NOT NULL,
        name TEXT NOT NULL,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'Open',
        is_main_account INTEGER DEFAULT 0,
        purpose TEXT,
        goal_amount REAL,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (increase_entity_id) REFERENCES increase_entities(increase_entity_id)
      )
    `);

    // Increase transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS increase_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        increase_transaction_id TEXT UNIQUE NOT NULL,
        increase_account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        direction TEXT NOT NULL,
        description TEXT,
        summary TEXT,
        balance REAL,
        created_at_increase TEXT,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (increase_account_id) REFERENCES increase_accounts(increase_account_id)
      )
    `);

    // Create indexes for Increase tables
    db.run(`CREATE INDEX IF NOT EXISTS idx_increase_entity ON increase_accounts(increase_entity_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_increase_account ON increase_transactions(increase_account_id)`);

    // Locus payments table
    db.run(`
      CREATE TABLE IF NOT EXISTS locus_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        locus_payment_id TEXT UNIQUE NOT NULL,
        to_address TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USDC',
        description TEXT,
        status TEXT NOT NULL,
        transaction_hash TEXT,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Autonomous actions table (AI agent decisions)
    db.run(`
      CREATE TABLE IF NOT EXISTS autonomous_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        amount REAL,
        description TEXT,
        locus_payment_id TEXT,
        status TEXT NOT NULL,
        ai_reasoning TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (locus_payment_id) REFERENCES locus_payments(locus_payment_id)
      )
    `);

    // Policy groups table
    db.run(`
      CREATE TABLE IF NOT EXISTS policy_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        locus_policy_id TEXT UNIQUE,
        name TEXT NOT NULL,
        monthly_budget REAL NOT NULL,
        current_spent REAL DEFAULT 0,
        allowed_recipients TEXT,
        description TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for Locus tables
    db.run(`CREATE INDEX IF NOT EXISTS idx_locus_payment ON autonomous_actions(locus_payment_id)`);

    // Withdrawal requests table (for soft lock feature)
    db.run(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault_id TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        impact_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (vault_id) REFERENCES increase_accounts(increase_account_id)
      )
    `);

    // Locus wallet funding table (tracks deposits from Increase to Locus)
    db.run(`
      CREATE TABLE IF NOT EXISTS locus_funding (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        source TEXT NOT NULL,
        source_account_id TEXT,
        status TEXT DEFAULT 'completed',
        locus_balance_after REAL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User settings table (for preferences, streaks, autonomous mode)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'default_user',
        locus_wallet_balance REAL DEFAULT 0,
        savings_streak INTEGER DEFAULT 0,
        last_savings_date TEXT,
        autonomous_mode_enabled INTEGER DEFAULT 0,
        autonomous_savings_limit REAL DEFAULT 500,
        locus_wallet_address TEXT,
        total_ai_rewards REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rewards history table (AI-generated rewards for good behavior)
    db.run(`
      CREATE TABLE IF NOT EXISTS rewards_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reward_type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        locus_payment_id TEXT,
        streak_count INTEGER,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (locus_payment_id) REFERENCES locus_payments(locus_payment_id)
      )
    `);

    // Charity recipients table (pre-approved charity wallets)
    db.run(`
      CREATE TABLE IF NOT EXISTS charity_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        wallet_address TEXT NOT NULL,
        category TEXT,
        website TEXT,
        logo_url TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed some popular charities
    db.run(`
      INSERT OR IGNORE INTO charity_recipients (id, name, description, wallet_address, category, website)
      VALUES
        (1, 'GiveDirectly', 'Direct cash transfers to people living in poverty', '0xGiveDirectly...', 'Poverty', 'https://givedirectly.org'),
        (2, 'Red Cross', 'Humanitarian aid and emergency assistance', '0xRedCross...', 'Emergency', 'https://redcross.org'),
        (3, 'Doctors Without Borders', 'Medical humanitarian organization', '0xMSF...', 'Health', 'https://msf.org'),
        (4, 'The Ocean Cleanup', 'Removing plastic from oceans', '0xOceanCleanup...', 'Environment', 'https://theoceancleanup.com')
    `);

    console.log('Database tables initialized');
  });
}

// Helper to promisify database operations
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Insert or update transaction
async function saveTransaction(transaction) {
  const sql = `
    INSERT OR REPLACE INTO transactions (
      transaction_id, account_id, amount, iso_currency_code, unofficial_currency_code,
      category, category_id, date, authorized_date, name, merchant_name,
      pending, pending_transaction_id, payment_channel, transaction_type, transaction_code,
      location_address, location_city, location_region, location_postal_code,
      location_country, location_lat, location_lon, payment_meta,
      personal_finance_category, account_owner, original_description, raw_data, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  // Extract category from personal_finance_category or fallback to legacy category
  let category = null;
  if (transaction.personal_finance_category?.primary) {
    // Use primary category from new Plaid format (e.g., "FOOD_AND_DRINK")
    category = transaction.personal_finance_category.primary.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  } else if (transaction.personal_finance_category?.detailed) {
    // Fallback to detailed category
    category = transaction.personal_finance_category.detailed.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  } else if (transaction.category) {
    // Fallback to legacy category field
    category = Array.isArray(transaction.category) ? transaction.category[0] : transaction.category;
  }

  const params = [
    transaction.transaction_id,
    transaction.account_id,
    transaction.amount,
    transaction.iso_currency_code,
    transaction.unofficial_currency_code,
    category,
    transaction.category_id,
    transaction.date,
    transaction.authorized_date,
    transaction.name,
    transaction.merchant_name,
    transaction.pending ? 1 : 0,
    transaction.pending_transaction_id,
    transaction.payment_channel,
    transaction.transaction_type,
    transaction.transaction_code,
    transaction.location?.address,
    transaction.location?.city,
    transaction.location?.region,
    transaction.location?.postal_code,
    transaction.location?.country,
    transaction.location?.lat,
    transaction.location?.lon,
    transaction.payment_meta ? JSON.stringify(transaction.payment_meta) : null,
    transaction.personal_finance_category ? JSON.stringify(transaction.personal_finance_category) : null,
    transaction.account_owner || null,
    transaction.original_description || null,
    JSON.stringify(transaction)
  ];

  return dbRun(sql, params);
}

// Bulk insert transactions
async function saveTransactions(transactions) {
  const promises = transactions.map(txn => saveTransaction(txn));
  return Promise.all(promises);
}

// Save recurring stream
async function saveRecurringStream(stream, type) {
  const sql = `
    INSERT OR REPLACE INTO recurring_streams (
      stream_id, type, description, merchant_name, frequency, status,
      first_date, last_date, average_amount, last_amount, is_active,
      transaction_count, raw_data, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const streamId = `${type}_${stream.description}_${stream.first_date}`;
  const params = [
    streamId,
    type,
    stream.description,
    stream.merchant_name,
    stream.frequency,
    stream.status,
    stream.first_date,
    stream.last_date,
    stream.average_amount?.amount,
    stream.last_amount?.amount,
    stream.is_active ? 1 : 0,
    stream.transaction_ids?.length || 0,
    JSON.stringify(stream)
  ];

  return dbRun(sql, params);
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  saveTransaction,
  saveTransactions,
  saveRecurringStream
};
