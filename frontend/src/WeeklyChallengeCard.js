import React, { useState, useEffect } from 'react';
import './WeeklyChallengeCard.css';

function WeeklyChallengeCard() {
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchChallenge();
  }, []);

  const fetchChallenge = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/challenges/current');
      const data = await response.json();

      if (data.success) {
        setChallenge(data.challenge);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching challenge:', error);
      setLoading(false);
    }
  };

  const handleClaimReward = async () => {
    setClaiming(true);
    try {
      const response = await fetch('http://localhost:5001/api/challenges/claim-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        alert(`🎉 ${data.message}`);
        // Refresh challenge data
        await fetchChallenge();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Error claiming reward');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="weekly-challenge-card loading">
        <p>Loading challenge...</p>
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  const progressPercentage = (challenge.progress / challenge.goalDays) * 100;

  return (
    <div className={`weekly-challenge-card ${challenge.isCompleted ? 'completed' : ''}`}>
      <div className="challenge-header">
        <div className="challenge-icon">🏆</div>
        <div className="challenge-info">
          <h3>{challenge.title}</h3>
          <p>{challenge.description}</p>
        </div>
      </div>

      <div className="challenge-progress">
        <div className="progress-stats">
          <span className="progress-text">
            <strong>{challenge.progress}</strong> / {challenge.goalDays} days
          </span>
          {!challenge.isCompleted && (
            <span className="reward-badge">
              ${challenge.rewardAmount} reward
            </span>
          )}
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          >
            {progressPercentage > 0 && (
              <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
            )}
          </div>
        </div>
      </div>

      {challenge.isCompleted && !challenge.rewardClaimed && (
        <button
          onClick={handleClaimReward}
          disabled={claiming}
          className="claim-reward-button"
        >
          {claiming ? 'Claiming...' : `🎁 Claim $${challenge.rewardAmount} Reward`}
        </button>
      )}

      {challenge.isCompleted && challenge.rewardClaimed && (
        <div className="reward-claimed-badge">
          ✅ Reward Claimed!
        </div>
      )}

      {!challenge.isCompleted && (
        <div className="challenge-tip">
          💡 Tip: Use Smart Savings or accept a Windfall suggestion to make progress!
        </div>
      )}
    </div>
  );
}

export default WeeklyChallengeCard;
