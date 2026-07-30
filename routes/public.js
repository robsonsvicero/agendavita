const express = require('express');
const pool = require('../db');
const router = express.Router();

async function getClinicBySlug(slug) {
  const result = await pool.query('SELECT * FROM clinics WHERE slug = $1', [slug]);
  return result.rows[0];
}

async function getAvailableSlots(clinicId, date) {
  const weekday = new Date(date + 'T00:00:00').getDay();

  const hoursResult = await pool.query(
    'SELECT * FROM working_hours WHERE clinic_id = $1 AND weekday = $2',
    [clinicId, weekday]
  );
  if (!hoursResult.rows.length) return [];

  const bookedResult = await pool.query(
    `SELECT time FROM appointments WHERE clinic_id = $1 AND date = $2 AND status != 'cancelled'`,
    [clinicId, date]
  );
  const booked = bookedResult.rows.map((r) => r.time);

  const slots = [];
  for (const h of hoursResult.rows) {
    const [sh, sm] = h.start_time.split(':').map(Number);
    const [eh, em] = h.end_time.split(':').map(Number);
    let start = sh * 60 + sm;
    const end = eh * 60 + em;
    while (start < end) {
      const hh = String(Math.floor(start / 60)).padStart(2, '0');
      const mm = String(start % 60).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      if (!booked.includes(timeStr)) slots.push(timeStr);
      start += h.slot_minutes;
    }
  }
  return slots;
}

async function findOrCreatePatient(clinicId, { name, phone, email, address }) {
  const existing = await pool.query(
    'SELECT * FROM patients WHERE clinic_id = $1 AND phone = $2',
    [clinicId, phone]
  );
  if (existing.rows.length) return existing.rows[0];

  const inserted = await pool.query(
    `INSERT INTO patients (clinic_id, name, phone, email, address)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [clinicId, name, phone, email || '', address || '']
  );
  return inserted.rows[0];
}

router.get('/:slug/slots', async (req, res) => {
  try {
    const clinic = await getClinicBySlug(req.params.slug);
    if (!clinic) return res.status(404).json({ error: 'Clinica nao encontrada' });

    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Informe a data' });

    const slots = await getAvailableSlots(clinic.id, date);
    res.json(slots);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar horarios' });
  }
});

router.post('/:slug/appointments', async (req, res) => {
  try {
    const clinic = await getClinicBySlug(req.params.slug);
    if (!clinic) return res.status(404).json({ error: 'Clinica nao encontrada' });

    const { name, phone, email, address, date, time, notes } = req.body;
    if (!name || !phone || !date || !time) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const slots = await getAvailableSlots(clinic.id, date);
    if (!slots.includes(time)) {
      return res.status(409).json({ error: 'Horario indisponivel' });
    }

    const patient = await findOrCreatePatient(clinic.id, { name, phone, email, address });

    const countResult = await pool.query(
      `SELECT COUNT(*) as c FROM appointments
       WHERE patient_id = $1 AND clinic_id = $2 AND status != 'cancelled'`,
      [patient.id, clinic.id]
    );
    const isFirst = parseInt(countResult.rows[0].c, 10) === 0;

    const inserted = await pool.query(
      `INSERT INTO appointments (clinic_id, patient_id, date, time, type, status, is_first_visit, notes)
       VALUES ($1,$2,$3,$4,'normal','pending',$5,$6) RETURNING id`,
      [clinic.id, patient.id, date, time, isFirst, notes || '']
    );

    if (isFirst) {
      await pool.query('UPDATE patients SET first_visit_date = $1 WHERE id = $2', [date, patient.id]);
    }
    await pool.query('UPDATE patients SET last_visit_date = $1 WHERE id = $2', [date, patient.id]);

    res.json({ success: true, appointmentId: inserted.rows[0].id, isFirstVisit: isFirst });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

router.post('/:slug/encaixe', async (req, res) => {
  try {
    const clinic = await getClinicBySlug(req.params.slug);
    if (!clinic) return res.status(404).json({ error: 'Clinica nao encontrada' });

    const { name, phone, email, address, preferred_date, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Dados incompletos' });

    const patient = await findOrCreatePatient(clinic.id, { name, phone, email, address });

    const inserted = await pool.query(
      `INSERT INTO appointments (clinic_id, patient_id, date, time, type, status, notes)
       VALUES ($1,$2,$3,'--:--','encaixe','pending',$4) RETURNING id`,
      [clinic.id, patient.id, preferred_date || null, notes || '']
    );

    res.json({ success: true, requestId: inserted.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao solicitar encaixe' });
  }
});

router.post('/:slug/appointments/:id/request', async (req, res) => {
  try {
    const clinic = await getClinicBySlug(req.params.slug);
    if (!clinic) return res.status(404).json({ error: 'Clinica nao encontrada' });

    const result = await pool.query(
      `SELECT a.*, p.phone FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1 AND a.clinic_id = $2`,
      [req.params.id, clinic.id]
    );
    const appt = result.rows[0];
    if (!appt) return res.status(404).json({ error: 'Agendamento nao encontrado' });
    if (appt.phone !== req.body.phone) return res.status(403).json({ error: 'Telefone nao confere' });

    const { action, new_date, new_time } = req.body;

    if (action === 'cancel') {
      await pool.query(`UPDATE appointments SET status = 'cancel_requested' WHERE id = $1`, [appt.id]);
    } else if (action === 'reschedule') {
      await pool.query(
        `UPDATE appointments
         SET status = 'reschedule_requested',
             notes = COALESCE(notes, '') || ' | Nova data solicitada: ' || $1 || ' ' || $2
         WHERE id = $3`,
        [new_date, new_time, appt.id]
      );
    } else {
      return res.status(400).json({ error: 'Acao invalida' });
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao processar solicitacao' });
  }
});

module.exports = router;
