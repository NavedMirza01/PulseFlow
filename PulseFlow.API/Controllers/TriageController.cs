using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Data;
using PulseFlow.API.DTOs;
using PulseFlow.API.Models;

namespace PulseFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TriageController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TriageController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("pending-appointments")]
    public async Task<IActionResult> GetPendingAppointments()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var pending = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Where(a => a.AppointmentDate == today && a.Status == "Booked")
            .OrderBy(a => a.SlotTime)
            .ToListAsync();

        return Ok(pending);
    }

    [HttpPost("calculate-level")]
    public ActionResult<TriageCalculationResult> CalculateLevel([FromBody] WalkInTriageRequest req)
    {
        return Ok(EvaluateTriage(req.SpO2, req.HeartRate, req.BP, req.ChiefComplaint));
    }

    [HttpPost("check-in-appointment/{appointmentId}")]
    public async Task<IActionResult> CheckInAppointment(int appointmentId, [FromBody] WalkInTriageRequest? vitals)
    {
        var appt = await _context.Appointments.Include(a => a.Patient).FirstOrDefaultAsync(a => a.AppointmentId == appointmentId);
        if (appt == null) return NotFound(new { message = $"Appointment with ID {appointmentId} not found." });

        appt.Status = "CheckedIn";

        int spO2 = vitals?.SpO2 ?? 98;
        int hr = vitals?.HeartRate ?? 76;
        string bp = string.IsNullOrWhiteSpace(vitals?.BP) ? "120/80" : vitals.BP;
        string complaint = !string.IsNullOrWhiteSpace(vitals?.ChiefComplaint) ? vitals.ChiefComplaint : (!string.IsNullOrWhiteSpace(appt.Reason) ? appt.Reason : "OPD Consultation");

        var evaluation = EvaluateTriage(spO2, hr, bp, complaint);

        var visit = new TriageVisit
        {
            PatientId = appt.PatientId,
            AssignedDoctorId = appt.DoctorId,
            ChiefComplaint = complaint,
            HeartRate = hr,
            BP = bp,
            SpO2 = spO2,
            TriageLevel = evaluation.TriageLevel,
            QueueStatus = "Waiting",
            CheckInTime = DateTime.UtcNow
        };

        _context.TriageVisits.Add(visit);
        await _context.SaveChangesAsync();

        var savedVisit = await _context.TriageVisits
            .Include(v => v.Patient)
            .Include(v => v.AssignedDoctor)
            .FirstOrDefaultAsync(v => v.VisitId == visit.VisitId);

        return Ok(new
        {
            message = "Patient Checked In and queued for Doctor Consultation.",
            visit = savedVisit,
            triageEvaluation = evaluation
        });
    }

    [HttpPost("walk-in")]
    public async Task<IActionResult> WalkInTriage([FromBody] WalkInTriageRequest req)
    {
        int patientId;
        if (req.PatientId.HasValue && req.PatientId.Value > 0)
        {
            patientId = req.PatientId.Value;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(req.FullName))
            {
                return BadRequest(new { message = "Patient Name or PatientId is required for Walk-In Triage." });
            }

            var newPatient = new Patient
            {
                UHID = $"PF-2026-{new Random().Next(300, 999)}",
                FullName = req.FullName.Trim(),
                Age = req.Age ?? 35,
                Gender = req.Gender ?? "Male",
                BloodGroup = req.BloodGroup ?? "O+",
                KnownAllergies = string.IsNullOrWhiteSpace(req.KnownAllergies) ? "None" : req.KnownAllergies.Trim()
            };

            _context.Patients.Add(newPatient);
            await _context.SaveChangesAsync();
            patientId = newPatient.PatientId;
        }

        var evaluation = EvaluateTriage(req.SpO2, req.HeartRate, req.BP, req.ChiefComplaint);

        var visit = new TriageVisit
        {
            PatientId = patientId,
            AssignedDoctorId = req.AssignedDoctorId,
            ChiefComplaint = req.ChiefComplaint ?? "General Malaise",
            HeartRate = req.HeartRate,
            BP = string.IsNullOrWhiteSpace(req.BP) ? "120/80" : req.BP,
            SpO2 = req.SpO2,
            TriageLevel = evaluation.TriageLevel,
            QueueStatus = "Waiting",
            CheckInTime = DateTime.UtcNow
        };

        _context.TriageVisits.Add(visit);
        await _context.SaveChangesAsync();

        var savedVisit = await _context.TriageVisits
            .Include(v => v.Patient)
            .Include(v => v.AssignedDoctor)
            .FirstOrDefaultAsync(v => v.VisitId == visit.VisitId);

        return Ok(new
        {
            message = $"Triage completed with Level {evaluation.TriageLevel} ({evaluation.TriageCategory}).",
            visit = savedVisit,
            triageEvaluation = evaluation
        });
    }

    public static TriageCalculationResult EvaluateTriage(int spO2, int hr, string bp, string complaint)
    {
        var triggers = new List<string>();
        int systolic = 120;
        if (!string.IsNullOrWhiteSpace(bp))
        {
            var match = Regex.Match(bp, @"^(\d{2,3})");
            if (match.Success && int.TryParse(match.Groups[1].Value, out int s))
            {
                systolic = s;
            }
        }

        string compLower = complaint?.ToLowerInvariant() ?? "";
        bool severeComplaint = compLower.Contains("chest") || compLower.Contains("stroke") ||
                               compLower.Contains("unconscious") || compLower.Contains("cardiac") ||
                               compLower.Contains("heavy bleeding") || compLower.Contains("respiratory failure");

        // Level 1: Resuscitation / Critical (Red)
        if (spO2 < 90) triggers.Add($"Hypoxia: Critical SpO2 at {spO2}% (<90%)");
        if (hr > 135 || hr < 40) triggers.Add($"Severe Arrhythmia: HR at {hr} bpm (<40 or >135)");
        if (systolic >= 200 || systolic < 75) triggers.Add($"Hypertensive crisis / Shock: Systolic BP {systolic} mmHg");
        if (severeComplaint) triggers.Add("Critical/Life-Threatening chief complaint presentation");

        if (triggers.Count > 0 && (spO2 < 90 || hr > 135 || hr < 40 || systolic < 75 || severeComplaint))
        {
            return new TriageCalculationResult
            {
                TriageLevel = 1,
                TriageCategory = "Critical / Resuscitation",
                ColorCode = "Red",
                Triggers = triggers
            };
        }

        // Level 2: Emergent (Orange)
        if (spO2 <= 93) triggers.Add($"Sub-optimal SpO2: {spO2}% (90-93%)");
        if (hr > 115 || hr < 50) triggers.Add($"Tachycardia/Bradycardia: HR {hr} bpm");
        if (systolic >= 175) triggers.Add($"High Systolic BP: {systolic} mmHg");
        if (compLower.Contains("severe pain") || compLower.Contains("fracture") || compLower.Contains("asthma"))
            triggers.Add("Acute emergent complaint");

        if (triggers.Count > 0)
        {
            return new TriageCalculationResult
            {
                TriageLevel = 2,
                TriageCategory = "Emergent",
                ColorCode = "Orange",
                Triggers = triggers
            };
        }

        // Level 3: Urgent (Yellow)
        if (spO2 <= 95) triggers.Add($"Mild Hypoxia: SpO2 {spO2}%");
        if (hr > 100) triggers.Add($"Elevated Heart Rate: {hr} bpm");
        if (compLower.Contains("fever") || compLower.Contains("dizziness") || compLower.Contains("vomiting"))
            triggers.Add("Urgent systemic symptom profile");

        if (triggers.Count > 0)
        {
            return new TriageCalculationResult
            {
                TriageLevel = 3,
                TriageCategory = "Urgent",
                ColorCode = "Yellow",
                Triggers = triggers
            };
        }

        // Level 4: Less Urgent (Green)
        if (spO2 <= 97 || compLower.Contains("rash") || compLower.Contains("cough") || compLower.Contains("cold"))
        {
            triggers.Add("Mild symptoms within safe vital parameters");
            return new TriageCalculationResult
            {
                TriageLevel = 4,
                TriageCategory = "Less Urgent",
                ColorCode = "Green",
                Triggers = triggers
            };
        }

        // Level 5: Non-Urgent (Blue)
        triggers.Add("Normal vitals, routine/follow-up consult");
        return new TriageCalculationResult
        {
            TriageLevel = 5,
            TriageCategory = "Non-Urgent",
            ColorCode = "Blue",
            Triggers = triggers
        };
    }
}
