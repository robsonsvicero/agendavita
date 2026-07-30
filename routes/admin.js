const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/appointments', async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = `SELECT a.*, p.name as patient_name, p.phone, p.email, p.address
                 FROM appointments a JOIN patients p ON p.id = a.patient_id
                 WHERE a.clinic_id = $1`;
    const params = [req.clinicId];

    if (date) {
      params.push(date);
      query += ` AND a.date = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    query += ' ORDER BY a.date, a.time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

router.patch('/appointments/:id/confirm', async (req, res) => {
  await pool.query(
    `UPDATE appointments SET status = 'confirmed' WHERE id = $1 AND clinic_id = $2`,
    [req.params.id, req.clinicId]
  );
  res.json({ success: true });
});

router.patch('/appointments/:id/cancel', async (req, res) => {
  await pool.query(
    `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND clinic_id = $2`,
    [req.params.id, req.clinicId]
  );
  res.json({ success: true });
});

router.patch('/appointments/:id/reschedule', async (req, res) => {
  const { date, time } = req.body;
  await pool.query(
    `UPDATE appointments SET date = $1, time = $2, status = 'confirmed' WHERE id = $3 AND clinic_id = $4`,
    [date, time, req.params.id, req.clinicId]
  );
  res.json({ success: true });
});

router.get('/patients', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM patients WHERE clinic_id = $1 ORDER BY name',
    [req.clinicId]
  );
  res.json(result.rows);
});

router.put('/patients/:id', async (req, res) => {
  const { name, phone, email, address } = req.body;
  await pool.query(
    `UPDATE patients SET name = $1, phone = $2, email = $3, address = $4
     WHERE id = $5 AND clinic_id = $6`,
    [name, phone, email, address, req.params.id, req.clinicId]
  );
  res.json({ success: true });
});

router.get('/working-hours', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM working_hours WHERE clinic_id = $1',
    [req.clinicId]
  );
  res.json(result.rows);
});

router.post('/working-hours', async (req, res) => {
  const { weekday, start_time, end_time, slot_minutes } = req.body;
  await pool.query(
    `INSERT INTO working_hours (clinic_id, weekday, start_time, end_time, slot_minutes)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.clinicId, weekday, start_time, end_time, slot_minutes || 30]
  );
  res.json({ success: true });
});

module.exports = router;
