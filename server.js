import dotenv from 'dotenv';
dotenv.config();

import app from './src/App.js';

const PORT = process.env.PORT || 3000;

console.log(PORT);

// const fn = (core = 0) => {};

app.listen(PORT, () => {
  console.log(`We are on${PORT}`);
});
