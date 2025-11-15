import React, { useState, useEffect } from 'react';
import './LocusWallet.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function LocusWallet({ entityId }) {
  const [walletData, setWalletData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [payments, setPayments] = useState([]);
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCharity, setSelectedCharity] = useState('');
  const [donateAmount, setDonateAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWalletData();
    fetchRewards();
    fetchPayments();
    fetchCharities();
    if (entityId) {
      fetchAccounts();
    }
  }, [entityId]);

  const fetchWalletData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/locus/wallet`);
      const data = await response.json();
      if (data.success) {
        setWalletData(data);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_URL}/api/locus/rewards`);
      const data = await response.json();
      if (data.success) {
        setRewards(data.rewards);
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/locus/payments`);
      const data = await response.json();
      if (data.success) {
        setPayments(data.payments);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchCharities = async () => {
    try {
      const response = await fetch(`${API_URL}/api/locus/charities`);
      const data = await response.json();
      if (data.success) {
        setCharities(data.charities);
      }
    } catch (error) {
      console.error('Error fetching charities:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/increase/accounts/${entityId}`);
      const data = await response.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        const mainAcc = data.accounts.find(acc => acc.is_main_account);
        if (mainAcc) {
          setSelectedAccount(mainAcc.increase_account_id);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleFundWallet = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/locus/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(fundAmount),
          fromAccountId: selectedAccount
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Success! Added $${fundAmount} to your AI Wallet`);
        setShowFundModal(false);
        setFundAmount('');
        fetchWalletData();
        fetchPayments();
      } else {
        alert(`Error: ${data.error || 'Failed to fund wallet'}`);
      }
    } catch (error) {
      console.error('Error funding wallet:', error);
      alert('Error funding wallet');
    } finally {
      setProcessing(false);
    }
  };

  const handleDonate = async () => {
    if (!donateAmount || parseFloat(donateAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!selectedCharity) {
      alert('Please select a charity');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/locus/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charityId: selectedCharity,
          amount: parseFloat(donateAmount)
        })
      });

      const data = await response.json();

      if (data.success) {
        const charity = charities.find(c => c.id === parseInt(selectedCharity));
        alert(`Success! Donated $${donateAmount} to ${charity?.name || 'charity'}`);
        setShowDonateModal(false);
        setDonateAmount('');
        setSelectedCharity('');
        fetchWalletData();
        fetchPayments();
      } else {
        alert(`Error: ${data.error || 'Failed to send donation'}`);
      }
    } catch (error) {
      console.error('Error sending donation:', error);
      alert('Error sending donation');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="locus-wallet-loading">Loading AI Wallet...</div>;
  }

  return (
    <div className="locus-wallet-container">
      {/* Wallet Balance Card */}
      <div className="wallet-balance-card">
        <div className="wallet-header">
          <h2>AI Wallet</h2>
          <span className="wallet-badge">Locus</span>
        </div>

        <div className="balance-display">
          <div className="balance-amount">
            <span className="currency">$</span>
            <span className="amount">{walletData?.balance.toFixed(2) || '0.00'}</span>
            <span className="currency-code">USDC</span>
          </div>
          <p className="balance-label">Available Balance</p>
        </div>

        <div className="wallet-stats">
          <div className="stat">
            <span className="stat-label">Total AI Rewards</span>
            <span className="stat-value">${walletData?.totalRewards.toFixed(2) || '0.00'}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Savings Streak</span>
            <span className="stat-value">{walletData?.savingsStreak || 0} weeks</span>
          </div>
        </div>

        <div className="wallet-actions">
          <button
            className="primary-button"
            onClick={() => setShowFundModal(true)}
            disabled={!entityId}
          >
            Add Funds
          </button>
          <button
            className="secondary-button"
            onClick={() => setShowDonateModal(true)}
            disabled={!walletData || walletData.balance <= 0}
          >
            Donate
          </button>
        </div>
      </div>

      {/* Recent Rewards */}
      {rewards.length > 0 && (
        <div className="rewards-section">
          <h3>Recent Rewards</h3>
          <div className="rewards-list">
            {rewards.slice(0, 5).map((reward) => (
              <div key={reward.id} className="reward-item">
                <div className="reward-icon">
                  {reward.reward_type === 'streak_bonus' ? '🔥' :
                   reward.reward_type === 'milestone' ? '🎯' : '⭐'}
                </div>
                <div className="reward-info">
                  <p className="reward-reason">{reward.reason}</p>
                  <span className="reward-date">
                    {new Date(reward.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="reward-amount">+${reward.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="payments-section">
        <h3>Transaction History</h3>
        {payments.length === 0 ? (
          <p className="no-payments">No transactions yet. Fund your wallet to get started!</p>
        ) : (
          <div className="payments-list">
            {payments.slice(0, 10).map((payment) => (
              <div key={payment.id} className="payment-item">
                <div className="payment-info">
                  <p className="payment-description">{payment.description}</p>
                  <span className="payment-date">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="payment-amount">-${payment.amount.toFixed(2)}</div>
                <span className={`payment-status ${payment.status}`}>
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fund Wallet Modal */}
      {showFundModal && (
        <div className="modal-overlay" onClick={() => setShowFundModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add Funds to AI Wallet</h3>
            <p>Transfer funds from your Increase account to your Locus AI Wallet</p>

            <div className="form-group">
              <label>From Account:</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                {accounts.map(acc => (
                  <option key={acc.increase_account_id} value={acc.increase_account_id}>
                    {acc.name} (${acc.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Amount (USDC):</label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>

            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={handleFundWallet}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Add Funds'}
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowFundModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donate Modal */}
      {showDonateModal && (
        <div className="modal-overlay" onClick={() => setShowDonateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Donate via Locus</h3>
            <p>Send USDC to verified charities instantly</p>

            <div className="form-group">
              <label>Select Charity:</label>
              <select
                value={selectedCharity}
                onChange={(e) => setSelectedCharity(e.target.value)}
              >
                <option value="">Choose a charity...</option>
                {charities.map(charity => (
                  <option key={charity.id} value={charity.id}>
                    {charity.name} - {charity.category}
                  </option>
                ))}
              </select>
              {selectedCharity && (
                <p className="charity-description">
                  {charities.find(c => c.id === parseInt(selectedCharity))?.description}
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Amount (USDC):</label>
              <input
                type="number"
                value={donateAmount}
                onChange={(e) => setDonateAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
              <p className="balance-note">
                Available: ${walletData?.balance.toFixed(2) || '0.00'} USDC
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={handleDonate}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Send Donation'}
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowDonateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocusWallet;
