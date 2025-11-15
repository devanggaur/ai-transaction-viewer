import React, { useState, useEffect } from 'react';
import './SavingsSuggestions.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function SavingsSuggestions({ transactions, entityId }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState('');
  const [mainAccount, setMainAccount] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({}); // Track selected option per opportunity
  const [useTestData, setUseTestData] = useState(false);

  // Fetch vaults and main account
  useEffect(() => {
    if (entityId) {
      fetchAccounts();
    }
  }, [entityId]);

  // Auto-analyze transactions when they change
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      analyzeOpportunities();
    }
  }, [transactions]);

  // Initialize selected options when opportunities change
  useEffect(() => {
    const initialOptions = {};
    opportunities.forEach((opp, idx) => {
      if (opp.prompt && opp.prompt.options) {
        initialOptions[idx] = 0; // Select first option by default
      }
    });
    setSelectedOptions(initialOptions);
  }, [opportunities]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/increase/accounts/${entityId}`);
      const data = await response.json();

      if (data.success && data.accounts) {
        const main = data.accounts.find(acc => acc.is_main_account);
        const vaultAccounts = data.accounts.filter(acc => !acc.is_main_account && acc.account_type === 'vault');

        setMainAccount(main);
        setVaults(vaultAccounts);

        if (vaultAccounts.length > 0 && !selectedVault) {
          setSelectedVault(vaultAccounts[0].increase_account_id);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const getTestTransactions = () => {
    return [
      // Windfall: Large bonus payment
      { amount: -2000.0, date: "2025-11-14", name: "Annual Bonus", merchant_name: "Company Inc" },
      // Regular income
      { amount: -500.0, date: "2025-10-15", name: "Paycheck", merchant_name: "Company Inc" },
      { amount: -500.0, date: "2025-10-01", name: "Paycheck", merchant_name: "Company Inc" },
      { amount: -500.0, date: "2025-09-15", name: "Paycheck", merchant_name: "Company Inc" },
      // This week spending (light week)
      { amount: 50.0, date: "2025-11-14", name: "Groceries", merchant_name: "Whole Foods" },
      { amount: 30.0, date: "2025-11-13", name: "Gas", merchant_name: "Shell" },
      { amount: 20.0, date: "2025-11-12", name: "Coffee", merchant_name: "Starbucks" },
      // Previous weeks (heavier spending)
      { amount: 100.0, date: "2025-11-07", name: "Restaurant", merchant_name: "Chipotle" },
      { amount: 120.0, date: "2025-11-06", name: "Groceries", merchant_name: "Whole Foods" },
      { amount: 150.0, date: "2025-11-05", name: "Shopping", merchant_name: "Target" },
      { amount: 100.0, date: "2025-10-31", name: "Restaurant", merchant_name: "Chipotle" },
      { amount: 120.0, date: "2025-10-30", name: "Groceries", merchant_name: "Whole Foods" },
      { amount: 150.0, date: "2025-10-29", name: "Shopping", merchant_name: "Target" },
      { amount: 100.0, date: "2025-10-24", name: "Restaurant", merchant_name: "Chipotle" },
      { amount: 120.0, date: "2025-10-23", name: "Groceries", merchant_name: "Whole Foods" },
      { amount: 150.0, date: "2025-10-22", name: "Shopping", merchant_name: "Target" }
    ];
  };

  const analyzeOpportunities = async () => {
    setLoading(true);
    try {
      const transactionsToAnalyze = useTestData ? getTestTransactions() : transactions;

      const response = await fetch(`${API_URL}/api/savings/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsToAnalyze })
      });

      const data = await response.json();

      if (data.success && data.opportunities) {
        setOpportunities(data.opportunities);
      }
    } catch (error) {
      console.error('Error analyzing savings opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptWindfall = async (opportunity, selectedAmount) => {
    if (!selectedVault || !mainAccount) {
      alert('Please select a vault to save to');
      return;
    }

    setProcessingAction('windfall');
    try {
      const response = await fetch(`${API_URL}/api/savings/windfall/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          toVaultId: selectedVault,
          fromAccountId: mainAccount.increase_account_id,
          description: `Windfall Savings: ${opportunity.data.source}`
        })
      });

      const data = await response.json();

      if (data.success) {
        // Increment savings streak
        try {
          const streakResponse = await fetch(`${API_URL}/api/locus/streak/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const streakData = await streakResponse.json();

          if (streakData.success && streakData.awarded) {
            alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!\n\n🎉 Bonus: ${streakData.reason}\nYou earned $${streakData.amount} in your AI Wallet!`);
          } else {
            alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!`);
          }
        } catch (streakError) {
          console.error('Error updating streak:', streakError);
          alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!`);
        }

        // Remove this opportunity
        setOpportunities(prev => prev.filter(opp => opp.type !== 'windfall'));
        // Refresh accounts
        fetchAccounts();
      } else {
        alert(`Error: ${data.error || 'Failed to save'}`);
      }
    } catch (error) {
      console.error('Error executing windfall savings:', error);
      alert('Error processing savings');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleAcceptSweep = async (opportunity, selectedAmount) => {
    if (!selectedVault || !mainAccount) {
      alert('Please select a vault to save to');
      return;
    }

    setProcessingAction('sweep');
    try {
      const response = await fetch(`${API_URL}/api/savings/sweep/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          toVaultId: selectedVault,
          fromAccountId: mainAccount.increase_account_id,
          description: 'Smart Sweep: Weekly Savings'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Increment savings streak
        try {
          const streakResponse = await fetch(`${API_URL}/api/locus/streak/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const streakData = await streakResponse.json();

          if (streakData.success && streakData.awarded) {
            alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!\n\n🎉 Bonus: ${streakData.reason}\nYou earned $${streakData.amount} in your AI Wallet!`);
          } else {
            alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!`);
          }
        } catch (streakError) {
          console.error('Error updating streak:', streakError);
          alert(`Success! Saved $${selectedAmount.toFixed(2)} to your vault!`);
        }

        // Remove this opportunity
        setOpportunities(prev => prev.filter(opp => opp.type !== 'sweep'));
        // Refresh accounts
        fetchAccounts();
      } else {
        alert(`Error: ${data.error || 'Failed to save'}`);
      }
    } catch (error) {
      console.error('Error executing sweep savings:', error);
      alert('Error processing savings');
    } finally {
      setProcessingAction(null);
    }
  };

  const dismissOpportunity = (type) => {
    setOpportunities(prev => prev.filter(opp => opp.type !== type));
  };

  const renderWindfallCard = (opportunity, index) => {
    const { prompt } = opportunity;
    const selectedOptionIndex = selectedOptions[index] || 0;
    const selectedOption = prompt.options[selectedOptionIndex];

    const handleOptionSelect = (optionIndex) => {
      setSelectedOptions(prev => ({
        ...prev,
        [index]: optionIndex
      }));
    };

    return (
      <div className="opportunity-card windfall-card">
        <div className="opportunity-header">
          <span className="opportunity-icon">💰</span>
          <h3>{prompt.title}</h3>
        </div>

        <p className="opportunity-message">{prompt.message}</p>

        <div className="opportunity-options">
          {prompt.options.map((option, idx) => (
            <button
              key={idx}
              className={`option-button ${idx === selectedOptionIndex ? 'selected' : ''}`}
              onClick={() => handleOptionSelect(idx)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {selectedOption.value > 0 && vaults.length > 0 && (
          <div className="vault-selector">
            <label>Save to vault:</label>
            <select value={selectedVault} onChange={(e) => setSelectedVault(e.target.value)}>
              {vaults.map(vault => (
                <option key={vault.increase_account_id} value={vault.increase_account_id}>
                  {vault.name} (${vault.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="impact-message">{prompt.impact}</p>

        <div className="opportunity-actions">
          {selectedOption.value > 0 ? (
            <button
              className="accept-button"
              onClick={() => handleAcceptWindfall(opportunity, selectedOption.value)}
              disabled={processingAction === 'windfall' || !selectedVault}
            >
              {processingAction === 'windfall' ? 'Processing...' : `Save $${selectedOption.value.toFixed(2)}`}
            </button>
          ) : (
            <button
              className="dismiss-button"
              onClick={() => dismissOpportunity('windfall')}
            >
              No thanks
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSweepCard = (opportunity, index) => {
    const { prompt } = opportunity;
    const selectedOptionIndex = selectedOptions[index] || 0;
    const selectedOption = prompt.options[selectedOptionIndex];

    const handleOptionSelect = (optionIndex) => {
      setSelectedOptions(prev => ({
        ...prev,
        [index]: optionIndex
      }));
    };

    return (
      <div className="opportunity-card sweep-card">
        <div className="opportunity-header">
          <span className="opportunity-icon">🎯</span>
          <h3>{prompt.title}</h3>
        </div>

        <p className="opportunity-message">{prompt.message}</p>

        <div className="opportunity-options">
          {prompt.options.map((option, idx) => (
            <button
              key={idx}
              className={`option-button ${idx === selectedOptionIndex ? 'selected' : ''}`}
              onClick={() => handleOptionSelect(idx)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {selectedOption.value > 0 && vaults.length > 0 && (
          <div className="vault-selector">
            <label>Save to vault:</label>
            <select value={selectedVault} onChange={(e) => setSelectedVault(e.target.value)}>
              {vaults.map(vault => (
                <option key={vault.increase_account_id} value={vault.increase_account_id}>
                  {vault.name} (${vault.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="opportunity-actions">
          {selectedOption.value > 0 ? (
            <button
              className="accept-button"
              onClick={() => handleAcceptSweep(opportunity, selectedOption.value)}
              disabled={processingAction === 'sweep' || !selectedVault}
            >
              {processingAction === 'sweep' ? 'Processing...' : `Save $${selectedOption.value.toFixed(2)}`}
            </button>
          ) : (
            <button
              className="dismiss-button"
              onClick={() => dismissOpportunity('sweep')}
            >
              Keep it all
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="savings-suggestions-container">
        <div className="loading-message">
          <span className="spinner"></span>
          <p>Analyzing your savings opportunities...</p>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="savings-suggestions-container">
        <div className="no-opportunities">
          <span className="icon">✨</span>
          <p>No savings opportunities detected right now.</p>
          <small>Keep spending wisely! We'll let you know when we find opportunities.</small>

          {!useTestData && (
            <div style={{ marginTop: '2rem' }}>
              <button
                className="primary-button"
                onClick={() => {
                  setUseTestData(true);
                  setTimeout(() => analyzeOpportunities(), 100);
                }}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                Try Demo Mode
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                See how the Smart Savings features work with sample data
              </p>
            </div>
          )}

          {useTestData && (
            <div style={{ marginTop: '2rem' }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setUseTestData(false);
                  setTimeout(() => analyzeOpportunities(), 100);
                }}
              >
                Back to Real Data
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="savings-suggestions-container">
      <div className="suggestions-header">
        <h2>💡 Savings Opportunities {useTestData && <span style={{fontSize: '0.7em', color: '#10b981'}}>(Demo Mode)</span>}</h2>
        <p>Your AI savings agent found {opportunities.length} way{opportunities.length > 1 ? 's' : ''} to boost your savings!</p>
        {useTestData && (
          <button
            className="secondary-button"
            onClick={() => {
              setUseTestData(false);
              setTimeout(() => analyzeOpportunities(), 100);
            }}
            style={{ marginTop: '1rem', fontSize: '0.9rem' }}
          >
            Exit Demo Mode
          </button>
        )}
      </div>

      <div className="opportunities-grid">
        {opportunities.map((opp, idx) => (
          <div key={idx}>
            {opp.type === 'windfall' && renderWindfallCard(opp, idx)}
            {opp.type === 'sweep' && renderSweepCard(opp, idx)}
          </div>
        ))}
      </div>

      {opportunities.length > 0 && (
        <div className="total-potential">
          <strong>Total Potential Savings:</strong> ${opportunities.reduce((sum, opp) => {
            if (opp.type === 'windfall') return sum + opp.data.suggestedSavings;
            if (opp.type === 'sweep') return sum + opp.data.suggestedSavings;
            return sum;
          }, 0).toFixed(2)}
        </div>
      )}
    </div>
  );
}

export default SavingsSuggestions;
