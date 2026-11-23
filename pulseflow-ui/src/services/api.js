import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const commandCenterApi = {
  getKpis: () => api.get('/commandcenter/kpis'),
  getWardsAndBeds: () => api.get('/commandcenter/wards-beds'),
  markBedClean: (bedId) => api.post(`/commandcenter/beds/${bedId}/mark-clean`),
  assignPatientToBed: (bedId, patientId) =>
    api.post(`/commandcenter/beds/${bedId}/assign-patient`, { patientId }),
};

export const appointmentsApi = {
  getDoctors: () => api.get('/appointments/doctors'),
  getSlots: (doctorId, date) =>
    api.get('/appointments/slots', { params: { doctorId, date } }),
  getToday: () => api.get('/appointments/today'),
  book: (payload) => api.post('/appointments/book', payload),
};

export const triageApi = {
  getPendingAppointments: () => api.get('/triage/pending-appointments'),
  calculateLevel: (payload) => api.post('/triage/calculate-level', payload),
  checkInAppointment: (appointmentId, vitals) =>
    api.post(`/triage/check-in-appointment/${appointmentId}`, vitals || {}),
  walkIn: (payload) => api.post('/triage/walk-in', payload),
};

export const doctorApi = {
  getQueue: (doctorId) => api.get('/doctor/queue', { params: { doctorId } }),
  checkAllergy: (payload) => api.post('/doctor/check-allergy', payload),
  completeConsultation: (payload) =>
    api.post('/doctor/consultation-complete', payload),
};

export const patientsApi = {
  search: (query) => api.get('/patients', { params: { query } }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (payload) => api.post('/patients', payload),
};

export default api;
