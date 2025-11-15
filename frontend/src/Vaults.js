import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Vaults.css';

function Vaults() {
  const [customerId, setCustomerId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // Onboarding form
  const [onboardingForm, setOnboardingForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    postalCode: ''
  });

  // Create vault form
  const [vaultForm, setVaultForm] = useState({
    name: '',
    purpose: '',
    goalAmount: ''
  });

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: ''
  });

  // Load customer ID from localStorage on mount
  useEffect(() => {
    const storedCustomerId = localStorage.getItem('unit_customer_id');
    if (storedCustomerId) {
      setCustomerId(storedCustomerId);
      loadAccounts(storedCustomerId);
    }
  }, []);

  const loadAccounts = async (custId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/unit/accounts/${custId}`);
      if (response.data.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/unit/customer', onboardingForm);

      if (response.data.success) {
        const newCustomerId = response.data.customerId;
        setCustomerId(newCustomerId);
        localStorage.setItem('unit_customer_id', newCustomerId);

        // Create main account automatically
        await axios.post('/api/unit/account', {
          customerId: newCustomerId,
          accountName: 'Main Account'
        });

        setShowOnboarding(false);
        alert('Account created successfully! You can now create vaults.');
        loadAccounts(newCustomerId);
      } else {
        alert('Error creating customer: ' + (response.data.error || JSON.stringify(response.data)));
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert('Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/unit/vault', {
        customerId,
        ...vaultForm,
        goalAmount: vaultForm.goalAmount ? parseFloat(vaultForm.goalAmount) : null
      });

      if (response.data.success) {
        alert('Vault created successfully!');
        setShowCreateVault(false);
        setVaultForm({ name: '', purpose: '', goalAmount: '' });
        loadAccounts(customerId);
      } else {
        alert('Error creating vault: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error creating vault:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/unit/transfer', {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description || 'Transfer between vaults'
      });

      if (response.data.success) {
        alert('Transfer completed successfully!');
        setShowTransfer(false);
        setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
        loadAccounts(customerId);
      } else {
        alert('Error transferring funds: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error transferring funds:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const mainAccount = accounts.find(acc => acc.isMainAccount);
  const vaults = accounts.filter(acc => !acc.isMainAccount);
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <div className="vaults-container">
      <div className="vaults-header">
        <h1>🏦 Your Vaults</h1>
        <p>Create sub-accounts to organize your money and reach your financial goals</p>
      </div>

      {!customerId ? (
        <div className="onboarding-welcome">
          <div className="welcome-card">
            <h2>Welcome to Unit Banking!</h2>
            <p>Get started by creating your Unit account. This will allow you to:</p>
            <ul>
              <li>Create a main bank account (FDIC insured)</li>
              <li>Create unlimited sub-vaults for different savings goals</li>
              <li>Transfer money between vaults instantly</li>
              <li>Track your progress towards financial goals</li>
            </ul>
            <button onClick={() => setShowOnboarding(true)} className="primary-button">
              Get Started
            </button>
            <div className="sandbox-notice">
              ⚠️ This is Unit's sandbox environment for testing
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Section */}
          <div className="vaults-summary">
            <div className="summary-card">
              <div className="summary-label">Total Balance</div>
              <div className="summary-value">${totalBalance.toFixed(2)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Main Account</div>
              <div className="summary-value">
                ${mainAccount ? mainAccount.balance.toFixed(2) : '0.00'}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Vaults</div>
              <div className="summary-value">{vaults.length}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button onClick={() => setShowCreateVault(true)} className="primary-button">
              + Create New Vault
            </button>
            <button onClick={() => setShowTransfer(true)} className="secondary-button">
              💸 Transfer Money
            </button>
            <button onClick={() => loadAccounts(customerId)} className="secondary-button">
              🔄 Refresh
            </button>
          </div>

          {/* Main Account */}
          {mainAccount && (
            <div className="account-section">
              <h2>Main Account</h2>
              <div className="account-card main-account">
                <div className="account-icon">🏦</div>
                <div className="account-info">
                  <div className="account-name">{mainAccount.name}</div>
                  <div className="account-id">ID: {mainAccount.id}</div>
                  <div className="account-status">Status: {mainAccount.status}</div>
                </div>
                <div className="account-balance">
                  ${mainAccount.balance.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Vaults */}
          <div className="vaults-section">
            <h2>Your Vaults ({vaults.length})</h2>
            {vaults.length === 0 ? (
              <div className="empty-state">
                <p>No vaults yet. Create your first vault to start organizing your money!</p>
              </div>
            ) : (
              <div className="vaults-grid">
                {vaults.map(vault => (
                  <div key={vault.id} className="vault-card">
                    <div className="vault-header">
                      <div className="vault-icon">💰</div>
                      <div className="vault-name">{vault.name}</div>
                    </div>
                    <div className="vault-balance">${vault.balance.toFixed(2)}</div>
                    {vault.purpose && (
                      <div className="vault-purpose">{vault.purpose}</div>
                    )}
                    {vault.goalAmount && (
                      <div className="vault-goal">
                        <div className="goal-label">Goal: ${vault.goalAmount.toFixed(2)}</div>
                        <div className="goal-progress">
                          <div
                            className="goal-progress-bar"
                            style={{
                              width: `${Math.min((vault.balance / vault.goalAmount) * 100, 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="goal-percentage">
                          {Math.round((vault.balance / vault.goalAmount) * 100)}% complete
                        </div>
                      </div>
                    )}
                    <div className="vault-footer">
                      <span className="vault-id">ID: {vault.id.substring(0, 12)}...</span>
                      <span className={`vault-status ${vault.status}`}>{vault.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="modal-overlay" onClick={() => setShowOnboarding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Your Unit Account</h2>
              <button onClick={() => setShowOnboarding(false)} className="close-button">×</button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  required
                  value={onboardingForm.firstName}
                  onChange={(e) => setOnboardingForm({...onboardingForm, firstName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  required
                  value={onboardingForm.lastName}
                  onChange={(e) => setOnboardingForm({...onboardingForm, lastName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  required
                  value={onboardingForm.email}
                  onChange={(e) => setOnboardingForm({...onboardingForm, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Phone (e.g., 5555551234) *</label>
                <input
                  type="tel"
                  required
                  value={onboardingForm.phone}
                  onChange={(e) => setOnboardingForm({...onboardingForm, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={onboardingForm.dateOfBirth}
                  onChange={(e) => setOnboardingForm({...onboardingForm, dateOfBirth: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Address *</label>
                <input
                  type="text"
                  required
                  value={onboardingForm.address}
                  onChange={(e) => setOnboardingForm({...onboardingForm, address: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    required
                    value={onboardingForm.city}
                    onChange={(e) => setOnboardingForm({...onboardingForm, city: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    required
                    maxLength="2"
                    placeholder="CA"
                    value={onboardingForm.state}
                    onChange={(e) => setOnboardingForm({...onboardingForm, state: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Zip Code *</label>
                  <input
                    type="text"
                    required
                    value={onboardingForm.postalCode}
                    onChange={(e) => setOnboardingForm({...onboardingForm, postalCode: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowOnboarding(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="primary-button">
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Vault Modal */}
      {showCreateVault && (
        <div className="modal-overlay" onClick={() => setShowCreateVault(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Vault</h2>
              <button onClick={() => setShowCreateVault(false)} className="close-button">×</button>
            </div>
            <form onSubmit={handleCreateVault}>
              <div className="form-group">
                <label>Vault Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Emergency Fund, Vacation, House Down Payment"
                  value={vaultForm.name}
                  onChange={(e) => setVaultForm({...vaultForm, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <textarea
                  placeholder="What is this vault for?"
                  value={vaultForm.purpose}
                  onChange={(e) => setVaultForm({...vaultForm, purpose: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Goal Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 10000"
                  value={vaultForm.goalAmount}
                  onChange={(e) => setVaultForm({...vaultForm, goalAmount: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateVault(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="primary-button">
                  {loading ? 'Creating...' : 'Create Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transfer Money</h2>
              <button onClick={() => setShowTransfer(false)} className="close-button">×</button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>From Account *</label>
                <select
                  required
                  value={transferForm.fromAccountId}
                  onChange={(e) => setTransferForm({...transferForm, fromAccountId: e.target.value})}
                >
                  <option value="">Select account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (${acc.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>To Account *</label>
                <select
                  required
                  value={transferForm.toAccountId}
                  onChange={(e) => setTransferForm({...transferForm, toAccountId: e.target.value})}
                >
                  <option value="">Select account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (${acc.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount ($) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Optional note about this transfer"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowTransfer(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="primary-button">
                  {loading ? 'Processing...' : 'Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Vaults;
