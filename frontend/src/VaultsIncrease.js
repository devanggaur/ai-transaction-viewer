import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Vaults.css';

function VaultsIncrease() {
  // Use the existing Increase entity ID
  const ENTITY_ID = 'sandbox_entity_mypgdnyciycaoev7jpro';

  const [entityId] = useState(ENTITY_ID);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

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

  // Load accounts on mount
  useEffect(() => {
    if (entityId) {
      loadAccounts(entityId);
    }
  }, [entityId]);

  const loadAccounts = async (entId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/increase/accounts/${entId}`);
      if (response.data.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/increase/vault', {
        entityId,
        ...vaultForm,
        goalAmount: vaultForm.goalAmount ? parseFloat(vaultForm.goalAmount) : null
      });

      if (response.data.success) {
        alert('Vault created successfully!');
        setShowCreateVault(false);
        setVaultForm({ name: '', purpose: '', goalAmount: '' });
        loadAccounts(entityId);
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
      const response = await axios.post('/api/increase/transfer', {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description || 'Transfer between vaults'
      });

      if (response.data.success) {
        alert('Transfer completed successfully! (Free & Instant ⚡)');
        setShowTransfer(false);
        setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
        loadAccounts(entityId);
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

  const handleCreateMainAccount = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/increase/account', {
        entityId,
        name: 'Main Checking Account',
        isMainAccount: true
      });

      if (response.data.success) {
        alert('Main account created successfully!');
        loadAccounts(entityId);
      } else {
        alert('Error creating account: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const mainAccount = accounts.find(acc => acc.isMainAccount);
  const vaults = accounts.filter(acc => !acc.isMainAccount);
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  return (
    <div className="vaults-container">
      <div className="vaults-header">
        <h1>🏦 Your Increase Vaults</h1>
        <p>Unlimited sub-accounts to organize your money and reach your financial goals</p>
        <div className="sandbox-notice">
          ⚡ Powered by Increase • Free & Instant Transfers • Unlimited Vaults
        </div>
      </div>

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
        {!mainAccount && (
          <button onClick={handleCreateMainAccount} className="primary-button">
            + Create Main Account
          </button>
        )}
        <button onClick={() => setShowCreateVault(true)} className="primary-button">
          + Create New Vault
        </button>
        <button
          onClick={() => setShowTransfer(true)}
          className="secondary-button"
          disabled={accounts.length < 2}
        >
          💸 Transfer Money
        </button>
        <button onClick={() => loadAccounts(entityId)} className="secondary-button">
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
              <div className="account-bank">Bank: First Internet Bank (FDIC Insured)</div>
            </div>
            <div className="account-balance">
              ${(mainAccount.balance || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Vaults */}
      <div className="vaults-section">
        <h2>Your Vaults ({vaults.length})</h2>
        {vaults.length === 0 ? (
          <div className="empty-state">
            <p>🎯 No vaults yet. Create your first vault to start organizing your money!</p>
            <p className="empty-state-sub">Each vault is a separate bank account with its own balance.</p>
          </div>
        ) : (
          <div className="vaults-grid">
            {vaults.map(vault => (
              <div key={vault.id} className="vault-card">
                <div className="vault-header">
                  <div className="vault-icon">💰</div>
                  <div className="vault-name">{vault.name}</div>
                </div>
                <div className="vault-balance">${(vault.balance || 0).toFixed(2)}</div>
                {vault.purpose && (
                  <div className="vault-purpose">📝 {vault.purpose}</div>
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
                  <span className="vault-id">ID: {vault.id.substring(0, 20)}...</span>
                  <span className={`vault-status ${vault.status}`}>{vault.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              <h2>Transfer Money ⚡</h2>
              <button onClick={() => setShowTransfer(false)} className="close-button">×</button>
            </div>
            <div className="transfer-notice">
              💡 Transfers between Increase accounts are <strong>free and instant</strong>!
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
                      {acc.name} (${(acc.balance || 0).toFixed(2)})
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
                      {acc.name} (${(acc.balance || 0).toFixed(2)})
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
                  {loading ? 'Processing...' : 'Transfer Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VaultsIncrease;
