import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';
import './App.css';
import Chat from './Chat';
import VaultsIncrease from './VaultsIncrease';
import SavingsSuggestions from './SavingsSuggestions';
import LocusWallet from './LocusWallet';
import FreshStartBanner from './FreshStartBanner';
import WeeklyChallengeCard from './WeeklyChallengeCard';

function App() {
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [itemInfo, setItemInfo] = useState(null);
  const [recurringTransactions, setRecurringTransactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'chat'

  // Filter states
  const [transactionCount, setTransactionCount] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxn, setExpandedTxn] = useState(null);

  // Create link token on component mount
  useEffect(() => {
    async function createLinkToken() {
      try {
        const response = await axios.post('/api/create_link_token');
        setLinkToken(response.data.link_token);
      } catch (error) {
        console.error('Error creating link token:', error);
      }
    }
    createLinkToken();
  }, []);

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  const onSuccess = async (public_token) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/exchange_public_token', {
        public_token: public_token,
      });
      setAccessToken(response.data.access_token);

      // Fetch accounts
      const accountsResponse = await axios.post('/api/accounts', {
        access_token: response.data.access_token,
      });
      setAccounts(accountsResponse.data.accounts);

      // Fetch item info (available products)
      const itemResponse = await axios.post('/api/item', {
        access_token: response.data.access_token,
      });
      setItemInfo(itemResponse.data.item);

      // Automatically fetch transactions after connecting
      await fetchTransactions(response.data.access_token);
    } catch (error) {
      console.error('Error exchanging token:', error);
    } finally {
      setLoading(false);
    }
  };

  const config = {
    token: linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  const fetchTransactions = async (token = accessToken) => {
    if (!token) {
      alert('Please connect your bank account first');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/transactions', {
        access_token: token,
        start_date: startDate,
        end_date: endDate,
        count: transactionCount,
      });
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      alert('Error fetching transactions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurringTransactions = async (token = accessToken) => {
    if (!token) {
      alert('Please connect your bank account first');
      return;
    }

    try {
      setLoadingRecurring(true);
      const response = await axios.post('/api/recurring_transactions', {
        access_token: token,
      });
      setRecurringTransactions(response.data);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
      alert('Error fetching recurring transactions: ' + error.message);
    } finally {
      setLoadingRecurring(false);
    }
  };

  // Filter transactions based on search query
  const filteredTransactions = transactions.filter(txn => {
    const query = searchQuery.toLowerCase();
    return (
      txn.name.toLowerCase().includes(query) ||
      txn.merchant_name?.toLowerCase().includes(query) ||
      txn.category?.join(' ').toLowerCase().includes(query) ||
      txn.amount.toString().includes(query)
    );
  });

  return (
    <div className="App">
      <header className="App-header">
        <h1>Transaction Viewer</h1>
        <p>Connect your bank account to view transactions and get AI insights</p>
      </header>

      {accessToken && <FreshStartBanner />}
      {accessToken && <WeeklyChallengeCard />}

      {accessToken && (
        <div className="tab-navigation">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
          >
            📊 Transactions
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          >
            💬 AI Assistant
          </button>
          <button
            onClick={() => setActiveTab('savings')}
            className={`tab-button ${activeTab === 'savings' ? 'active' : ''}`}
          >
            💡 Smart Savings
          </button>
          <button
            onClick={() => setActiveTab('vaults')}
            className={`tab-button ${activeTab === 'vaults' ? 'active' : ''}`}
          >
            🏦 Vaults
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`tab-button ${activeTab === 'wallet' ? 'active' : ''}`}
          >
            🤖 AI Wallet
          </button>
        </div>
      )}

      {activeTab === 'chat' && accessToken ? (
        <Chat accessToken={accessToken} />
      ) : activeTab === 'savings' && accessToken ? (
        <SavingsSuggestions
          transactions={transactions}
          entityId="sandbox_entity_mypgdnyciycaoev7jpro"
        />
      ) : activeTab === 'vaults' ? (
        <VaultsIncrease />
      ) : activeTab === 'wallet' ? (
        <LocusWallet entityId="sandbox_entity_mypgdnyciycaoev7jpro" />
      ) : (
        <div className="container">
        {!accessToken ? (
          <div className="connect-section">
            <button
              onClick={() => open()}
              disabled={!ready}
              className="connect-button"
            >
              {ready ? '🏦 Connect Bank Account' : 'Loading...'}
            </button>
            <div className="or-divider">
              <span>OR</span>
            </div>
            <button
              onClick={() => setActiveTab('vaults')}
              className="vaults-cta-button"
            >
              💰 Create Banking Vaults
            </button>
            <p className="vaults-cta-description">
              Create FDIC-insured accounts and sub-vaults to organize your money
            </p>
          </div>
        ) : (
          <div className="main-content">
            {itemInfo && (
              <div className="item-info-section">
                <h2>Plaid API Information</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Available Products:</span>
                    <span className="info-value">
                      {itemInfo.available_products && itemInfo.available_products.length > 0
                        ? itemInfo.available_products.join(', ')
                        : 'None'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Billed Products:</span>
                    <span className="info-value">
                      {itemInfo.billed_products && itemInfo.billed_products.length > 0
                        ? itemInfo.billed_products.join(', ')
                        : 'None'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Products:</span>
                    <span className="info-value">
                      {itemInfo.products && itemInfo.products.length > 0
                        ? itemInfo.products.join(', ')
                        : 'None'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Institution ID:</span>
                    <span className="info-value">{itemInfo.institution_id}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="accounts-section">
              <h2>Connected Accounts</h2>
              {accounts.map((account) => (
                <div key={account.account_id} className="account-card">
                  <div className="account-info">
                    <strong>{account.name}</strong>
                    <span className="account-type">{account.subtype}</span>
                  </div>
                  <div className="account-balance">
                    ${account.balances.current?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ))}
            </div>

            <div className="filters-section">
              <h2>Filters</h2>

              <div className="filter-group">
                <label>Transaction Count:</label>
                <div className="count-buttons">
                  {[10, 20, 50, 100].map(count => (
                    <button
                      key={count}
                      onClick={() => setTransactionCount(count)}
                      className={transactionCount === count ? 'active' : ''}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Date Range:</label>
                <div className="date-inputs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Search:</label>
                <input
                  type="text"
                  placeholder="Search by name, merchant, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="button-group">
                <button
                  onClick={() => fetchTransactions()}
                  disabled={loading}
                  className="fetch-button"
                >
                  {loading ? 'Loading...' : 'Fetch Transactions'}
                </button>
                <button
                  onClick={() => fetchRecurringTransactions()}
                  disabled={loadingRecurring}
                  className="fetch-button recurring-button"
                >
                  {loadingRecurring ? 'Loading...' : 'Fetch Recurring Transactions'}
                </button>
              </div>
            </div>

            {recurringTransactions && (
              <div className="recurring-section">
                <h2>Recurring Transactions</h2>

                {recurringTransactions.inflow_streams && recurringTransactions.inflow_streams.length > 0 && (
                  <div className="recurring-category">
                    <h3>Income Streams ({recurringTransactions.inflow_streams.length})</h3>
                    <div className="recurring-list">
                      {recurringTransactions.inflow_streams.map((stream, idx) => (
                        <div key={idx} className="recurring-card inflow">
                          <div className="recurring-header">
                            <div className="recurring-name">
                              <strong>{stream.description}</strong>
                              {stream.merchant_name && (
                                <span className="recurring-merchant">{stream.merchant_name}</span>
                              )}
                            </div>
                            <div className="recurring-amount credit">
                              ${stream.average_amount?.amount?.toFixed(2) || '0.00'}
                              <span className="amount-label">avg</span>
                            </div>
                          </div>

                          <div className="recurring-details">
                            <div className="recurring-detail-row">
                              <span className="detail-label">Frequency:</span>
                              <span className="detail-value">{stream.frequency}</span>
                            </div>

                            <div className="recurring-detail-row">
                              <span className="detail-label">Status:</span>
                              <span className={`status-badge ${stream.status}`}>{stream.status}</span>
                            </div>

                            {stream.first_date && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">First Date:</span>
                                <span className="detail-value">{stream.first_date}</span>
                              </div>
                            )}

                            {stream.last_date && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Last Date:</span>
                                <span className="detail-value">{stream.last_date}</span>
                              </div>
                            )}

                            {stream.last_amount && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Last Amount:</span>
                                <span className="detail-value">
                                  ${stream.last_amount.amount?.toFixed(2)} {stream.last_amount.iso_currency_code}
                                </span>
                              </div>
                            )}

                            <div className="recurring-detail-row">
                              <span className="detail-label">Confidence:</span>
                              <span className="detail-value">{stream.is_active ? 'Active' : 'Inactive'}</span>
                            </div>

                            {stream.transaction_ids && stream.transaction_ids.length > 0 && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Transaction Count:</span>
                                <span className="detail-value">{stream.transaction_ids.length}</span>
                              </div>
                            )}
                          </div>

                          <details className="recurring-json">
                            <summary>View Raw JSON</summary>
                            <pre>{JSON.stringify(stream, null, 2)}</pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recurringTransactions.outflow_streams && recurringTransactions.outflow_streams.length > 0 && (
                  <div className="recurring-category">
                    <h3>Expense Streams ({recurringTransactions.outflow_streams.length})</h3>
                    <div className="recurring-list">
                      {recurringTransactions.outflow_streams.map((stream, idx) => (
                        <div key={idx} className="recurring-card outflow">
                          <div className="recurring-header">
                            <div className="recurring-name">
                              <strong>{stream.description}</strong>
                              {stream.merchant_name && (
                                <span className="recurring-merchant">{stream.merchant_name}</span>
                              )}
                            </div>
                            <div className="recurring-amount debit">
                              ${stream.average_amount?.amount?.toFixed(2) || '0.00'}
                              <span className="amount-label">avg</span>
                            </div>
                          </div>

                          <div className="recurring-details">
                            <div className="recurring-detail-row">
                              <span className="detail-label">Frequency:</span>
                              <span className="detail-value">{stream.frequency}</span>
                            </div>

                            <div className="recurring-detail-row">
                              <span className="detail-label">Status:</span>
                              <span className={`status-badge ${stream.status}`}>{stream.status}</span>
                            </div>

                            {stream.first_date && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">First Date:</span>
                                <span className="detail-value">{stream.first_date}</span>
                              </div>
                            )}

                            {stream.last_date && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Last Date:</span>
                                <span className="detail-value">{stream.last_date}</span>
                              </div>
                            )}

                            {stream.last_amount && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Last Amount:</span>
                                <span className="detail-value">
                                  ${stream.last_amount.amount?.toFixed(2)} {stream.last_amount.iso_currency_code}
                                </span>
                              </div>
                            )}

                            <div className="recurring-detail-row">
                              <span className="detail-label">Confidence:</span>
                              <span className="detail-value">{stream.is_active ? 'Active' : 'Inactive'}</span>
                            </div>

                            {stream.transaction_ids && stream.transaction_ids.length > 0 && (
                              <div className="recurring-detail-row">
                                <span className="detail-label">Transaction Count:</span>
                                <span className="detail-value">{stream.transaction_ids.length}</span>
                              </div>
                            )}
                          </div>

                          <details className="recurring-json">
                            <summary>View Raw JSON</summary>
                            <pre>{JSON.stringify(stream, null, 2)}</pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!recurringTransactions.inflow_streams || recurringTransactions.inflow_streams.length === 0) &&
                 (!recurringTransactions.outflow_streams || recurringTransactions.outflow_streams.length === 0) && (
                  <div className="no-transactions">
                    No recurring transactions found for this account.
                  </div>
                )}
              </div>
            )}

            <div className="transactions-section">
              <h2>
                Transactions
                {filteredTransactions.length > 0 && (
                  <span className="transaction-count">
                    ({filteredTransactions.length} of {transactions.length})
                  </span>
                )}
              </h2>

              {loading ? (
                <div className="loading">Loading transactions...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="no-transactions">
                  {transactions.length === 0
                    ? 'No transactions found. Click "Fetch Transactions" to load data.'
                    : 'No transactions match your search criteria.'}
                </div>
              ) : (
                <div className="transactions-list">
                  {filteredTransactions.map((txn) => (
                    <div key={txn.transaction_id} className="transaction-card">
                      <div
                        className="transaction-main"
                        onClick={() => setExpandedTxn(expandedTxn === txn.transaction_id ? null : txn.transaction_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="transaction-details">
                          <div className="transaction-name">{txn.name}</div>
                          {txn.merchant_name && (
                            <div className="merchant-name">{txn.merchant_name}</div>
                          )}
                          <div className="transaction-date">{txn.date}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div className={`transaction-amount ${txn.amount > 0 ? 'debit' : 'credit'}`}>
                            {txn.amount > 0 ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                          </div>
                          <span className="expand-icon">
                            {expandedTxn === txn.transaction_id ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>

                      <div className="transaction-meta">
                        {txn.category && (
                          <div className="categories">
                            {txn.category.map((cat, idx) => (
                              <span key={idx} className="category-tag">{cat}</span>
                            ))}
                          </div>
                        )}
                        {txn.payment_channel && (
                          <span className="payment-channel">{txn.payment_channel}</span>
                        )}
                        {txn.pending && (
                          <span className="pending-badge">Pending</span>
                        )}
                      </div>

                      {expandedTxn === txn.transaction_id && (
                        <div className="transaction-details-expanded">
                          <h3>All Transaction Attributes</h3>

                          <div className="detail-grid">
                            <div className="detail-row">
                              <span className="detail-label">Transaction ID:</span>
                              <span className="detail-value">{txn.transaction_id}</span>
                            </div>

                            <div className="detail-row">
                              <span className="detail-label">Account ID:</span>
                              <span className="detail-value">{txn.account_id}</span>
                            </div>

                            <div className="detail-row">
                              <span className="detail-label">Amount:</span>
                              <span className="detail-value">{txn.amount} {txn.iso_currency_code || txn.unofficial_currency_code || 'USD'}</span>
                            </div>

                            <div className="detail-row">
                              <span className="detail-label">Name:</span>
                              <span className="detail-value">{txn.name}</span>
                            </div>

                            {txn.merchant_name && (
                              <div className="detail-row">
                                <span className="detail-label">Merchant Name:</span>
                                <span className="detail-value">{txn.merchant_name}</span>
                              </div>
                            )}

                            <div className="detail-row">
                              <span className="detail-label">Date:</span>
                              <span className="detail-value">{txn.date}</span>
                            </div>

                            {txn.authorized_date && (
                              <div className="detail-row">
                                <span className="detail-label">Authorized Date:</span>
                                <span className="detail-value">{txn.authorized_date}</span>
                              </div>
                            )}

                            {txn.datetime && (
                              <div className="detail-row">
                                <span className="detail-label">Date Time:</span>
                                <span className="detail-value">{txn.datetime}</span>
                              </div>
                            )}

                            <div className="detail-row">
                              <span className="detail-label">Pending:</span>
                              <span className="detail-value">{txn.pending ? 'Yes' : 'No'}</span>
                            </div>

                            {txn.pending_transaction_id && (
                              <div className="detail-row">
                                <span className="detail-label">Pending Transaction ID:</span>
                                <span className="detail-value">{txn.pending_transaction_id}</span>
                              </div>
                            )}

                            {txn.payment_channel && (
                              <div className="detail-row">
                                <span className="detail-label">Payment Channel:</span>
                                <span className="detail-value">{txn.payment_channel}</span>
                              </div>
                            )}

                            {txn.transaction_type && (
                              <div className="detail-row">
                                <span className="detail-label">Transaction Type:</span>
                                <span className="detail-value">{txn.transaction_type}</span>
                              </div>
                            )}

                            {txn.transaction_code && (
                              <div className="detail-row">
                                <span className="detail-label">Transaction Code:</span>
                                <span className="detail-value">{txn.transaction_code}</span>
                              </div>
                            )}

                            {txn.category && txn.category.length > 0 && (
                              <div className="detail-row">
                                <span className="detail-label">Categories:</span>
                                <span className="detail-value">{txn.category.join(', ')}</span>
                              </div>
                            )}

                            {txn.category_id && (
                              <div className="detail-row">
                                <span className="detail-label">Category ID:</span>
                                <span className="detail-value">{txn.category_id}</span>
                              </div>
                            )}

                            {txn.account_owner && (
                              <div className="detail-row">
                                <span className="detail-label">Account Owner:</span>
                                <span className="detail-value">{txn.account_owner}</span>
                              </div>
                            )}

                            {txn.check_number && (
                              <div className="detail-row">
                                <span className="detail-label">Check Number:</span>
                                <span className="detail-value">{txn.check_number}</span>
                              </div>
                            )}

                            {txn.merchant_entity_id && (
                              <div className="detail-row">
                                <span className="detail-label">Merchant Entity ID:</span>
                                <span className="detail-value">{txn.merchant_entity_id}</span>
                              </div>
                            )}

                            {/* Location Details */}
                            {txn.location && Object.keys(txn.location).length > 0 && (
                              <>
                                <div className="detail-section-header">Location Information</div>

                                {txn.location.address && (
                                  <div className="detail-row">
                                    <span className="detail-label">Address:</span>
                                    <span className="detail-value">{txn.location.address}</span>
                                  </div>
                                )}

                                {txn.location.city && (
                                  <div className="detail-row">
                                    <span className="detail-label">City:</span>
                                    <span className="detail-value">{txn.location.city}</span>
                                  </div>
                                )}

                                {txn.location.region && (
                                  <div className="detail-row">
                                    <span className="detail-label">Region/State:</span>
                                    <span className="detail-value">{txn.location.region}</span>
                                  </div>
                                )}

                                {txn.location.postal_code && (
                                  <div className="detail-row">
                                    <span className="detail-label">Postal Code:</span>
                                    <span className="detail-value">{txn.location.postal_code}</span>
                                  </div>
                                )}

                                {txn.location.country && (
                                  <div className="detail-row">
                                    <span className="detail-label">Country:</span>
                                    <span className="detail-value">{txn.location.country}</span>
                                  </div>
                                )}

                                {txn.location.lat && (
                                  <div className="detail-row">
                                    <span className="detail-label">Latitude:</span>
                                    <span className="detail-value">{txn.location.lat}</span>
                                  </div>
                                )}

                                {txn.location.lon && (
                                  <div className="detail-row">
                                    <span className="detail-label">Longitude:</span>
                                    <span className="detail-value">{txn.location.lon}</span>
                                  </div>
                                )}

                                {txn.location.store_number && (
                                  <div className="detail-row">
                                    <span className="detail-label">Store Number:</span>
                                    <span className="detail-value">{txn.location.store_number}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Payment Meta */}
                            {txn.payment_meta && Object.keys(txn.payment_meta).some(key => txn.payment_meta[key]) && (
                              <>
                                <div className="detail-section-header">Payment Metadata</div>

                                {txn.payment_meta.reference_number && (
                                  <div className="detail-row">
                                    <span className="detail-label">Reference Number:</span>
                                    <span className="detail-value">{txn.payment_meta.reference_number}</span>
                                  </div>
                                )}

                                {txn.payment_meta.ppd_id && (
                                  <div className="detail-row">
                                    <span className="detail-label">PPD ID:</span>
                                    <span className="detail-value">{txn.payment_meta.ppd_id}</span>
                                  </div>
                                )}

                                {txn.payment_meta.payee && (
                                  <div className="detail-row">
                                    <span className="detail-label">Payee:</span>
                                    <span className="detail-value">{txn.payment_meta.payee}</span>
                                  </div>
                                )}

                                {txn.payment_meta.payer && (
                                  <div className="detail-row">
                                    <span className="detail-label">Payer:</span>
                                    <span className="detail-value">{txn.payment_meta.payer}</span>
                                  </div>
                                )}

                                {txn.payment_meta.by_order_of && (
                                  <div className="detail-row">
                                    <span className="detail-label">By Order Of:</span>
                                    <span className="detail-value">{txn.payment_meta.by_order_of}</span>
                                  </div>
                                )}

                                {txn.payment_meta.payment_method && (
                                  <div className="detail-row">
                                    <span className="detail-label">Payment Method:</span>
                                    <span className="detail-value">{txn.payment_meta.payment_method}</span>
                                  </div>
                                )}

                                {txn.payment_meta.payment_processor && (
                                  <div className="detail-row">
                                    <span className="detail-label">Payment Processor:</span>
                                    <span className="detail-value">{txn.payment_meta.payment_processor}</span>
                                  </div>
                                )}

                                {txn.payment_meta.reason && (
                                  <div className="detail-row">
                                    <span className="detail-label">Reason:</span>
                                    <span className="detail-value">{txn.payment_meta.reason}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Personal Finance Category */}
                            {txn.personal_finance_category && (
                              <>
                                <div className="detail-section-header">Personal Finance Category</div>

                                {txn.personal_finance_category.primary && (
                                  <div className="detail-row">
                                    <span className="detail-label">Primary:</span>
                                    <span className="detail-value">{txn.personal_finance_category.primary}</span>
                                  </div>
                                )}

                                {txn.personal_finance_category.detailed && (
                                  <div className="detail-row">
                                    <span className="detail-label">Detailed:</span>
                                    <span className="detail-value">{txn.personal_finance_category.detailed}</span>
                                  </div>
                                )}

                                {txn.personal_finance_category.confidence_level && (
                                  <div className="detail-row">
                                    <span className="detail-label">Confidence Level:</span>
                                    <span className="detail-value">{txn.personal_finance_category.confidence_level}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Counterparties */}
                            {txn.counterparties && txn.counterparties.length > 0 && (
                              <>
                                <div className="detail-section-header">Counterparties</div>
                                {txn.counterparties.map((cp, idx) => (
                                  <div key={idx} className="detail-row">
                                    <span className="detail-label">Counterparty {idx + 1}:</span>
                                    <span className="detail-value">
                                      {cp.name} ({cp.type}) - Confidence: {cp.confidence_level}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}

                            {/* Logo URL */}
                            {txn.logo_url && (
                              <div className="detail-row">
                                <span className="detail-label">Logo:</span>
                                <span className="detail-value">
                                  <img src={txn.logo_url} alt="Merchant logo" style={{ maxHeight: '40px' }} />
                                </span>
                              </div>
                            )}

                            {/* Website */}
                            {txn.website && (
                              <div className="detail-row">
                                <span className="detail-label">Website:</span>
                                <span className="detail-value">
                                  <a href={txn.website} target="_blank" rel="noopener noreferrer">{txn.website}</a>
                                </span>
                              </div>
                            )}

                            {/* Original Description */}
                            {txn.original_description && (
                              <div className="detail-row">
                                <span className="detail-label">Original Description:</span>
                                <span className="detail-value">{txn.original_description}</span>
                              </div>
                            )}

                            {/* Raw JSON for all other fields */}
                            <div className="detail-section-header">Raw JSON Data</div>
                            <div className="detail-row json-display">
                              <pre>{JSON.stringify(txn, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

export default App;
