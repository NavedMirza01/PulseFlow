import React, { useState, useEffect } from 'react';
import { commandCenterApi, patientsApi } from '../services/api';
import { 
  BedDouble, Sparkles, RefreshCw, AlertTriangle, Users, 
  Calendar, CheckCircle2, Clock, UserCheck, Check, ArrowRight
} from 'lucide-react';

export default function CommandCenter() {
  const [kpis, setKpis] = useState(null);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWardFilter, setSelectedWardFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [cleaningActionBedId, setCleaningActionBedId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Assign Patient Modal state
  const [assignModalBed, setAssignModalBed] = useState(null);
  const [patientsList, setPatientsList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, wardsRes] = await Promise.all([
        commandCenterApi.getKpis(),
        commandCenterApi.getWardsAndBeds(),
      ]);
      setKpis(kpiRes.data);
      setWards(wardsRes.data);
    } catch (err) {
      console.error('Failed to load command center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000); // Poll every 8s
    return () => clearInterval(interval);
  }, []);

  const handleMarkClean = async (bedId, bedCode) => {
    try {
      setCleaningActionBedId(bedId);
      await commandCenterApi.markBedClean(bedId);
      setNotification({
        type: 'success',
        text: `Bed ${bedCode} has been cleaned and is now AVAILABLE!`,
      });
      setTimeout(() => setNotification(null), 4000);
      await fetchData();
    } catch (err) {
      setNotification({
        type: 'error',
        text: `Failed to mark bed ${bedCode} as clean.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setCleaningActionBedId(null);
    }
  };

  const openAssignModal = async (bed) => {
    setAssignModalBed(bed);
    try {
      const res = await patientsApi.search('');
      setPatientsList(res.data || []);
      if (res.data?.length > 0) setSelectedPatientId(res.data[0].patientId);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  const handleAssignPatient = async () => {
    if (!assignModalBed || !selectedPatientId) return;
    try {
      setAssignLoading(true);
      await commandCenterApi.assignPatientToBed(assignModalBed.bedId, Number(selectedPatientId));
      setNotification({
        type: 'success',
        text: `Patient assigned to Bed ${assignModalBed.bedCode} successfully.`,
      });
      setTimeout(() => setNotification(null), 4000);
      setAssignModalBed(null);
      await fetchData();
    } catch (err) {
      alert('Failed to assign patient to bed.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Filtered beds
  const allBeds = wards.flatMap((w) => w.beds);
  const filteredBeds = allBeds.filter((b) => {
    const matchesWard =
      selectedWardFilter === 'ALL' || b.wardName.toLowerCase().includes(selectedWardFilter.toLowerCase());
    const matchesStatus =
      selectedStatusFilter === 'ALL' || b.status.toLowerCase() === selectedStatusFilter.toLowerCase();
    return matchesWard && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BedDouble className="w-7 h-7 text-cyan-400" />
            Hospital Command Center
          </h1>
          <p className="text-sm text-slate-400">
            Real-time ER bed turnover tracking, capacity monitoring, and auto-triage metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          } animate-fade-in`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold text-sm">{notification.text}</span>
          </div>
        </div>
      )}

      {/* Live KPI Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Beds</span>
          <div className="text-2xl font-bold text-white mt-1">{kpis?.totalBeds ?? '--'}</div>
          <span className="text-[11px] text-slate-500">Across 3 wards</span>
        </div>

        <div className="bg-slate-800/90 border border-emerald-500/30 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-emerald-400 uppercase font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Available
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{kpis?.availableBeds ?? '--'}</div>
          <span className="text-[11px] text-emerald-500/90">Ready for intake</span>
        </div>

        <div className="bg-slate-800/90 border border-blue-500/30 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-blue-400 uppercase font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Occupied
          </span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{kpis?.occupiedBeds ?? '--'}</div>
          <span className="text-[11px] text-blue-400/80">{kpis?.bedOccupancyRate}% Occupancy</span>
        </div>

        <div className="bg-slate-800/90 border border-amber-500/30 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-amber-400 uppercase font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Cleaning
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{kpis?.cleaningBeds ?? '--'}</div>
          <span className="text-[11px] text-amber-400/80">Turnover in progress</span>
        </div>

        <div className="bg-slate-800/90 border border-rose-500/30 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-rose-400 uppercase font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical (L1/2)
          </span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{kpis?.criticalPatientsCount ?? '--'}</div>
          <span className="text-[11px] text-rose-400/80">Immediate attention</span>
        </div>

        <div className="bg-slate-800/90 border border-indigo-500/30 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-indigo-400 uppercase font-semibold flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> ER Queue
          </span>
          <div className="text-2xl font-bold text-indigo-300 mt-1">{kpis?.erWaitingPatients ?? '--'}</div>
          <span className="text-[11px] text-indigo-400/80">Waiting for doctor</span>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-xl shadow-sm">
          <span className="text-xs text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> OPD Today
          </span>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{kpis?.todayAppointmentsCount ?? '--'}</div>
          <span className="text-[11px] text-slate-400">Scheduled</span>
        </div>
      </div>

      {/* Ward & Status Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1">Ward:</span>
          {['ALL', 'Emergency', 'Intensive Care', 'General'].map((w) => (
            <button
              key={w}
              onClick={() => setSelectedWardFilter(w)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                selectedWardFilter === w
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {w === 'ALL' ? 'All Wards' : w}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1">Status:</span>
          {['ALL', 'Available', 'Occupied', 'Cleaning'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                selectedStatusFilter === st
                  ? 'bg-slate-200 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredBeds.map((bed) => {
          const isCleaning = bed.status === 'Cleaning';
          const isOccupied = bed.status === 'Occupied';
          const isAvailable = bed.status === 'Available';

          return (
            <div
              key={bed.bedId}
              className={`p-4 rounded-xl border transition relative flex flex-col justify-between ${
                isCleaning
                  ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                  : isOccupied
                  ? 'bg-blue-950/20 border-blue-500/40 hover:border-blue-400'
                  : 'bg-slate-800/60 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-white tracking-wide">
                      {bed.bedCode}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-800">
                      {bed.wardName}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                      isCleaning
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : isOccupied
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCleaning
                          ? 'bg-amber-400 animate-ping'
                          : isOccupied
                          ? 'bg-blue-400'
                          : 'bg-emerald-400'
                      }`}
                    ></span>
                    {bed.status}
                  </span>
                </div>

                {/* Card Body */}
                {isOccupied && (
                  <div className="mt-3 p-2.5 bg-slate-900/70 rounded-lg border border-slate-700/60 text-xs space-y-1">
                    <div className="font-semibold text-slate-200 flex items-center justify-between">
                      <span>{bed.patientName || 'Patient'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{bed.patientUhid}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {bed.patientAge} yrs • {bed.patientGender}
                    </div>
                  </div>
                )}

                {isCleaning && (
                  <div className="mt-3 p-3 bg-amber-950/40 rounded-lg border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-300">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Turnover Time:
                      </span>
                      <span className="font-mono font-bold">{bed.cleaningMinutesElapsed} min elapsed</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (bed.cleaningMinutesElapsed / 15) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-amber-400/80">Turnover Target: 15 mins</p>
                  </div>
                )}

                {isAvailable && (
                  <div className="mt-3 p-2.5 bg-emerald-950/20 rounded-lg border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Bed sanitized & ready for ER / Inpatient intake.</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center gap-2">
                {isCleaning && (
                  <button
                    onClick={() => handleMarkClean(bed.bedId, bed.bedCode)}
                    disabled={cleaningActionBedId === bed.bedId}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {cleaningActionBedId === bed.bedId ? 'Sanitizing...' : 'One-Click Mark Clean'}
                  </button>
                )}

                {isAvailable && (
                  <button
                    onClick={() => openAssignModal(bed)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-medium text-xs transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign Patient
                  </button>
                )}

                {isOccupied && (
                  <div className="w-full text-center text-[11px] text-slate-400 py-1">
                    Discharge via Doctor Console
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Patient Modal */}
      {assignModalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              Assign Patient to Bed {assignModalBed.bedCode}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select a registered patient to allocate to this {assignModalBed.wardName} bed.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                >
                  {patientsList.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.fullName} ({p.uhid}) - {p.gender}, {p.age}y
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAssignModalBed(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignPatient}
                  disabled={assignLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition shadow flex items-center gap-2"
                >
                  {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
