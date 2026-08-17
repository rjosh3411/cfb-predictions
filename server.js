import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const DB_FILE = process.env.DATABASE_PATH || path.join(__dirname, 'db.json');
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Helper to read DB
async function readDB() {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/cfb_database_json`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.result) {
          const db = JSON.parse(payload.result);
          db.teams = db.teams || [];
          db.games = db.games || [];
          db.users = db.users || [];
          db.parties = db.parties || [];
          db.predictions = db.predictions || {};
          return db;
        } else {
          console.log("Upstash database empty, seeding from local db.json...");
          const localData = await fs.readFile(DB_FILE, 'utf8');
          const db = JSON.parse(localData);
          db.teams = db.teams || [];
          db.games = db.games || [];
          db.users = db.users || [];
          db.parties = db.parties || [];
          db.predictions = db.predictions || {};
          // Seed the database to Upstash so it's populated on subsequent runs
          await writeDB(db);
          return db;
        }
      } else {
        console.error(`Upstash GET failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.error("Error reading from Upstash Redis:", error);
    }
  }

  // Fallback to local file
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    db.teams = db.teams || [];
    db.games = db.games || [];
    db.users = db.users || [];
    db.parties = db.parties || [];
    db.predictions = db.predictions || {};
    return db;
  } catch (error) {
    console.error("Error reading local db.json:", error);
    return { teams: [], games: [], users: [], parties: [], predictions: {} };
  }
}

