const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PetRecovery API'
  });
});

app.listen(PORT, () => {
  console.log(`PetRecovery API running on port ${PORT}`);
});
