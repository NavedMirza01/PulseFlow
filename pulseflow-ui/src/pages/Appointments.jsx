import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentsApi, patientsApi } from '../services/api';
import { 
  Calendar, Clock, UserCheck, ShieldCheck, CheckCircle2, 
  AlertCircle, Stethoscope, PlusCircle, ArrowRight, Lock
} from 'lucide-react';

export default function Appointments() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Patient Mode: 'existing' vs 'new'
  const [patientMode, setPatientMode] = useState('existing');
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // New Patient Form
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState(32);
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newPatientBlood, setNewPatientBlood] = useState('O+');
  const [newPatientAllergies, setNewPatientAllergies] = useState('None');

  // Consultation Details
  const [consultationType, setConsultationType] = useState('OPD');
  const [reason, setReason] = useState('');

  // UI state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [alertInfo, setAlertInfo] = useState(null);

  // Load Initial Doctors and Patients
  useEffect(() => {
    const initData = async () => {
      try {
        const [docsRes, ptsRes, todayRes] = await Promise.all([
          appointmentsApi.getDoctors(),
          patientsApi.search(''),
          appointmentsApi.getToday(),
        ]);
        setDoctors(docsRes.data || []);
        if (docsRes.data?.length > 0) {
          setSelectedDoctorId(docsRes.data[0].staffId.toString());
        }
        setPatients(ptsRes.data || []);
        if (ptsRes.data?.length > 0) {
          setSelectedPatientId(ptsRes.data[0].patientId.toString());
        }
        setTodayAppointments(todayRes.data || []);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initData();
  }, []);

  // Fetch Slots whenever Doctor or Date changes
  const fetchSlots = async () => {
    if (!selectedDoctorId || !appointmentDate) return;
    try {
      setSlotsLoading(true);
      const res = await appointmentsApi.getSlots(selectedDoctorId, appointmentDate);
      setSlots(res.data || []);
      // Reset selected slot if now unavailable
      const currentAvailable = res.data.find(
        (s) => s.slotTime === selectedSlot && s.isAvailable
      );
      if (!currentAvailable) setSelectedSlot('');
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedDoctorId, appointmentDate]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setAlertInfo({ type: 'error', message: 'Please select a doctor.' });
      return;
    }
    if (!selectedSlot) {
      setAlertInfo({ type: 'error', message: 'Please select an available time slot.' });
      return;
    }

    try {
      setBookingLoading(true);
      setAlertInfo(null);

      const payload = {
        doctorId: Number(selectedDoctorId),
        appointmentDate: appointmentDate,
        slotTime: selectedSlot,
        consultationType: consultationType,
        reason: reason || 'Routine OPD Consultation',
      };

      if (patientMode === 'existing') {
        payload.patientId = Number(selectedPatientId);
      } else {
        payload.fullName = newPatientName;
        payload.age = Number(newPatientAge);
        payload.gender = newPatientGender;
        payload.bloodGroup = newPatientBlood;
        payload.knownAllergies = newPatientAllergies;
      }

      const res = await appointmentsApi.book(payload);
      setAlertInfo({
        type: 'success',
        message: `Appointment successfully booked for ${selectedSlot}! Conflict verification passed.`,
      });

      // Refresh slots and today's list
      setSelectedSlot('');
      setReason('');
      await fetchSlots();
      const updatedToday = await appointmentsApi.getToday();
      setTodayAppointments(updatedToday.data || []);
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Failed to book appointment due to slot conflict.';
      setAlertInfo({ type: 'error', message: msg });
    } finally {
      setBookingLoading(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.staffId.toString() === selectedDoctorId);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-7 h-7 text-cyan-400" />
          Zero-Conflict OPD Appointment Booking
        </h1>
        <p className="text-sm text-slate-400">
          Real-time slot reservation system backed by SQL Server unique index guarantees.
        </p>
      </div>

      {/* Alert Banner */}
      {alertInfo && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            alertInfo.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          } animate-fade-in`}
        >
          <div className="flex items-center gap-3">
            {alertInfo.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium text-sm">{alertInfo.message}</span>
          </div>
          <button
            onClick={() => setAlertInfo(null)}
            className="text-xs uppercase font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Doctor & Slot Selector + Patient Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Doctor & Slot Matrix */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-cyan-400" />
              1. Select Doctor & Date
            </h2>
            <span className="text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Double-Booking Block Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Doctor Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Consulting Doctor
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              >
                {doctors.map((doc) => (
                  <option key={doc.staffId} value={doc.staffId}>
                    {doc.fullName} ({doc.department})
                  </option>
                ))}
              </select>
              {selectedDoctor && (
                <p className="text-xs text-cyan-400 mt-1">
                  Department: {selectedDoctor.department} • On Duty
                </p>
              )}
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Appointment Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Time Slot Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                Available Time Slots (Zero-Conflict)
              </label>
              <span className="text-xs text-slate-400">
                {slotsLoading ? 'Updating slots...' : `${slots.filter((s) => s.isAvailable).length} slots available`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot.slotTime;
                return (
                  <button
                    key={slot.slotTime}
                    type="button"
                    disabled={!slot.isAvailable}
                    onClick={() => setSelectedSlot(slot.slotTime)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-between ${
                      !slot.isAvailable
                        ? 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/30 scale-102 border-2 border-cyan-300'
                        : 'bg-slate-800/80 text-slate-200 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-700'
                    }`}
                  >
                    <span>{slot.slotTime}</span>
                    {!slot.isAvailable ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    ) : isSelected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedSlot && (
              <div className="mt-3 p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-800 text-cyan-300 text-xs flex items-center justify-between">
                <span>Selected Time Slot: <strong className="text-white">{selectedSlot}</strong></span>
                <span className="font-semibold text-cyan-400">Reserved for booking</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Patient Details & Booking Form */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              2. Patient Registration & Confirm
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Select existing record or create walk-in patient.</p>
          </div>

          <form onSubmit={handleBookAppointment} className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPatientMode('existing')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  patientMode === 'existing'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Existing Patient
              </button>
              <button
                type="button"
                onClick={() => setPatientMode('new')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  patientMode === 'new'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                + Register New Walk-in
              </button>
            </div>

            {/* Existing Patient Dropdown */}
            {patientMode === 'existing' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                >
                  {patients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.fullName} ({p.uhid}) - Allergies: {p.knownAllergies || 'None'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* New Patient Fields */
              <div className="space-y-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Age</label>
                    <input
                      type="number"
                      required
                      value={newPatientAge}
                      onChange={(e) => setNewPatientAge(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
                    <select
                      value={newPatientGender}
                      onChange={(e) => setNewPatientGender(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Blood</label>
                    <select
                      value={newPatientBlood}
                      onChange={(e) => setNewPatientBlood(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                    >
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="O+">O+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Known Drug Allergies (Critical for Safety)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Aspirin (or None)"
                    value={newPatientAllergies}
                    onChange={(e) => setNewPatientAllergies(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* Consultation Type & Reason */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Type</label>
                <select
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="OPD">General OPD</option>
                  <option value="FollowUp">Follow-Up</option>
                  <option value="Emergency">Emergency Referral</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Chief Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Recurring fever, cough"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={bookingLoading || !selectedSlot}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {bookingLoading ? 'Reserving...' : `Confirm OPD Booking (${selectedSlot || 'Select Slot'})`}
            </button>
          </form>
        </div>
      </div>

      {/* Today's Appointments & Triage Handoff Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Today's Scheduled OPD Appointments & Triage Handoff
            </h2>
            <p className="text-xs text-slate-400">
              Patients scheduled for today. Fast-track check-in directly into the Reception Triage queue.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {todayAppointments.length} Appointments Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Time Slot</th>
                <th className="py-3 px-4">Patient UHID & Name</th>
                <th className="py-3 px-4">Doctor</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Triage Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {todayAppointments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500">
                    No appointments booked yet for today.
                  </td>
                </tr>
              ) : (
                todayAppointments.map((appt) => (
                  <tr key={appt.appointmentId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {appt.slotTime}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{appt.patient?.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {appt.patient?.uhid} • Allergies: {appt.patient?.knownAllergies || 'None'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {appt.doctor?.fullName}
                      <div className="text-[11px] text-slate-400">{appt.doctor?.department}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 max-w-xs truncate">
                      {appt.reason || 'General Consultation'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          appt.status === 'CheckedIn'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {appt.status === 'Booked' ? (
                        <button
                          onClick={() => navigate('/triage')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-semibold text-xs border border-cyan-500/40 transition"
                        >
                          Check In & Triage <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">In ER / Triage</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