// Helper to write DB
async function writeDB(data) {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/set/cfb_database_json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        return;
      } else {
        console.error(`Upstash SET failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.error("Error writing to Upstash Redis:", error);
    }
  }

  // Fallback to local file
  try {
    const dir = path.dirname(DB_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("Error writing local db.json:", error);
    throw error;
  }
}

// Endpoint: get teams and games metadata
app.get('/api/teams', async (req, res) => {
  const db = await readDB();
  res.json(db.teams);
});

app.get('/api/games', async (req, res) => {
  const db = await readDB();
  res.json(db.games);
});

// Endpoint: Register a new user profile
app.post('/api/users/register', async (req, res) => {
  const { username, displayName } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Username is required." });
  }
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: "Display name is required." });
  }
  
  const id = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (id.length < 2) {
    return res.status(400).json({ error: "Username must be at least 2 characters (letters, numbers, underscore)." });
  }
  
  const db = await readDB();
  if (db.users.some(u => u.id === id)) {
    return res.status(400).json({ error: "Username is already taken." });
  }
  
  const user = {
    id,
    name: displayName.trim(),
    parties: [],
    createdAt: new Date().toISOString()
  };
  
  db.users.push(user);
  db.predictions[id] = db.predictions[id] || {};
  await writeDB(db);
  
  res.json({ success: true, user });
});

// Endpoint: Log in to an existing user profile
app.post('/api/users/login', async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Username is required." });
  }
  
  const id = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const db = await readDB();
  
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "User profile not found. Please register first." });
  }
  
  res.json({ success: true, user });
});

// Endpoint: get users in a party
app.get('/api/users', async (req, res) => {
  const { partyCode } = req.query;
  const db = await readDB();
  
  if (partyCode) {
    const code = partyCode.trim().toUpperCase();
    const members = db.users.filter(u => 
      (u.parties && u.parties.includes(code)) || 
      (u.partyCode === code)
    );
    return res.json(members);
  }
  
  res.json(db.users);
});

// Endpoint: Create a new Prediction Party and user context
app.post('/api/parties/create', async (req, res) => {
  const { partyName, userId } = req.body;
  
  if (!partyName || partyName.trim() === "") {
    return res.status(400).json({ error: "Party name is required." });
  }
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }
  
  const db = await readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  
  // Generate random 6-character invite code
  let inviteCode;
  do {
    inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (db.parties.some(p => p.code === inviteCode));
  
  const party = {
    code: inviteCode,
    name: partyName.trim(),
    members: [userId]
  };
  
  db.parties.push(party);
  
  // Add to user's parties list
  user.parties = user.parties || [];
  if (!user.parties.includes(inviteCode)) {
    user.parties.push(inviteCode);
  }
  
  await writeDB(db);
  res.json({ party, user });
});

// Endpoint: Join an existing Prediction Party
app.post('/api/parties/join', async (req, res) => {
  const { partyCode, userId } = req.body;
  
  if (!partyCode || partyCode.trim() === "") {
    return res.status(400).json({ error: "Party Invite Code is required." });
  }
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }
  
  const code = partyCode.trim().toUpperCase();
  const db = await readDB();
  
  const party = db.parties.find(p => p.code === code);
  if (!party) {
    return res.status(404).json({ error: "Prediction Party not found. Check the invite code." });
  }
  
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  
  // Add to party members
  party.members = party.members || [];
  if (!party.members.includes(userId)) {
    party.members.push(userId);
  }
  
  // Add to user's parties
  user.parties = user.parties || [];
  if (!user.parties.includes(code)) {
    user.parties.push(code);
  }
  
  await writeDB(db);
  res.json({ party, user });
});

// Endpoint: get predictions (can filter by partyCode)
app.get('/api/predictions', async (req, res) => {
  const { partyCode } = req.query;
  const db = await readDB();
  
  if (partyCode) {
    const code = partyCode.trim().toUpperCase();
    const party = db.parties.find(p => p.code === code);
    const legacyUsers = db.users.filter(u => u.partyCode === code).map(u => u.id);
    
    const partyUsers = party ? (party.members || []) : [];
    const allUsers = Array.from(new Set([...partyUsers, ...legacyUsers]));
    
    const filteredPredictions = {};
    allUsers.forEach(uid => {
      filteredPredictions[uid] = db.predictions[uid] || {};
    });
    return res.json(filteredPredictions);
  }
  
  res.json(db.predictions);
});

app.get('/api/predictions/:userId', async (req, res) => {
  const { userId } = req.params;
  const db = await readDB();
  res.json(db.predictions[userId] || {});
});

// Endpoint: save/update predictions for a specific user
app.post('/api/predictions/:userId', async (req, res) => {
  const { userId } = req.params;
  const { predictions } = req.body;
  
  if (!predictions) {
    return res.status(400).json({ error: "Predictions data is required." });
  }
  
  const db = await readDB();
  
  // Verify user exists
  const userExists = db.users.some(u => u.id === userId);
  if (!userExists) {
    return res.status(404).json({ error: "User not found." });
  }
  
  db.predictions[userId] = {
    ...(db.predictions[userId] || {}),
    ...predictions
  };
  
  await writeDB(db);
  res.json({ success: true, predictions: db.predictions[userId] });
});

// Endpoint: Fetch scores/winners from ESPN score API
app.post('/api/games/sync', async (req, res) => {
  const { week } = req.query; // If specified, sync just one week. Otherwise loops weeks 1-14.
  const db = await readDB();
  let updatedCount = 0;
  
  // Define weeks list to sync
  const weeksToSync = week ? [parseInt(week, 10)] : Array.from({ length: 14 }, (_, i) => i + 1);
  
  try {
    for (const w of weeksToSync) {
      console.log(`Syncing week ${w} scores from ESPN API...`);
      // NCAA division 1 FBS subdivision (group 80) scoreboard api
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&week=${w}`;
      
      const response = await fetch(espnUrl);
      if (!response.ok) {
        console.warn(`ESPN scoreboard returned error for week ${w}`);
        continue;
      }
      
      const data = await response.json();
      const events = data.events || [];
      
      events.forEach(event => {
        const completed = event.status?.type?.completed;
        const detail = event.status?.type?.detail || '';
        
        // Skip games that aren't finished
        if (!completed || !detail.includes('Final')) return;
        
        const competitors = event.competitions?.[0]?.competitors || [];
        const homeCompetitor = competitors.find(c => c.homeAway === 'home');
        const awayCompetitor = competitors.find(c => c.homeAway === 'away');
        if (!homeCompetitor || !awayCompetitor) return;
        
        const homeEspnId = homeCompetitor.team?.id;
        const awayEspnId = awayCompetitor.team?.id;
        
        const homeScore = parseInt(homeCompetitor.score, 10);
        const awayScore = parseInt(awayCompetitor.score, 10);
        
        let winnerEspnId = null;
        if (homeScore > awayScore) {
          winnerEspnId = homeEspnId;
        } else if (awayScore > homeScore) {
          winnerEspnId = awayEspnId;
        }
        
        if (!winnerEspnId) return; // Tie game (none in CFB regular season) or pending
        
        // Match home or away in our database
        const trackedHome = db.teams.find(t => t.espnId === homeEspnId);
        const trackedAway = db.teams.find(t => t.espnId === awayEspnId);
        
        if (!trackedHome && !trackedAway) return; // Neither team is tracked in our system
        
        const matchedGame = db.games.find(g => {
          if (g.week !== w) return false;
          
          if (trackedHome && trackedAway) {
            return (g.home === trackedHome.id && g.away === trackedAway.id) ||
                   (g.home === trackedAway.id && g.away === trackedHome.id);
          }
          if (trackedHome) {
            return g.home === trackedHome.id || g.away === trackedHome.id;
          }
          if (trackedAway) {
            return g.home === trackedAway.id || g.away === trackedAway.id;
          }
          return false;
        });
        
        if (matchedGame && matchedGame.winner === null) {
          const winnerTeamObj = db.teams.find(t => t.espnId === winnerEspnId);
          if (winnerTeamObj) {
            matchedGame.winner = winnerTeamObj.id;
            updatedCount++;
          } else {
            // Opponent won (e.g. untracked opponent like WKU vs Alabama)
            // If the tracked team matches the home team, then the winner is the away team, and vice versa
            if (trackedHome) {
              matchedGame.winner = (matchedGame.home === trackedHome.id) ? matchedGame.away : matchedGame.home;
            } else if (trackedAway) {
              matchedGame.winner = (matchedGame.home === trackedAway.id) ? matchedGame.away : matchedGame.home;
            }
            updatedCount++;
          }
        }
      });
    }
    
    if (updatedCount > 0) {
      await writeDB(db);
    }
    
    res.json({ success: true, updatedGames: updatedCount });
  } catch (err) {
    console.error("Error syncing results from ESPN API:", err);
    res.status(500).json({ error: "Failed to connect to score provider." });
  }
});

