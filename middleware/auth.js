require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'troque-esta-chave-em-producao';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token nao fornecido' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.clinicId = payload.clinicId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
