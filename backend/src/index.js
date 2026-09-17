// Local development entry point — starts a normal long-running server.
// On Vercel, api/index.js exports the same app.js as a serverless
// function instead; app.listen() never runs there.
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ZEWIN Rx Scan backend listening on port ${PORT}`);
});