// Endpoint: admin sets game winner manually (as fallback)
app.post('/api/admin/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { winner } = req.body;
  
  const db = await readDB();
  const gameIndex = db.games.findIndex(g => g.id === gameId);
  
  if (gameIndex === -1) {
    return res.status(404).json({ error: "Game not found." });
  }
  
  db.games[gameIndex].winner = winner || null;
  await writeDB(db);
  
  res.json({ success: true, game: db.games[gameIndex] });
});

// Endpoint: Delete a whole party, its members, and their predictions
app.delete('/api/parties/:partyCode', async (req, res) => {
  const { partyCode } = req.params;
  
  if (!partyCode) {
    return res.status(400).json({ error: "Party Invite Code is required." });
  }
  
  const code = partyCode.trim().toUpperCase();
  const db = await readDB();
  
  const partyIndex = db.parties.findIndex(p => p.code === code);
  if (partyIndex === -1) {
    return res.status(404).json({ error: "Prediction Party not found." });
  }
  
  // Find all users belonging to this party
  const partyUsers = db.users.filter(u => u.partyCode === code).map(u => u.id);
  
  // Remove users
  db.users = db.users.filter(u => u.partyCode !== code);
  
  // Remove predictions for those users
  partyUsers.forEach(uid => {
    delete db.predictions[uid];
  });
  
  // Remove party
  db.parties.splice(partyIndex, 1);
  
  await writeDB(db);
  
  res.json({ success: true, message: `Party ${code} has been successfully deleted.` });
});

// Serve frontend build in production
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: "API endpoint not found." });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Function: Automatically fetch scores/winners from ESPN score API in the background
async function autoSyncScores() {
  console.log("Starting background automatic scores sync with ESPN...");
  try {
    const db = await readDB();
    let updatedCount = 0;
    
    // NCAA division 1 FBS subdivision (group 80) scoreboard api
    for (let w = 1; w <= 13; w++) {
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&week=${w}`;
      const response = await fetch(espnUrl);
      if (!response.ok) continue;
      
      const data = await response.json();
      const events = data.events || [];
      
      events.forEach(event => {
        const completed = event.status?.type?.completed;
        const detail = event.status?.type?.detail || '';
        
        // Skip games that aren't finished
        if (!completed || !detail.includes('Final')) return;
        
        const competitors = event.competitions?.[0]?.competitors || [];
        const homeCompetitor = competitors.find(c => c.homeAway === 'home');
        const awayCompetitor = competitors.find(c => c.homeAway === 'away');
        if (!homeCompetitor || !awayCompetitor) return;
        
        const homeEspnId = homeCompetitor.team?.id;
        const awayEspnId = awayCompetitor.team?.id;
        
        const homeScore = parseInt(homeCompetitor.score, 10);
        const awayScore = parseInt(awayCompetitor.score, 10);
        
        let winnerEspnId = null;
        if (homeScore > awayScore) {
          winnerEspnId = homeEspnId;
        } else if (awayScore > homeScore) {
          winnerEspnId = awayEspnId;
        }
        
        if (!winnerEspnId) return;
        
        // Match home or away in our database
        const trackedHome = db.teams.find(t => t.espnId === homeEspnId);
        const trackedAway = db.teams.find(t => t.espnId === awayEspnId);
        
        if (!trackedHome && !trackedAway) return;
        
        const matchedGame = db.games.find(g => {
          if (g.week !== w) return false;
          
          if (trackedHome && trackedAway) {
            return (g.home === trackedHome.id && g.away === trackedAway.id) ||
                   (g.home === trackedAway.id && g.away === trackedHome.id);
          }
          if (trackedHome) {
            return g.home === trackedHome.id || g.away === trackedHome.id;
          }
          if (trackedAway) {
            return g.home === trackedAway.id || g.away === trackedAway.id;
          }
          return false;
        });
        
        if (matchedGame && matchedGame.winner === null) {
          const winnerTeamObj = db.teams.find(t => t.espnId === winnerEspnId);
          if (winnerTeamObj) {
            matchedGame.winner = winnerTeamObj.id;
            updatedCount++;
          } else {
            if (trackedHome) {
              matchedGame.winner = (matchedGame.home === trackedHome.id) ? matchedGame.away : matchedGame.home;
            } else if (trackedAway) {
              matchedGame.winner = (matchedGame.home === trackedAway.id) ? matchedGame.away : matchedGame.home;
            }
            updatedCount++;
          }
        }
      });
    }
    
    if (updatedCount > 0) {
      await writeDB(db);
      console.log(`Automatic score sync complete: updated ${updatedCount} outcomes!`);
    } else {
      console.log("Automatic score sync complete: no new game outcomes to update.");
    }
  } catch (err) {
    console.error("Failed executing automatic background score sync:", err);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  
  // Start background automatic sync
  autoSyncScores();
  setInterval(autoSyncScores, 6 * 60 * 60 * 1000); // Sync scores every 6 hours
});
