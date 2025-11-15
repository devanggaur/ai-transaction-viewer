import React, { useState, useEffect } from 'react';
import './FreshStartBanner.css';

function FreshStartBanner() {
  const [freshStart, setFreshStart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkFreshStart();
  }, []);

  const checkFreshStart = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/savings/fresh-start/check');
      const data = await response.json();

      if (data.shouldShow) {
        setFreshStart(data.freshStart);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error checking fresh start:', error);
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!freshStart) return;

    setAccepting(true);
    try {
      const response = await fetch('http://localhost:5001/api/savings/fresh-start/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bumpPercentage: freshStart.suggestedBump
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`🎉 ${data.message}\n\nOld: $${data.oldAmount?.toFixed(2) || 0}/auto-save\nNew: $${data.newAmount?.toFixed(2) || 0}/auto-save`);
        setFreshStart(null); // Hide banner after accepting
      } else {
        alert('Error applying fresh start bump');
      }
    } catch (error) {
      console.error('Error accepting fresh start:', error);
      alert('Error applying fresh start bump');
    } finally {
      setAccepting(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await fetch('http://localhost:5001/api/savings/fresh-start/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      setFreshStart(null);
    } catch (error) {
      console.error('Error dismissing fresh start:', error);
      setFreshStart(null); // Hide anyway
    }
  };

  if (loading || !freshStart) {
    return null;
  }

  return (
    <div className={`fresh-start-banner ${freshStart.type}`}>
      <div className="fresh-start-content">
        <div className="fresh-start-icon">{freshStart.emoji}</div>
        <div className="fresh-start-text">
          <h3>{freshStart.title}</h3>
          <p>{freshStart.message}</p>
          <p className="fresh-start-suggestion">
            💡 Boost your auto-save by <strong>{freshStart.suggestedBump}%</strong>
            {freshStart.currentAutoSave.amount > 0 && (
              <span className="fresh-start-amounts">
                {' '}(${freshStart.currentAutoSave.amount?.toFixed(2)} → ${freshStart.newAutoSaveAmount?.toFixed(2)})
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="fresh-start-actions">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="fresh-start-accept"
        >
          {accepting ? 'Applying...' : `Boost +${freshStart.suggestedBump}%`}
        </button>
        <button
          onClick={handleDismiss}
          className="fresh-start-dismiss"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

export default FreshStartBanner;
