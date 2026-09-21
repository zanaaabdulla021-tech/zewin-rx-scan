// Vercel routes every request here (see vercel.json). The Express app
// itself is a request handler function, so exporting it directly is all
// Vercel's Node runtime needs — no app.listen() involved.
module.exports = require('../src/app');
