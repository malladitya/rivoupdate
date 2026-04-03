const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory

const reports = { noise: [], crowds: [], construction: [] };

app.get('/api/reports', (req, res) => res.json(reports));

app.post('/api/reports/noise', (req, res) => {
  const report = { ...req.body, timestamp: Date.now(), id: Date.now() };
  reports.noise.push(report);
  res.json(report);
});

app.post('/api/reports/crowd', (req, res) => {
  const report = { ...req.body, timestamp: Date.now(), id: Date.now() };
  reports.crowds.push(report);
  res.json(report);
});

app.post('/api/reports/construction', (req, res) => {
  const report = { ...req.body, timestamp: Date.now(), id: Date.now() };
  reports.construction.push(report);
  res.json(report);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
