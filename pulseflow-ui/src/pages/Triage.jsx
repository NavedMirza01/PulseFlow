import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { triageApi, appointmentsApi, patientsApi } from '../services/api';
import { 
  ShieldAlert, Activity, Heart, Thermometer, UserPlus, 
  CheckCircle2, AlertTriangle, ArrowRight, Zap, RefreshCw, Stethoscope
} from 'lucide-react';

export default function Triage() {
  const navigate = useNavigate();

  const [pendingAppts, setPendingAppts] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Form state
  const [patientMode, setPatientMode] = useState('existing');
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // New Patient fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState(45);
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [knownAllergies, setKnownAllergies] = useState('None');

  // Vitals & Complaint
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [heartRate, setHeartRate] = useState(82);
  const [bp, setBp] = useState('120/80');
  const [spO2, setSpO2] = useState(98);

  // Live Triage evaluation
  const [triageEvaluation, setTriageEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);

  // Load Initial Data
  const loadInitial = async () => {
    try {
      setLoadingPending(true);
      const [pendingRes, patientsRes, docsRes] = await Promise.all([
        triageApi.getPendingAppointments(),
        patientsApi.search(''),
        appointmentsApi.getDoctors(),
      ]);
      setPendingAppts(pendingRes.data || []);
      setPatients(patientsRes.data || []);
      if (patientsRes.data?.length > 0) {
        setSelectedPatientId(patientsRes.data[0].patientId.toString());
      }
      setDoctors(docsRes.data || []);
      if (docsRes.data?.length > 0) {
        setSelectedDoctorId(docsRes.data[0].staffId.toString());
      }
    } catch (err) {
      console.error('Failed to load triage prerequisites:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  // Live Auto-Calculate Triage Score when Vitals change
  useEffect(() => {
    const calculate = async () => {
      try {
        setEvaluating(true);
        const res = await triageApi.calculateLevel({
          spO2: Number(spO2),
          heartRate: Number(heartRate),
          bp: bp,
          chiefComplaint: chiefComplaint,
        });
        setTriageEvaluation(res.data);
      } catch (err) {
        console.error('Triage calculation error:', err);
      } finally {
        setEvaluating(false);
      }
    };

    const debounce = setTimeout(calculate, 250);
    return () => clearTimeout(debounce);
  }, [spO2, heartRate, bp, chiefComplaint]);

  // One-click Check In from Appointment
  const handleCheckInAppt = async (appt) => {
    try {
      const res = await triageApi.checkInAppointment(appt.appointmentId, {
        spO2: 98,
        heartRate: 78,
        bp: '120/80',
        chiefComplaint: appt.reason || 'OPD Scheduled Consultation',
      });
      setSuccessBanner({
        message: `Patient ${appt.patient?.fullName} checked in successfully with Triage Level ${res.data.triageEvaluation?.triageLevel} (${res.data.triageEvaluation?.triageCategory})! Queued for ${appt.doctor?.fullName}.`,
        visitId: res.data.visit?.visitId,
      });
      await loadInitial();
    } catch (err) {
      alert('Failed to check in appointment.');
    }
  };

  // Submit Walk-in / ER Triage
  const handleSubmitTriage = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setSuccessBanner(null);

      const payload = {
        assignedDoctorId: selectedDoctorId ? Number(selectedDoctorId) : null,
        chiefComplaint: chiefComplaint || 'Emergency Triage Evaluation',
        heartRate: Number(heartRate),
        bp: bp || '120/80',
        spO2: Number(spO2),
      };

      if (patientMode === 'existing') {
        payload.patientId = Number(selectedPatientId);
      } else {
        payload.fullName = fullName;
        payload.age = Number(age);
        payload.gender = gender;
        payload.bloodGroup = bloodGroup;
        payload.knownAllergies = knownAllergies;
      }

      const res = await triageApi.walkIn(payload);
      setSuccessBanner({
        message: `Triage evaluation completed! Assigned Level ${res.data.triageEvaluation?.triageLevel} (${res.data.triageEvaluation?.triageCategory}). Patient queued in Doctor ER Queue.`,
        visitId: res.data.visit?.visitId,
      });

      // Reset form
      setChiefComplaint('');
      setSpO2(98);
      setHeartRate(80);
      setBp('120/80');
      await loadInitial();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit triage visit.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick complaint chips
  const quickComplaints = [
    'Severe chest tightness & sweating',
    'High fever (103°F) & dizziness',
    'Acute shortness of breath / wheezing',
    'Head injury with laceration & bleeding',
    'Abdominal pain & vomiting',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-cyan-400" />
            Reception Triage & Emergency Check-In
          </h1>
          <p className="text-sm text-slate-400">
            One-click OPD check-in & automated vital-sign triage severity classification (Levels 1 to 5).
          </p>
        </div>
        <button
          onClick={loadInitial}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingPending ? 'animate-spin text-cyan-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold">{successBanner.message}</span>
          </div>
          <button
            onClick={() => navigate('/doctor')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
          >
            Open Doctor Queue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section 1: One-Click Check In from Today's Booked OPD Appointments */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              1. Fast-Track Check-In for Today's Booked OPD Patients
            </h2>
            <p className="text-xs text-slate-400">
              One-click arrival check-in transfers booked appointments directly into the active ER/OPD triage pipeline.
            </p>
          </div>
          <span className="text-xs font-mono bg-cyan-950/80 text-cyan-400 px-3 py-1 rounded-full border border-cyan-800">
            {pendingAppts.length} Waiting for Arrival
          </span>
        </div>

        {pendingAppts.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            All scheduled appointments for today have been checked in or no bookings pending.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {pendingAppts.map((appt) => (
              <div
                key={appt.appointmentId}
                className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-cyan-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-cyan-400 font-bold text-xs bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800">
                      {appt.slotTime}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{appt.patient?.uhid}</span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">{appt.patient?.fullName}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Doctor: <span className="text-slate-300 font-medium">{appt.doctor?.fullName}</span>
                  </p>
                  <p className="text-xs text-slate-400 italic mt-0.5">
                    "{appt.reason || 'OPD Check'}"
                  </p>
                  <div className="mt-2 text-[11px] text-amber-400/90 font-medium">
                    Allergies: {appt.patient?.knownAllergies || 'None'}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <button
                    onClick={() => handleCheckInAppt(appt)}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    1-Click Check In Patient
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Walk-In / ER Triage Form & Live Auto-Severity Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              2. Emergency & Walk-in Vitals Entry
            </h2>
            <p className="text-xs text-slate-400">
              Input physiological vitals to calculate real-time emergency triage level.
            </p>
          </div>

          <form onSubmit={handleSubmitTriage} className="space-y-4">
            {/* Patient Mode */}
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
                + Walk-In Registration
              </button>
            </div>

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
              <div className="space-y-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Patient Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Age</label>
                    <input
                      type="number"
                      required
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Blood</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    >
                      <option value="O+">O+</option>
                      <option value="B+">B+</option>
                      <option value="A+">A+</option>
                      <option value="AB+">AB+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Known Allergies</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Aspirin"
                    value={knownAllergies}
                    onChange={(e) => setKnownAllergies(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {/* Doctor Assignment */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assign Consulting Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              >
                {doctors.map((d) => (
                  <option key={d.staffId} value={d.staffId}>
                    {d.fullName} ({d.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Chief Complaint & Quick Chips */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Chief Complaint</label>
              <input
                type="text"
                required
                placeholder="Describe presenting symptoms..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickComplaints.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChiefComplaint(c)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    + {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Vitals Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  SpO2 Level (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="60"
                    max="100"
                    value={spO2}
                    onChange={(e) => setSpO2(e.target.value)}
                    className={`w-full p-2 rounded-lg text-sm font-bold text-center border ${
                      spO2 < 90
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                        : spO2 <= 94
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-emerald-400'
                    }`}
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <span className="text-[10px] text-slate-400">Critical: &lt;90%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Heart Rate (bpm)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="30"
                    max="220"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className={`w-full p-2 rounded-lg text-sm font-bold text-center border ${
                      heartRate > 130 || heartRate < 45
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                        : heartRate > 105
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-cyan-400'
                    }`}
                  />
                  <span className="text-xs text-slate-400">bpm</span>
                </div>
                <span className="text-[10px] text-slate-400">Normal: 60-100</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Blood Pressure
                </label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-center font-bold text-white"
                />
                <span className="text-[10px] text-slate-400">e.g. 165/100</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition shadow-lg flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-5 h-5" />
              {submitting ? 'Submitting Triage...' : 'Confirm Vitals & Dispatch to Doctor Queue'}
            </button>
          </form>
        </div>

        {/* Live Triage Score Panel (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Live Triage Severity Classification
              </h3>
              {evaluating && <span className="text-xs text-cyan-400 animate-pulse">Calculating...</span>}
            </div>

            {triageEvaluation && (
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  triageEvaluation.triageLevel === 1
                    ? 'bg-rose-950/40 border-rose-500 shadow-xl shadow-rose-950/50'
                    : triageEvaluation.triageLevel === 2
                    ? 'bg-orange-950/40 border-orange-500'
                    : triageEvaluation.triageLevel === 3
                    ? 'bg-amber-950/40 border-amber-500'
                    : triageEvaluation.triageLevel === 4
                    ? 'bg-emerald-950/40 border-emerald-500'
                    : 'bg-blue-950/40 border-blue-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase font-bold tracking-wider opacity-80">
                    Emergency Severity Score
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      triageEvaluation.triageLevel === 1
                        ? 'bg-rose-500 text-white animate-pulse'
                        : triageEvaluation.triageLevel === 2
                        ? 'bg-orange-500 text-slate-950'
                        : triageEvaluation.triageLevel === 3
                        ? 'bg-amber-500 text-slate-950'
                        : triageEvaluation.triageLevel === 4
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    Level {triageEvaluation.triageLevel}
                  </span>
                </div>

                <div className="text-2xl font-black tracking-tight text-white mb-2">
                  {triageEvaluation.triageCategory}
                </div>

                {/* Response SLA Guidelines */}
                <p className="text-xs text-slate-300 font-medium mb-4">
                  {triageEvaluation.triageLevel === 1 && '⚠️ Immediate Life Threat (SLA: 0 mins - Direct Resuscitation Bed)'}
                  {triageEvaluation.triageLevel === 2 && '⚡ High Risk / Emergent (SLA: <15 mins - Rapid Medical Assessment)'}
                  {triageEvaluation.triageLevel === 3 && '🕒 Urgent Condition (SLA: <30-60 mins - Vital Signs Stable)'}
                  {triageEvaluation.triageLevel === 4 && '🩺 Less Urgent (SLA: <120 mins - Routine Examination)'}
                  {triageEvaluation.triageLevel === 5 && '📋 Non-Urgent (SLA: Routine OPD Queue)'}
                </p>

                {/* Trigger explanation */}
                <div className="space-y-1.5 pt-3 border-t border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Diagnostic Triggers Detected:
                  </span>
                  {triageEvaluation.triggers?.map((t, idx) => (
                    <div key={idx} className="text-xs text-slate-200 flex items-start gap-1.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Guide */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs space-y-2 text-slate-400">
              <span className="font-semibold text-slate-300 block">International ESI Triage Standard:</span>
              <div className="grid grid-cols-5 gap-1 text-[11px] text-center font-bold">
                <div className="p-1.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">L1 Critical</div>
                <div className="p-1.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">L2 Emergent</div>
                <div className="p-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">L3 Urgent</div>
                <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">L4 Less</div>
                <div className="p-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">L5 Routine</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
