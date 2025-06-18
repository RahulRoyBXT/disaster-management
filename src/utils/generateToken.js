import jwt from 'jsonwebtoken';

function generateToken(username) {
  return jwt.sign(
    {
      username,
    },
    process.env.TOKEN_SECRET,
    {
      expiresIn: process.env.TOKEN_EXPIRY,
    }
  );
}

export { generateToken };
