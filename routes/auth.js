const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, slug, email, password, specialty } = req.body;
  if (!name || !slug || !email || !password) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO clinics (name, slug, email, password_hash, specialty)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, slug, email, hash, specialty || '']
    );
    res.json({ success: true, clinicId: result.rows[0].id });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(400).json({ error: 'Slug ou email ja cadastrado' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erro ao cadastrar clinica' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM clinics WHERE email = $1', [email]);
    const clinic = result.rows[0];
    if (!clinic) return res.status(401).json({ error: 'Credenciais invalidas' });

    const ok = await bcrypt.compare(password, clinic.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais invalidas' });

    const token = jwt.sign({ clinicId: clinic.id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, clinicName: clinic.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

module.exports = router;
