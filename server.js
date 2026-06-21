const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers for convenience/safety
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Proxy GET /api/master-data
app.get('/api/master-data', async (req, res) => {
  try {
    const response = await fetch('https://index-api.tpso.go.th/OpenApi/K/Month/MasterData');
    if (!response.ok) {
      throw new Error(`TPSO MasterData responded with status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({ error: 'Failed to fetch master data from TPSO API' });
  }
});

// Proxy POST /api/month
app.post('/api/month', async (req, res) => {
  try {
    const response = await fetch('https://index-api.tpso.go.th/OpenApi/K/Month', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    if (!response.ok) {
      throw new Error(`TPSO Month responded with status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    res.status(500).json({ error: 'Failed to fetch monthly data from TPSO API' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
