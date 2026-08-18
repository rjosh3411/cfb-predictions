import React, { useState, useEffect } from 'react';
import './index.css';

const API_BASE = '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('predictions');
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [currentUser, setCurrentUser] = useState(null); // Global User Profile
  const [activePartyCode, setActivePartyCode] = useState(''); // Active party code
  const [showPartyOnboarding, setShowPartyOnboarding] = useState(false);
  
  // Onboarding (Auth) State
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [partyMode, setPartyMode] = useState('join'); // 'join' | 'create'
  const [usernameInput, setUsernameInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [partyCodeInput, setPartyCodeInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [users, setUsers] = useState([]);
  const [buddyId, setBuddyId] = useState('');
  const [compFilter, setCompFilter] = useState('all'); // 'all' | 'agreements' | 'disagreements'
  
  // Loading & Sync states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [selectedConf, setSelectedConf] = useState('SEC');
  const [focusedConferences, setFocusedConferences] = useState(() => {
    const saved = localStorage.getItem('gridiron_focused_conferences');
    return saved ? JSON.parse(saved) : ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Group of 5', 'Ind.'];
  });
  const [showFocusConfig, setShowFocusConfig] = useState(false);
  const [standingsConfFilter, setStandingsConfFilter] = useState('ALL');
  const [compareConfFilter, setCompareConfFilter] = useState('ALL');
  const [adminConfFilter, setAdminConfFilter] = useState('ALL');

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const savedUsername = localStorage.getItem('gridiron_username');
        const savedActiveParty = localStorage.getItem('gridiron_active_party') || '';
        
        const [teamsRes, gamesRes] = await Promise.all([
          fetch(`${API_BASE}/teams`),
          fetch(`${API_BASE}/games`)
        ]);
        const teamsData = await teamsRes.json();
        const gamesData = await gamesRes.json();
        setTeams(teamsData);
        setGames(gamesData);
        
        if (savedUsername) {
          const loginRes = await fetch(`${API_BASE}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: savedUsername })
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            setCurrentUser(loginData.user);
            
            const userParties = loginData.user.parties || [];
            let activeCode = savedActiveParty;
            if (!activeCode || !userParties.includes(activeCode)) {
              activeCode = userParties.length > 0 ? userParties[0] : '';
            }
            
            if (activeCode) {
              setActivePartyCode(activeCode);
              localStorage.setItem('gridiron_active_party', activeCode);
              
              const [usersRes, predsRes] = await Promise.all([
                fetch(`${API_BASE}/users?partyCode=${activeCode}`),
                fetch(`${API_BASE}/predictions?partyCode=${activeCode}`)
              ]);
              setUsers(await usersRes.json());
              setPredictions(await predsRes.json());
            } else {
              setShowPartyOnboarding(true);
            }
          } else {
            localStorage.removeItem('gridiron_username');
            localStorage.removeItem('gridiron_active_party');
          }
        }
        
        if (teamsData.length > 0) {
          const secTeams = teamsData.filter(t => t.conference === 'SEC');
          const defaultTeam = secTeams.length > 0 ? secTeams[0] : teamsData[0];
          setSelectedTeamId(defaultTeam.id);
          setSelectedConf(defaultTeam.conference);
        }
      } catch (err) {
        console.error("Error loading application data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update Buddy ID defaults when users change
  useEffect(() => {
    if (currentUser && users.length > 1 && !buddyId) {
      const otherUser = users.find(u => u.id !== currentUser.id);
      if (otherUser) {
        setBuddyId(otherUser.id);
      }
    }
  }, [users, currentUser, buddyId]);

  // Set team primary brand colors on root elements dynamically
  useEffect(() => {
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    if (selectedTeam) {
      document.documentElement.style.setProperty('--team-color', selectedTeam.colors.primary);
      document.documentElement.style.setProperty('--team-color-glow', `${selectedTeam.colors.primary}33`);
      setSelectedConf(selectedTeam.conference);
    }
  }, [selectedTeamId, teams]);

  useEffect(() => {
    localStorage.setItem('gridiron_focused_conferences', JSON.stringify(focusedConferences));
  }, [focusedConferences]);

  useEffect(() => {
    if (standingsConfFilter !== 'ALL' && !focusedConferences.includes(standingsConfFilter)) {
      setStandingsConfFilter('ALL');
    }
  }, [focusedConferences, standingsConfFilter]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!usernameInput.trim()) {
      setLoginError('Username is required.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        setLoginError(errorData.error || 'Failed to log in.');
        return;
      }
      
      const data = await res.json();
      setCurrentUser(data.user);
      localStorage.setItem('gridiron_username', data.user.id);
      
      const userParties = data.user.parties || [];
      if (userParties.length > 0) {
        const activeCode = userParties[0];
        setActivePartyCode(activeCode);
        localStorage.setItem('gridiron_active_party', activeCode);
        
        const usersRes = await fetch(`${API_BASE}/users?partyCode=${activeCode}`);
        const predsRes = await fetch(`${API_BASE}/predictions?partyCode=${activeCode}`);
        setUsers(await usersRes.json());
        setPredictions(await predsRes.json());
        setShowPartyOnboarding(false);
      } else {
        setActivePartyCode('');
        setShowPartyOnboarding(true);
      }
      setUsernameInput('');
    } catch (err) {
      console.error(err);
      setLoginError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!usernameInput.trim()) {
      setLoginError('Username is required.');
      return;
    }
    if (!displayNameInput.trim()) {
      setLoginError('Display Name is required.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          displayName: displayNameInput
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        setLoginError(errorData.error || 'Failed to register profile.');
        return;
      }
      
      const data = await res.json();
      setCurrentUser(data.user);
      localStorage.setItem('gridiron_username', data.user.id);
      
      setActivePartyCode('');
      setShowPartyOnboarding(true);
      setUsernameInput('');
      setDisplayNameInput('');
    } catch (err) {
      console.error(err);
      setLoginError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!partyNameInput.trim()) {
      setLoginError('Party name is required.');
      return;
    }
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/parties/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyName: partyNameInput,
          userId: currentUser.id
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        setLoginError(errorData.error || 'Failed to create party.');
        return;
      }
      
      const data = await res.json();
      setCurrentUser(data.user);
      
      const activeCode = data.party.code;
      setActivePartyCode(activeCode);
      localStorage.setItem('gridiron_active_party', activeCode);
      
      const usersRes = await fetch(`${API_BASE}/users?partyCode=${activeCode}`);
      const predsRes = await fetch(`${API_BASE}/predictions?partyCode=${activeCode}`);
      setUsers(await usersRes.json());
      setPredictions(await predsRes.json());
      setShowPartyOnboarding(false);
      setPartyNameInput('');
    } catch (err) {
      console.error(err);
      setLoginError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!partyCodeInput.trim()) {
      setLoginError('Invite code is required.');
      return;
    }
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/parties/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyCode: partyCodeInput,
          userId: currentUser.id
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        setLoginError(errorData.error || 'Failed to join party.');
        return;
      }
      
      const data = await res.json();
      setCurrentUser(data.user);
      
      const activeCode = data.party.code;
      setActivePartyCode(activeCode);
      localStorage.setItem('gridiron_active_party', activeCode);
      
      const usersRes = await fetch(`${API_BASE}/users?partyCode=${activeCode}`);
      const predsRes = await fetch(`${API_BASE}/predictions?partyCode=${activeCode}`);
      setUsers(await usersRes.json());
      setPredictions(await predsRes.json());
      setShowPartyOnboarding(false);
      setPartyCodeInput('');
    } catch (err) {
      console.error(err);
      setLoginError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const switchActiveParty = async (code) => {
    if (!code) return;
    
    setLoading(true);
    try {
      localStorage.setItem('gridiron_active_party', code);
      setActivePartyCode(code);
      
      const usersRes = await fetch(`${API_BASE}/users?partyCode=${code}`);
      const predsRes = await fetch(`${API_BASE}/predictions?partyCode=${code}`);
      const usersData = await usersRes.json();
      const predsData = await predsRes.json();
      
      setUsers(usersData);
      setPredictions(predsData);
      
      const otherUser = usersData.find(u => u.id !== currentUser.id);
      setBuddyId(otherUser ? otherUser.id : '');
    } catch (err) {
      console.error("Failed to switch active party:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gridiron_username');
    localStorage.removeItem('gridiron_active_party');
    setCurrentUser(null);
    setActivePartyCode('');
    setUsers([]);
    setPredictions({});
    setBuddyId('');
    setUsernameInput('');
    setDisplayNameInput('');
    setPartyCodeInput('');
    setPartyNameInput('');
  };

  const handleDeleteParty = async () => {
    if (!activePartyCode) return;
    
    const confirmDelete = window.confirm(
      `⚠️ WARNING: Are you sure you want to delete the party "${activePartyCode}"?\n\nThis will permanently delete all standings and membership associated with this party code. This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/parties/${activePartyCode}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete party.');
        return;
      }
      
      alert('Party successfully deleted.');
      
      const updatedParties = (currentUser.parties || []).filter(c => c !== activePartyCode);
      const updatedUser = { ...currentUser, parties: updatedParties };
      setCurrentUser(updatedUser);
      
      if (updatedParties.length > 0) {
        await switchActiveParty(updatedParties[0]);
      } else {
        setActivePartyCode('');
        localStorage.removeItem('gridiron_active_party');
        setUsers([]);
        setPredictions({});
        setBuddyId('');
        setShowPartyOnboarding(true);
      }
    } catch (err) {
      console.error('Error deleting party:', err);
      alert('Failed to delete party due to a connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPredictions = async () => {
    if (!activePartyCode) return;
    setSyncing(true);
    try {
      const predsRes = await fetch(`${API_BASE}/predictions?partyCode=${activePartyCode}`);
      if (predsRes.ok) {
        setPredictions(await predsRes.json());
      }
    } catch (err) {
      console.error("Error refreshing predictions:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Prediction toggling logic
  const togglePrediction = async (gameId, predictedWinner) => {
    if (!currentUser) return;
    
    const userPreds = predictions[currentUser.id] || {};
    const newPreds = { ...userPreds, [gameId]: predictedWinner };
    
    // Optimistic UI state update
    setPredictions(prev => ({
      ...prev,
      [currentUser.id]: newPreds
    }));
    
    try {
      await fetch(`${API_BASE}/predictions/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: { [gameId]: predictedWinner } })
      });
    } catch (err) {
      console.error("Failed to Sync prediction to server:", err);
      // Fallback rollback
      setPredictions(prev => ({
        ...prev,
        [currentUser.id]: userPreds
      }));
    }
  };

  // Manual fallback admin winner scorer
  const handleSetWinner = async (gameId, winnerId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/games/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner: winnerId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setGames(prev => prev.map(g => g.id === gameId ? data.game : g));
      }
    } catch (err) {
      console.error("Failed to set game winner:", err);
    }
  };

  // ESPN auto score scraper triggers
  const handleSyncESPN = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      
      const res = await fetch(`${API_BASE}/games/sync`, { method: 'POST' });
      if (!res.ok) throw new Error("Sync failed");
      
      const data = await res.json();
      
      // Reload games list
      const gamesRes = await fetch(`${API_BASE}/games`);
      const gamesData = await gamesRes.json();
      setGames(gamesData);
      
      setSyncMessage(`Synced successfully with ESPN! Updated ${data.updatedGames} outcomes.`);
    } catch (err) {
      console.error(err);
      setSyncMessage("Error syncing scores from ESPN. Please check internet connection.");
    } finally {
      setSyncing(false);
    }
  };

  // Computes records
  const getProjectedRecord = (userId, teamId) => {
    const userPreds = predictions[userId] || {};
    let wins = 0;
    let losses = 0;
    
    const teamGames = games.filter(g => g.home === teamId || g.away === teamId);
    
    teamGames.forEach(g => {
      const prediction = userPreds[g.id];
      const isHome = g.home === teamId;
      const opponentId = isHome ? g.away : g.home;
      
      if (prediction) {
        if (prediction === teamId) {
          wins++;
        } else {
          losses++;
        }
      }
    });
    
    return { wins, losses };
  };

  const getUserAccuracy = (userId) => {
    const userPreds = predictions[userId] || {};
    let correct = 0;
    let totalScored = 0;
    
    games.forEach(g => {
      if (g.winner !== null) {
        totalScored++;
        if (userPreds[g.id] === g.winner) {
          correct++;
        }
      }
    });
    
    return { correct, total: totalScored };
  };

  // Rendering Loader screen
  if (loading && !currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a0d14' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', color: '#818cf8', marginBottom: '10px' }}>🏈 Gridiron Predictor</h2>
          <p style={{ color: '#94a3b8' }}>Loading schedules and predictions...</p>
        </div>
      </div>
    );
  }

  // Authentic onboarding screen for Creating or Joining Profiles (Auth)
  if (!currentUser) {
    return (
      <div className="setup-overlay">
        <div className="setup-card">
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🏈</div>
          <h2>Gridiron Predictor</h2>
          <p>Create a global profile or log in to access your prediction parties on any device.</p>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
            <button 
              className={`nav-item`} 
              style={{ 
                flex: 1, 
                padding: '12px 0', 
                borderBottom: authMode === 'login' ? '2px solid var(--color-accent)' : 'none', 
                color: authMode === 'login' ? 'white' : '#64748b',
                fontWeight: '600',
                background: 'none'
              }}
              onClick={() => setAuthMode('login')}
            >
              🔑 Log In
            </button>
            <button 
              className={`nav-item`} 
              style={{ 
                flex: 1, 
                padding: '12px 0', 
                borderBottom: authMode === 'register' ? '2px solid var(--color-accent)' : 'none', 
                color: authMode === 'register' ? 'white' : '#64748b',
                fontWeight: '600',
                background: 'none'
              }}
              onClick={() => setAuthMode('register')}
            >
              👤 Create Profile
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} style={{ width: '100%' }}>
              <input 
                type="text" 
                className="setup-input" 
                placeholder="Username (e.g. josh)" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                maxLength={20}
                required
                style={{ textTransform: 'lowercase' }}
              />
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{loginError}</p>}
              <button type="submit" className="primary-btn">
                Log In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ width: '100%' }}>
              <input 
                type="text" 
                className="setup-input" 
                placeholder="Choose Username (e.g. josh)" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                maxLength={20}
                required
                style={{ textTransform: 'lowercase' }}
              />
              <input 
                type="text" 
                className="setup-input" 
                placeholder="Display Name (e.g. Josh)" 
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                maxLength={20}
                required
              />
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{loginError}</p>}
              <button type="submit" className="primary-btn">
                Create Profile & Start
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Onboarding screen for Creating or Joining Parties (only when logged in)
  if (showPartyOnboarding || !activePartyCode) {
    const userPartiesList = currentUser.parties || [];
    
    return (
      <div className="setup-overlay">
        <div className="setup-card">
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🎉</div>
          <h2>Join or Create a Prediction Party</h2>
          <p>Hi, <strong>{currentUser.name}</strong>! Choose an action below to start predicting college football games.</p>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
            <button 
              className={`nav-item`} 
              style={{ 
                flex: 1, 
                padding: '12px 0', 
                borderBottom: partyMode === 'join' ? '2px solid var(--color-accent)' : 'none', 
                color: partyMode === 'join' ? 'white' : '#64748b',
                fontWeight: '600',
                background: 'none'
              }}
              onClick={() => setPartyMode('join')}
            >
              🔑 Join Party
            </button>
            <button 
              className={`nav-item`} 
              style={{ 
                flex: 1, 
                padding: '12px 0', 
                borderBottom: partyMode === 'create' ? '2px solid var(--color-accent)' : 'none', 
                color: partyMode === 'create' ? 'white' : '#64748b',
                fontWeight: '600',
                background: 'none'
              }}
              onClick={() => setPartyMode('create')}
            >
              🎉 Create Party
            </button>
          </div>

          {partyMode === 'create' ? (
            <form onSubmit={handleCreateParty} style={{ width: '100%' }}>
              <input 
                type="text" 
                className="setup-input" 
                placeholder="Party Name (e.g. Saturday Showdown)" 
                value={partyNameInput}
                onChange={(e) => setPartyNameInput(e.target.value)}
                maxLength={30}
                required
              />
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{loginError}</p>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {userPartiesList.length > 0 && (
                  <button type="button" className="secondary-btn" onClick={() => setShowPartyOnboarding(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="primary-btn" style={{ flex: 1 }}>
                  Create Party
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoinParty} style={{ width: '100%' }}>
              <input 
                type="text" 
                className="setup-input" 
                placeholder="Invite Code (e.g. GRID88)" 
                value={partyCodeInput}
                onChange={(e) => setPartyCodeInput(e.target.value)}
                maxLength={6}
                required
                style={{ textTransform: 'uppercase' }}
              />
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{loginError}</p>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {userPartiesList.length > 0 && (
                  <button type="button" className="secondary-btn" onClick={() => setShowPartyOnboarding(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="primary-btn" style={{ flex: 1 }}>
                  Join Party
                </button>
              </div>
            </form>
          )}

          {userPartiesList.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', width: '100%' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Or return to your active parties:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userPartiesList.map(code => (
                  <button
                    key={code}
                    onClick={() => {
                      switchActiveParty(code);
                      setShowPartyOnboarding(false);
                    }}
                    className="comp-filter-btn"
                    style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                  >
                    🎉 Join Back {code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const userPreds = predictions[currentUser.id] || {};
  
  const userScore = getUserAccuracy(currentUser.id);
  const buddyScore = buddyId ? getUserAccuracy(buddyId) : { correct: 0, total: 0 };
  const buddyObj = users.find(u => u.id === buddyId);

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="header">
        <div className="logo-section" style={{ gap: '8px' }}>
          <span className="logo-icon" style={{ fontSize: '1.2rem' }}>🏈</span>
          <div>
            <h1 style={{ fontSize: '1.1rem', margin: 0 }}>Gridiron</h1>
            {(currentUser.parties || []).length > 1 ? (
              <select
                value={activePartyCode}
                onChange={(e) => switchActiveParty(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#818cf8',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '2px 4px',
                  outline: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.5px'
                }}
              >
                {(currentUser.parties || []).map(code => (
                  <option key={code} value={code} style={{ background: '#161c2d', color: 'white' }}>
                    🎉 {code}
                  </option>
                ))}
              </select>
            ) : activePartyCode && (
              <div style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: '700', letterSpacing: '0.5px' }}>
                PARTY: {activePartyCode}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {activePartyCode && (
            <button 
              onClick={handleDeleteParty}
              className="comp-filter-btn"
              style={{ 
                padding: '4px 8px', 
                fontSize: '0.7rem', 
                borderColor: 'rgba(239, 68, 68, 0.15)', 
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.05)'
              }}
            >
              🗑️ Delete
            </button>
          )}
          {currentUser && (
            <button 
              onClick={() => {
                setShowPartyOnboarding(true);
              }}
              className="comp-filter-btn"
              style={{ 
                padding: '4px 8px', 
                fontSize: '0.7rem', 
                borderColor: 'rgba(255,255,255,0.08)'
              }}
            >
              ➕ Party
            </button>
          )}
          <div className="user-badge" onClick={handleLogout} title="Log Out" style={{ padding: '4px 8px', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem' }}>👤 {currentUser.name}</span>
            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Exit</span>
          </div>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="main-content">
        {activeTab === 'predictions' && (
          <div>
            {/* Accuracy Scoreboard Dashboard */}
            <div className="dash-grid">
              <div className="stat-card">
                <div className="stat-label">Your Accuracy Score</div>
                <div className="stat-value">
                  {userScore.correct}/{userScore.total}
                  <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                    ({userScore.total > 0 ? Math.round((userScore.correct / userScore.total) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">{buddyObj ? `${buddyObj.name}'s Score` : 'Buddy Accuracy'}</div>
                <div className="stat-value">
                  {buddyObj ? (
                    <>
                      {buddyScore.correct}/{buddyScore.total}
                      <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                        ({buddyScore.total > 0 ? Math.round((buddyScore.correct / buddyScore.total) * 100) : 0}%)
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>No Buddy Joined</span>
                  )}
                </div>
              </div>
            </div>

            {/* Invite Notice banner when user is alone in the party */}
            {users.length <= 1 && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                padding: '16px',
                borderRadius: '16px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🎉 Invite Your Buddy!</span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Share your Prediction Party Invite Code with your buddy so they can join and compare predictions!
                </p>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '700',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  letterSpacing: '1px'
                }}
                onClick={() => {
                  navigator.clipboard.writeText(activePartyCode);
                  alert(`Copied Invite Code: ${activePartyCode}`);
                }}
                title="Click to copy invite code"
                >
                  {activePartyCode} <span style={{ fontSize: '0.8rem', marginLeft: '8px', color: '#ffb300' }}>📋 Copy</span>
                </div>
              </div>
            )}

            {/* Conference select filters & search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <span>🏈</span> Select Program to Predict
              </h3>
              <button 
                onClick={() => setShowFocusConfig(!showFocusConfig)}
                className="comp-filter-btn"
                style={{ 
                  padding: '6px 10px', 
                  fontSize: '0.8rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  borderColor: showFocusConfig ? 'var(--color-accent)' : 'var(--border-light)'
                }}
              >
                ⚙️ Focus Settings
              </button>
            </div>

            {showFocusConfig && (
              <div style={{
                background: 'rgba(22, 28, 45, 0.95)',
                border: '1px solid var(--border-light)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: 'var(--shadow-neon)',
                animation: 'scaleUp 0.2s ease-out'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                  CHOOSE CONFERENCES TO FOCUS ON:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {['SEC', 'Big Ten', 'Big 12', 'ACC', 'Group of 5', 'Ind.'].map(conf => {
                    const isChecked = focusedConferences.includes(conf);
                    return (
                      <label 
                        key={conf} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          fontSize: '0.85rem', 
                          cursor: 'pointer',
                          color: isChecked ? 'white' : 'var(--text-secondary)'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            let next;
                            if (isChecked) {
                              if (focusedConferences.length <= 1) return;
                              next = focusedConferences.filter(c => c !== conf);
                            } else {
                              next = [...focusedConferences, conf];
                            }
                            setFocusedConferences(next);
                            if (selectedConf === conf) {
                              setSelectedConf(next[0]);
                            }
                          }}
                        />
                        {conf === 'Ind.' ? 'Independents' : conf}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="comp-controls" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
              <input
                type="text"
                className="setup-input"
                placeholder="🔍 Search programs (e.g. Alabama, Oregon, Boise St)..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                style={{ 
                  margin: 0, 
                  textAlign: 'left', 
                  padding: '10px 14px', 
                  fontSize: '0.9rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'var(--border-light)'
                }}
              />
              
              {!teamSearch && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', width: '100%' }} className="custom-scrollbar">
                  {focusedConferences.map(conf => (
                    <button
                      key={conf}
                      className={`comp-filter-btn ${selectedConf === conf ? 'active' : ''}`}
                      onClick={() => setSelectedConf(conf)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {conf === 'Ind.' ? 'Independents' : conf}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team icon selectors */}
            <div className="teams-flex" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {teams
                .filter(t => {
                  if (teamSearch.trim() !== '') {
                    return t.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
                           t.nickname.toLowerCase().includes(teamSearch.toLowerCase());
                  }
                  return t.conference === selectedConf;
                })
                .map(t => {
                  const record = getProjectedRecord(currentUser.id, t.id);
                  const isActive = t.id === selectedTeamId;
                  
                  return (
                    <div 
                      key={t.id} 
                      className={`team-grid-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedTeamId(t.id)}
                      style={{ 
                        '--team-color': t.colors.primary, 
                        '--team-color-glow': `${t.colors.primary}22`
                      }}
                    >
                      {t.logoUrl ? (
                        <img 
                          src={t.logoUrl} 
                          alt={t.name} 
                          style={{ width: '40px', height: '40px', objectFit: 'contain' }} 
                        />
                      ) : (
                        <span className="team-card-emoji">{t.emoji}</span>
                      )}
                      <span className="team-card-name" style={{ fontSize: '0.8rem' }}>{t.name}</span>
                      <span className="team-card-record">{record.wins}-{record.losses}</span>
                    </div>
                  );
                })}
            </div>

            {/* Team schedule prediction editor */}
            {selectedTeam && (
              <div>
                <div className="schedule-header" style={{ '--team-color': selectedTeam.colors.primary }}>
                  <div className="schedule-header-logo">
                    {selectedTeam.logoUrl ? (
                      <img 
                        src={selectedTeam.logoUrl} 
                        alt={selectedTeam.name} 
                        style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                      />
                    ) : (
                      selectedTeam.emoji
                    )}
                  </div>
                  <div className="schedule-header-info">
                    <h2>{selectedTeam.name} {selectedTeam.nickname}</h2>
                    <p>
                      <span>{selectedTeam.conference} Conference</span>
                      <span>&bull;</span>
                      <span>Projected: {getProjectedRecord(currentUser.id, selectedTeam.id).wins}-{getProjectedRecord(currentUser.id, selectedTeam.id).losses}</span>
                    </p>
                  </div>
                </div>

                <div className="matchups-container">
                  {games
                    .filter(g => g.home === selectedTeam.id || g.away === selectedTeam.id)
                    .map(g => {
                      const isHome = g.home === selectedTeam.id;
                      const opponentId = isHome ? g.away : g.home;
                      const opponentObj = teams.find(t => t.id === opponentId);
                      const opponentName = opponentObj ? opponentObj.name : opponentId;
                      const opponentLogo = isHome ? g.awayLogo : g.homeLogo;
                      
                      const prediction = userPreds[g.id];
                      const isPredictedToWin = prediction === selectedTeam.id;
                      const isPredictedToLose = prediction === opponentId;
                      
                      return (
                        <div key={g.id} className="match-card">
                          <div className="match-top">
                            <span className="match-week">Week {g.week}</span>
                            <span className="match-venue">{g.venue || (g.neutral ? 'Neutral Site' : '')}</span>
                          </div>
                          
                          <div className="match-body">
                            <div className="opponent-row">
                              <span style={{ fontSize: '0.8rem', color: '#64748b', width: '24px' }}>
                                {isHome ? 'VS' : '@'}
                              </span>
                              {opponentLogo ? (
                                <img 
                                  src={opponentLogo} 
                                  alt={opponentName} 
                                  className="match-opponent-logo"
                                  style={{ width: '24px', height: '24px', objectFit: 'contain', marginRight: '6px' }}
                                />
                              ) : opponentObj?.logoUrl ? (
                                <img 
                                  src={opponentObj.logoUrl} 
                                  alt={opponentName} 
                                  className="match-opponent-logo"
                                  style={{ width: '24px', height: '24px', objectFit: 'contain', marginRight: '6px' }}
                                />
                              ) : (
                                <span className="opponent-emoji" style={{ marginRight: '6px' }}>{opponentObj?.emoji || '🏈'}</span>
                              )}
                              <span className="opponent-name">{opponentName}</span>
                              {opponentObj && <span className="opponent-badge">{opponentObj.conference}</span>}
                            </div>
                            
                            <div className="pred-picker-container">
                              <button 
                                className={`pred-btn w-btn ${isPredictedToWin ? 'w-active' : ''}`}
                                onClick={() => togglePrediction(g.id, selectedTeam.id)}
                              >
                                W
                              </button>
                              <button 
                                className={`pred-btn l-btn ${isPredictedToLose ? 'l-active' : ''}`}
                                onClick={() => togglePrediction(g.id, opponentId)}
                              >
                                L
                              </button>
                            </div>
                          </div>

                          {g.winner !== null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                              <span>Actual Result:</span>
                              <span style={{ 
                                color: g.winner === selectedTeam.id ? 'var(--color-win)' : 'var(--color-loss)', 
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {g.winner === selectedTeam.id ? `W (${selectedTeam.name})` : `L (${opponentName})`}
                                {prediction && (prediction === g.winner ? ' ✅ Correct' : ' ❌ Wrong')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compare' && (
          <div>
            <h3 className="section-title">
              <span>👥</span> Bud-to-Bud Predictions Comparison
            </h3>

            {users.length <= 1 ? (
              <div className="comp-card text-center" style={{ padding: '40px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👥</div>
                <h3>No Buddies Found Yet</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px', marginBottom: '16px' }}>
                  Ask your buddy to join your Prediction Party using Invite Code: **{activePartyCode}**!
                </p>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '700',
                  color: 'white',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  navigator.clipboard.writeText(activePartyCode);
                  alert(`Copied Invite Code: ${activePartyCode}`);
                }}
                >
                  {activePartyCode} <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: '#ffb300' }}>📋 Copy</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="comp-controls">
                  <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Compare With</label>
                      <select 
                        value={buddyId} 
                        onChange={(e) => setBuddyId(e.target.value)}
                        className="modern-select"
                      >
                        {users.filter(u => u.id !== currentUser.id).map(u => (
                          <option key={u.id} value={u.id}>👤 {u.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleRefreshPredictions}
                      className="comp-filter-btn"
                      disabled={syncing}
                      style={{ padding: '8px 12px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                      title="Sync predictions with buddy"
                    >
                      {syncing ? '🔄 Syncing...' : '🔃 Refresh'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => setCompFilter('all')}
                        className={`comp-filter-btn ${compFilter === 'all' ? 'active' : ''}`}
                      >
                        All
                      </button>
                      <button 
                        onClick={() => setCompFilter('agreements')}
                        className={`comp-filter-btn ${compFilter === 'agreements' ? 'active' : ''}`}
                      >
                        Agreements
                      </button>
                      <button 
                        onClick={() => setCompFilter('disagreements')}
                        className={`comp-filter-btn ${compFilter === 'disagreements' ? 'active' : ''}`}
                      >
                        Showdowns
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conference selection pills */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px', width: '100%' }} className="custom-scrollbar">
                  <button
                    className={`comp-filter-btn ${compareConfFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setCompareConfFilter('ALL')}
                  >
                    All Focus
                  </button>
                  {focusedConferences.map(conf => (
                    <button
                      key={conf}
                      className={`comp-filter-btn ${compareConfFilter === conf ? 'active' : ''}`}
                      onClick={() => setCompareConfFilter(conf)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {conf === 'Ind.' ? 'Independents' : conf}
                    </button>
                  ))}
                </div>

                <div className="matchups-container">
                  {games
                    .filter(g => {
                      const userPick = userPreds[g.id];
                      const buddyPick = predictions[buddyId]?.[g.id];
                      
                      const homeTeam = teams.find(t => t.id === g.home);
                      const awayTeam = teams.find(t => t.id === g.away);
                      const isHomeConf = homeTeam?.conference === compareConfFilter;
                      const isAwayConf = awayTeam?.conference === compareConfFilter;
                      const belongsToConf = compareConfFilter === 'ALL' || isHomeConf || isAwayConf;
                      if (!belongsToConf) return false;

                      if (compFilter === 'agreements') {
                        return userPick && buddyPick && userPick === buddyPick;
                      }
                      if (compFilter === 'disagreements') {
                        return userPick && buddyPick && userPick !== buddyPick;
                      }
                      // For 'all', only return games where at least one user has made a prediction
                      return userPick || buddyPick;
                    })
                    .map(g => {
                      const homeTeam = teams.find(t => t.id === g.home);
                      const awayTeam = teams.find(t => t.id === g.away);
                      const homeName = homeTeam?.name || g.home;
                      const awayName = awayTeam?.name || g.away;
                      
                      const userPick = userPreds[g.id];
                      const buddyPick = predictions[buddyId]?.[g.id];
                      
                      const isAgree = userPick && buddyPick && userPick === buddyPick;
                      const isDisagree = userPick && buddyPick && userPick !== buddyPick;
                      
                      return (
                        <div key={g.id} className="comp-card">
                          <div className="comp-grid-match">
                            <div>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Week {g.week}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', fontSize: '0.9rem' }}>
                                {(g.awayLogo || awayTeam?.logoUrl) && <img src={g.awayLogo || awayTeam.logoUrl} alt={awayName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
                                <span>{awayName}</span> 
                                <span style={{ color: '#64748b', fontWeight: '400', fontSize: '0.8rem' }}>at</span>
                                {(g.homeLogo || homeTeam?.logoUrl) && <img src={g.homeLogo || homeTeam.logoUrl} alt={homeName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
                                <span>{homeName}</span>
                              </div>
                            </div>
                            
                            {isAgree && <span className="comp-status-badge agree">Agree</span>}
                            {isDisagree && <span className="comp-status-badge disagree">Showdown</span>}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>You Predict:</div>
                              {userPick ? (
                                <div className="comp-pred-indicator win" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600' }}>
                                  {userPick === g.home ? (
                                    <>
                                      {(g.homeLogo || homeTeam?.logoUrl) && <img src={g.homeLogo || homeTeam.logoUrl} alt={homeName} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                                      <span>{homeName}</span>
                                    </>
                                  ) : (
                                    <>
                                      {(g.awayLogo || awayTeam?.logoUrl) && <img src={g.awayLogo || awayTeam.logoUrl} alt={awayName} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                                      <span>{awayName}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="comp-pred-indicator none" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>No Pick</div>
                              )}
                            </div>
                            
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{buddyObj?.name || 'Buddy'} Predicts:</div>
                              {buddyPick ? (
                                <div className="comp-pred-indicator win" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600' }}>
                                  {buddyPick === g.home ? (
                                    <>
                                      {(g.homeLogo || homeTeam?.logoUrl) && <img src={g.homeLogo || homeTeam.logoUrl} alt={homeName} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                                      <span>{homeName}</span>
                                    </>
                                  ) : (
                                    <>
                                      {(g.awayLogo || awayTeam?.logoUrl) && <img src={g.awayLogo || awayTeam.logoUrl} alt={awayName} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                                      <span>{awayName}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="comp-pred-indicator none" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>No Pick</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'standings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <span>📊</span> Projected Standings
              </h3>
              
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }} className="custom-scrollbar">
                <button
                  className={`comp-filter-btn ${standingsConfFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStandingsConfFilter('ALL')}
                >
                  All Focus
                </button>
                {focusedConferences.map(conf => (
                  <button
                    key={conf}
                    className={`comp-filter-btn ${standingsConfFilter === conf ? 'active' : ''}`}
                    onClick={() => setStandingsConfFilter(conf)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {conf === 'Ind.' ? 'Independents' : conf}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '12px 16px' }}>Team</th>
                    <th style={{ padding: '12px 10px' }}>Conf</th>
                    <th style={{ padding: '12px 10px' }}>Your Projection</th>
                    {buddyId && <th style={{ padding: '12px 16px' }}>{buddyObj?.name}'s Projection</th>}
                  </tr>
                </thead>
                <tbody>
                  {teams
                    .filter(t => focusedConferences.includes(t.conference))
                    .filter(t => standingsConfFilter === 'ALL' || t.conference === standingsConfFilter)
                    .map(t => {
                      const userRec = getProjectedRecord(currentUser.id, t.id);
                      const buddyRec = buddyId ? getProjectedRecord(buddyId, t.id) : null;
                      return { team: t, userRec, buddyRec };
                    })
                    .sort((a, b) => {
                      if (b.userRec.wins !== a.userRec.wins) {
                        return b.userRec.wins - a.userRec.wins;
                      }
                      if (a.userRec.losses !== b.userRec.losses) {
                        return a.userRec.losses - b.userRec.losses;
                      }
                      return a.team.name.localeCompare(b.team.name);
                    })
                    .map(({ team: t, userRec, buddyRec }) => {
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {t.logoUrl ? (
                              <img src={t.logoUrl} alt={t.name} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            ) : (
                              <span>{t.emoji}</span>
                            )}
                            <span>{t.name}</span>
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{t.conference}</td>
                          <td style={{ padding: '12px 10px', fontWeight: '600', color: 'var(--color-win)' }}>
                            {userRec.wins} - {userRec.losses}
                          </td>
                          {buddyRec && (
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#3b82f6' }}>
                              {buddyRec.wins} - {buddyRec.losses}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="admin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>
                <span>⚙️</span> Admin Panel: Game Results
              </h3>
              
              <button 
                className="primary-btn"
                onClick={handleSyncESPN}
                disabled={syncing}
                style={{ 
                  width: 'auto', 
                  padding: '8px 16px', 
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
              >
                {syncing ? '🔄 Syncing scores...' : '📡 Sync with ESPN'}
              </button>
            </div>
            
            {syncMessage && (
              <div style={{
                background: syncMessage.includes('Error') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${syncMessage.includes('Error') ? '#ef4444' : '#10b981'}`,
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: syncMessage.includes('Error') ? '#fca5a5' : '#a7f3d0'
              }}>
                {syncMessage}
              </div>
            )}
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Synchronize scores directly from the ESPN scoreboard API, or set winners manually using the controls below as a backup.
            </p>

            {/* Conference selection pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px', width: '100%' }} className="custom-scrollbar">
              <button
                className={`comp-filter-btn ${adminConfFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setAdminConfFilter('ALL')}
              >
                All Focus
              </button>
              {focusedConferences.map(conf => (
                <button
                  key={conf}
                  className={`comp-filter-btn ${adminConfFilter === conf ? 'active' : ''}`}
                  onClick={() => setAdminConfFilter(conf)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {conf === 'Ind.' ? 'Independents' : conf}
                </button>
              ))}
            </div>

            <div className="matchups-container">
              {games
                .filter(g => {
                  const homeTeam = teams.find(t => t.id === g.home);
                  const awayTeam = teams.find(t => t.id === g.away);
                  const isHomeConf = homeTeam?.conference === adminConfFilter;
                  const isAwayConf = awayTeam?.conference === adminConfFilter;
                  return adminConfFilter === 'ALL' || isHomeConf || isAwayConf;
                })
                .map(g => {
                const homeTeam = teams.find(t => t.id === g.home);
                const awayTeam = teams.find(t => t.id === g.away);
                const homeName = homeTeam?.name || g.home;
                const awayName = awayTeam?.name || g.away;
                
                return (
                  <div key={g.id} className="admin-match-row">
                    <div style={{ fontSize: '0.9rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Week {g.week}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginTop: '4px' }}>
                        {(g.awayLogo || awayTeam?.logoUrl) ? <img src={g.awayLogo || awayTeam.logoUrl} alt={awayName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} /> : '🏈'}
                        <span>{awayName}</span>
                        <span style={{ color: '#64748b', fontWeight: '400', fontSize: '0.8rem' }}>at</span>
                        {(g.homeLogo || homeTeam?.logoUrl) ? <img src={g.homeLogo || homeTeam.logoUrl} alt={homeName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} /> : '🏟️'}
                        <span>{homeName}</span>
                      </div>
                    </div>

                    <div className="admin-buttons">
                      <button 
                        className={`admin-btn ${g.winner === g.away ? 'active-winner' : ''}`}
                        onClick={() => handleSetWinner(g.id, g.winner === g.away ? null : g.away)}
                      >
                        Win
                      </button>
                      <button 
                        className={`admin-btn ${g.winner === g.home ? 'active-winner' : ''}`}
                        onClick={() => handleSetWinner(g.id, g.winner === g.home ? null : g.home)}
                      >
                        Win
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Make Picks
        </button>

        <button 
          className={`nav-item ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Bud Comparison
        </button>

        <button 
          className={`nav-item ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          Standings
        </button>

        <button 
          className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Admin
        </button>
      </nav>
    </div>
  );
}
