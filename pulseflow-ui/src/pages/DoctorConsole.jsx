import React, { useState, useEffect } from 'react';
import { doctorApi, commandCenterApi, appointmentsApi } from '../services/api';
import { 
  Stethoscope, AlertOctagon, AlertTriangle, CheckCircle2, 
  BedDouble, Clock, Sparkles, Heart, Activity, FileText, X, ArrowRight
} from 'lucide-react';

export default function DoctorConsole() {
  const [queue, setQueue] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Consultation Modal state
  const [activeVisit, setActiveVisit] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState('');
  const [allergyOverrideNote, setAllergyOverrideNote] = useState('');
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [dispositionAction, setDispositionAction] = useState('Discharge'); // Discharge or Admit
  const [availableBeds, setAvailableBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState('');

  // Live Allergy check state
  const [allergyConflict, setAllergyConflict] = useState(null);
  const [checkingAllergy, setCheckingAllergy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turnoverSuccess, setTurnoverSuccess] = useState(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const [queueRes, docsRes, wardsRes] = await Promise.all([
        doctorApi.getQueue(selectedDoctorId ? Number(selectedDoctorId) : null),
        appointmentsApi.getDoctors(),
        commandCenterApi.getWardsAndBeds(),
      ]);
      setQueue(queueRes.data || []);
      setDoctors(docsRes.data || []);

      const avBeds = wardsRes.data
        .flatMap((w) => w.beds)
        .filter((b) => b.status === 'Available');
      setAvailableBeds(avBeds);
      if (avBeds.length > 0) setSelectedBedId(avBeds[0].bedId.toString());
    } catch (err) {
      console.error('Failed to load doctor queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 8000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  // Real-time allergy check whenever prescribedMeds or activeVisit changes
  useEffect(() => {
    if (!activeVisit || !prescribedMeds.trim()) {
      setAllergyConflict(null);
      return;
    }

    const check = async () => {
      try {
        setCheckingAllergy(true);
        const res = await doctorApi.checkAllergy({
          patientId: activeVisit.patientId,
          prescribedMeds: prescribedMeds,
        });
        setAllergyConflict(res.data.hasConflict ? res.data : null);
      } catch (err) {
        console.error('Allergy check error:', err);
      } finally {
        setCheckingAllergy(false);
      }
    };

    const timer = setTimeout(check, 300);
    return () => clearTimeout(timer);
  }, [prescribedMeds, activeVisit]);

  const openConsultation = (visit) => {
    setActiveVisit(visit);
    setDiagnosis(visit.chiefComplaint || '');
    setPrescribedMeds('');
    setAllergyOverrideNote('');
    setDischargeSummary(`Patient discharged in stable condition. Advised rest and medication compliance.`);
    setDispositionAction('Discharge');
    setAllergyConflict(null);
  };

  const handleCompleteConsultation = async (e) => {
    e.preventDefault();
    if (!activeVisit) return;

    if (allergyConflict?.hasConflict && !allergyOverrideNote.trim()) {
      alert('CRITICAL SAFETY BLOCK: Known patient allergy detected! You must provide an Allergy Override Note or change the prescribed medications before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await doctorApi.completeConsultation({
        visitId: activeVisit.visitId,
        diagnosis,
        prescribedMeds,
        allergyOverrideNote: allergyOverrideNote || null,
        dischargeSummary,
        action: dispositionAction,
        assignBedId: dispositionAction === 'Admit' ? Number(selectedBedId) : null,
      });

      setTurnoverSuccess({
        message: res.data.message,
        bedFlipped: res.data.bedTurnoverTriggered,
        bedInfo: res.data.flippedBed,
      });

      setActiveVisit(null);
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete consultation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick medication chips
  const medChips = [
    { label: 'Amoxicillin 500mg', triggers: 'Penicillin' },
    { label: 'Aspirin 75mg', triggers: 'Aspirin' },
    { label: 'Ibuprofen 400mg', triggers: 'Ibuprofen/NSAID' },
    { label: 'Paracetamol 650mg', triggers: 'None' },
    { label: 'Pantoprazole 40mg', triggers: 'None' },
    { label: 'Azithromycin 500mg', triggers: 'None' },
    { label: 'Ceftriaxone 1g IV', triggers: 'Cephalosporin' },
  ];

  const addMed = (medLabel) => {
    setPrescribedMeds((prev) => (prev ? `${prev}, ${medLabel}` : medLabel));
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-cyan-400" />
            Doctor Clinical Console & ER Queue
          </h1>
          <p className="text-sm text-slate-400">
            Priority-sorted ER emergency queue with real-time allergy cross-checking & automated bed-turnover discharge.
          </p>
        </div>

        {/* Doctor selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-cyan-500"
          >
            <option value="">All Attending Doctors (Full Hospital Queue)</option>
            {doctors.map((d) => (
              <option key={d.staffId} value={d.staffId}>
                {d.fullName} ({d.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Turnover Success Banner */}
      {turnoverSuccess && (
        <div className="p-4 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-cyan-400 shrink-0 animate-spin" />
            <div>
              <div className="font-bold text-sm text-white">{turnoverSuccess.message}</div>
              {turnoverSuccess.bedFlipped && (
                <div className="text-xs text-cyan-400 mt-0.5">
                  Automated Bed-Turnover Command Center event emitted: Bed {turnoverSuccess.bedInfo?.bedCode} is now in Cleaning status!
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setTurnoverSuccess(null)}
            className="text-xs font-semibold uppercase opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ER Queue List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-400" />
              Active ER Triage Priority Queue (Severity Sorted)
            </h2>
            <p className="text-xs text-slate-400">
              Patients prioritized strictly by emergency vital-signs severity (Level 1 first).
            </p>
          </div>
          <span className="text-xs font-mono bg-rose-950/80 text-rose-400 px-3 py-1 rounded-full border border-rose-800 font-bold">
            {queue.length} In Waiting Queue
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto mb-2" />
            <p className="font-medium">No patients currently waiting in the ER queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((visit) => {
              const isLevel1 = visit.triageLevel === 1;
              const isLevel2 = visit.triageLevel === 2;
              const isLevel3 = visit.triageLevel === 3;

              const hasKnownAllergies =
                visit.patient?.knownAllergies &&
                visit.patient.knownAllergies.toLowerCase() !== 'none';

              return (
                <div
                  key={visit.visitId}
                  className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isLevel1
                      ? 'bg-rose-950/30 border-rose-500 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/50'
                      : isLevel2
                      ? 'bg-orange-950/20 border-orange-500/50'
                      : isLevel3
                      ? 'bg-amber-950/10 border-amber-500/40'
                      : 'bg-slate-800/60 border-slate-700'
                  }`}
                >
                  {/* Left: Triage Level & Patient Info */}
                  <div className="flex items-start gap-4">
                    {/* Severity Pill */}
                    <div
                      className={`px-3 py-2 rounded-xl text-center shrink-0 border ${
                        isLevel1
                          ? 'bg-rose-600 text-white border-rose-400 animate-pulse font-black'
                          : isLevel2
                          ? 'bg-orange-500 text-slate-950 border-orange-300 font-bold'
                          : isLevel3
                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                          : 'bg-emerald-600 text-white border-emerald-400 font-bold'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider">Level</div>
                      <div className="text-xl leading-none">{visit.triageLevel}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {visit.patient?.fullName}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {visit.patient?.uhid}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({visit.patient?.gender}, {visit.patient?.age}y • Blood: {visit.patient?.bloodGroup})
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 font-medium">
                        Chief Complaint: <span className="text-cyan-300">"{visit.chiefComplaint}"</span>
                      </p>

                      {/* Allergies Highlight */}
                      {hasKnownAllergies ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-600/70 text-rose-300 text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          ⚠️ Documented Allergies: {visit.patient?.knownAllergies}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No known drug allergies</span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Vitals Display */}
                  <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60 text-xs">
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 uppercase block">SpO2</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          visit.spO2 < 90
                            ? 'text-rose-400 animate-pulse'
                            : visit.spO2 <= 94
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {visit.spO2}%
                      </span>
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 uppercase block">HR</span>
                      <span className="font-mono font-bold text-sm text-cyan-400">
                        {visit.heartRate} <span className="text-[10px] text-slate-500">bpm</span>
                      </span>
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 uppercase block">BP</span>
                      <span className="font-mono font-bold text-sm text-white">{visit.bp}</span>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="shrink-0 flex items-center justify-end">
                    <button
                      onClick={() => openConsultation(visit)}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-2"
                    >
                      <Stethoscope className="w-4 h-4" />
                      Consult & Prescribe
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Consultation Modal */}
      {activeVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-cyan-400" />
                  Clinical Consultation & Discharge Form
                </h3>
                <p className="text-xs text-slate-400">
                  Patient: <span className="text-white font-semibold">{activeVisit.patient?.fullName}</span> ({activeVisit.patient?.uhid}) • Level {activeVisit.triageLevel}
                </p>
              </div>
              <button
                onClick={() => setActiveVisit(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Patient Known Allergies Banner */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                activeVisit.patient?.knownAllergies &&
                activeVisit.patient.knownAllergies.toLowerCase() !== 'none'
                  ? 'bg-rose-950/60 border-rose-500/70 text-rose-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="text-xs font-semibold">
                  Known Patient Allergies: <strong className="text-white">{activeVisit.patient?.knownAllergies || 'None'}</strong>
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40">
                Safety Engine Active
              </span>
            </div>

            <form onSubmit={handleCompleteConsultation} className="space-y-4">
              {/* Diagnosis */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Primary Clinical Diagnosis
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Coronary Syndrome, Acute Bronchitis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              {/* Prescribed Medications */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Prescribed Medications
                  </label>
                  {checkingAllergy && (
                    <span className="text-[11px] text-cyan-400 animate-pulse">Cross-checking allergies...</span>
                  )}
                </div>
                <textarea
                  rows="2"
                  required
                  placeholder="e.g. Amoxicillin 500mg TDS, Paracetamol 650mg SOS"
                  value={prescribedMeds}
                  onChange={(e) => setPrescribedMeds(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500 font-mono"
                />

                {/* Quick med buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400 mr-1 self-center">Test Drugs:</span>
                  {medChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => addMed(chip.label)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                        chip.triggers !== 'None' &&
                        activeVisit.patient?.knownAllergies
                          ?.toLowerCase()
                          .includes(chip.triggers.toLowerCase())
                          ? 'bg-rose-950/80 text-rose-300 border-rose-600 hover:bg-rose-900'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CRITICAL ALLERGY CONFLICT RED ALERT BOX */}
              {allergyConflict?.hasConflict && (
                <div className="p-4 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 space-y-3 animate-fade-in shadow-xl shadow-rose-950">
                  <div className="flex items-start gap-3">
                    <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">
                        CRITICAL SAFETY ALERT: Known Patient Allergy Conflict Detected!
                      </h4>
                      <p className="text-xs text-rose-300 mt-1">
                        {allergyConflict.warningMessage}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rose-800/80">
                    <label className="block text-xs font-bold text-white mb-1">
                      Doctor Allergy Override Note (Required to bypass safety check):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Desensitization protocol approved / Supervised clinical necessity"
                      value={allergyOverrideNote}
                      onChange={(e) => setAllergyOverrideNote(e.target.value)}
                      className="w-full bg-rose-900/60 border border-rose-500 rounded-lg p-2 text-xs text-white placeholder-rose-300/70 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-rose-300 mt-1 block">
                      * Submission is BLOCKED unless a valid override rationale is documented.
                    </span>
                  </div>
                </div>
              )}

              {/* Disposition Action: Discharge vs Admit */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDispositionAction('Discharge')}
                  className={`p-3 rounded-xl border text-left transition ${
                    dispositionAction === 'Discharge'
                      ? 'bg-cyan-500/20 border-cyan-500 text-white ring-1 ring-cyan-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-1.5 text-cyan-400">
                    <Sparkles className="w-4 h-4" /> Discharge Patient
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Auto-triggers Bed Turnover ('Cleaning') if bed occupied.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDispositionAction('Admit')}
                  className={`p-3 rounded-xl border text-left transition ${
                    dispositionAction === 'Admit'
                      ? 'bg-blue-500/20 border-blue-500 text-white ring-1 ring-blue-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-1.5 text-blue-400">
                    <BedDouble className="w-4 h-4" /> Admit to Ward Bed
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Assigns patient to available ER/ICU/General bed.
                  </div>
                </button>
              </div>

              {/* If Admit selected, pick available bed */}
              {dispositionAction === 'Admit' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Select Available Bed for Inpatient Admission
                  </label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                  >
                    {availableBeds.map((b) => (
                      <option key={b.bedId} value={b.bedId}>
                        {b.bedCode} ({b.wardName}) - Ready
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Discharge Summary */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Discharge Summary / Clinical Notes
                </label>
                <textarea
                  rows="2"
                  value={dischargeSummary}
                  onChange={(e) => setDischargeSummary(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveVisit(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (allergyConflict?.hasConflict && !allergyOverrideNote.trim())}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting
                    ? 'Processing...'
                    : dispositionAction === 'Discharge'
                    ? 'Complete Consultation & Trigger Bed Turnover'
                    : 'Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
