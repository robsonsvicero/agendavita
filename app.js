(function () {
  const config = window.supabaseConfig || {};
  const supabase = window.supabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

  function setStatus(id, message, isError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = 'status' + (isError ? ' error' : ' ok');
  }

  function getWeekday(date) {
    return new Date(`${date}T00:00:00`).getDay();
  }

  function buildSlots(startTime, endTime, slotMinutes, booked) {
    const slots = [];
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let current = sh * 60 + sm;
    const end = eh * 60 + em;

    while (current < end) {
      const hh = String(Math.floor(current / 60)).padStart(2, '0');
      const mm = String(current % 60).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      if (!booked.includes(timeStr)) slots.push(timeStr);
      current += slotMinutes;
    }

    return slots;
  }

  async function loadSlots() {
    const slug = document.getElementById('clinicSlug')?.value?.trim();
    const date = document.getElementById('appointmentDate')?.value;
    const slotsStatus = document.getElementById('slotsStatus');
    const slotsList = document.getElementById('slotsList');

    if (!slug || !date) {
      if (slotsStatus) setStatus('slotsStatus', 'Informe o slug e a data.', true);
      return;
    }

    if (!supabase) {
      setStatus('slotsStatus', 'Configure o Supabase antes de continuar.', true);
      return;
    }

    try {
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('id, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (clinicError) throw clinicError;
      if (!clinicData) throw new Error('Clínica não encontrada');

      const weekday = getWeekday(date);
      const { data: hoursData } = await supabase
        .from('working_hours')
        .select('*')
        .eq('clinic_id', clinicData.id)
        .eq('weekday', weekday);

      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('time')
        .eq('clinic_id', clinicData.id)
        .eq('date', date)
        .neq('status', 'cancelled');

      const booked = (appointmentsData || []).map((item) => item.time);
      const slots = [];
      (hoursData || []).forEach((hour) => {
        slots.push(...buildSlots(hour.start_time, hour.end_time, hour.slot_minutes || 30, booked));
      });

      if (slotsList) {
        slotsList.innerHTML = '';
        if (!slots.length) {
          const li = document.createElement('li');
          li.textContent = 'Nenhum horário disponível para esta data.';
          slotsList.appendChild(li);
        } else {
          slots.forEach((slot) => {
            const li = document.createElement('li');
            li.textContent = slot;
            slotsList.appendChild(li);
          });
        }
      }

      setStatus('slotsStatus', `Horários carregados: ${slots.length}`, false);
    } catch (error) {
      setStatus('slotsStatus', error.message || 'Erro ao buscar horários.', true);
    }
  }

  async function createBooking() {
    const slug = document.getElementById('bookingSlug')?.value?.trim();
    const name = document.getElementById('patientName')?.value;
    const phone = document.getElementById('patientPhone')?.value;
    const email = document.getElementById('patientEmail')?.value;
    const address = document.getElementById('patientAddress')?.value;
    const date = document.getElementById('bookingDate')?.value;
    const time = document.getElementById('bookingTime')?.value;
    const notes = document.getElementById('notes')?.value;

    if (!supabase) {
      setStatus('bookingStatus', 'Configure o Supabase antes de continuar.', true);
      return;
    }

    if (!slug || !name || !phone || !date || !time) {
      setStatus('bookingStatus', 'Preencha nome, telefone, data e horário.', true);
      return;
    }

    try {
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (clinicError) throw clinicError;
      if (!clinicData) throw new Error('Clínica não encontrada');

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .upsert(
          {
            clinic_id: clinicData.id,
            phone,
            name,
            email: email || null,
            address: address || null
          },
          { onConflict: 'clinic_id,phone' }
        )
        .select()
        .maybeSingle();

      if (patientError) throw patientError;

      const { data: existingAppointments, error: countError } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicData.id)
        .eq('patient_id', patientData.id)
        .neq('status', 'cancelled');

      if (countError) throw countError;

      const isFirstVisit = (existingAppointments?.length || 0) === 0;

      const { error: insertError } = await supabase.from('appointments').insert({
        clinic_id: clinicData.id,
        patient_id: patientData.id,
        date,
        time,
        type: 'normal',
        status: 'pending',
        is_first_visit: isFirstVisit,
        notes: notes || ''
      });

      if (insertError) throw insertError;
      setStatus('bookingStatus', 'Agendamento salvo com sucesso.', false);
    } catch (error) {
      setStatus('bookingStatus', error.message || 'Erro ao salvar agendamento.', true);
    }
  }

  async function loginAdmin() {
    const email = document.getElementById('adminEmail')?.value;
    const password = document.getElementById('adminPassword')?.value;
    if (!supabase) {
      setStatus('loginStatus', 'Configure o Supabase antes de continuar.', true);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('dashboardCard').style.display = 'block';
      setStatus('loginStatus', 'Login realizado com sucesso.', false);
      await loadAppointments();
    } catch (error) {
      setStatus('loginStatus', error.message || 'Erro ao fazer login.', true);
    }
  }

  async function loadAppointments() {
    if (!supabase) {
      setStatus('loginStatus', 'Configure o Supabase antes de continuar.', true);
      return;
    }

    try {
      const { data, error } = await supabase.from('appointments').select('*').order('date', { ascending: true }).order('time', { ascending: true });
      if (error) throw error;
      const tbody = document.getElementById('appointmentsBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      (data || []).forEach((appointment) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${appointment.id}</td><td>${appointment.date}</td><td>${appointment.time}</td><td>${appointment.patient_id}</td><td>${appointment.status}</td>`;
        tbody.appendChild(row);
      });
    } catch (error) {
      setStatus('loginStatus', error.message || 'Erro ao carregar agendamentos.', true);
    }
  }

  document.getElementById('loadSlotsBtn')?.addEventListener('click', loadSlots);
  document.getElementById('createBookingBtn')?.addEventListener('click', createBooking);
  document.getElementById('loginBtn')?.addEventListener('click', loginAdmin);
  document.getElementById('loadAppointmentsBtn')?.addEventListener('click', loadAppointments);
})();
