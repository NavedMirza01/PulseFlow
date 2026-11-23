using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Data;
using PulseFlow.API.DTOs;
using PulseFlow.API.Models;

namespace PulseFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DoctorController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DoctorController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetDoctorQueue([FromQuery] int? doctorId)
    {
        var query = _context.TriageVisits
            .Include(v => v.Patient)
            .Include(v => v.AssignedDoctor)
            .Where(v => v.QueueStatus == "Waiting" || v.QueueStatus == "InConsultation");

        if (doctorId.HasValue && doctorId.Value > 0)
        {
            query = query.Where(v => v.AssignedDoctorId == doctorId || v.AssignedDoctorId == null);
        }

        var queue = await query
            .OrderBy(v => v.TriageLevel) // Priority 1 (Critical) first
            .ThenBy(v => v.CheckInTime)  // Oldest waiting first
            .ToListAsync();

        return Ok(queue);
    }

    [HttpPost("check-allergy")]
    public async Task<ActionResult<AllergyCheckResult>> CheckAllergies([FromBody] AllergyCheckRequest request)
    {
        var patient = await _context.Patients.FindAsync(request.PatientId);
        if (patient == null) return NotFound(new { message = $"Patient with ID {request.PatientId} not found." });

        return Ok(EvaluateAllergyConflict(patient.KnownAllergies, request.PrescribedMeds));
    }

    [HttpPost("consultation-complete")]
    public async Task<IActionResult> CompleteConsultation([FromBody] ConsultationDischargeRequest request)
    {
        var visit = await _context.TriageVisits
            .Include(v => v.Patient)
            .FirstOrDefaultAsync(v => v.VisitId == request.VisitId);

        if (visit == null) return NotFound(new { message = $"Visit with ID {request.VisitId} not found." });

        // Allergy check validation
        var allergyCheck = EvaluateAllergyConflict(visit.Patient?.KnownAllergies, request.PrescribedMeds);
        if (allergyCheck.HasConflict && string.IsNullOrWhiteSpace(request.AllergyOverrideNote))
        {
            return BadRequest(new
            {
                hasAllergyWarning = true,
                warning = allergyCheck.WarningMessage,
                conflictingMeds = allergyCheck.ConflictingMeds,
                message = "CRITICAL RED ALERT: Known patient allergy conflict detected! Doctor must provide an AllergyOverrideNote or modify prescribed medications."
            });
        }

        // Save clinical record
        var clinicalRecord = new ClinicalRecord
        {
            VisitId = visit.VisitId,
            Diagnosis = request.Diagnosis,
            PrescribedMeds = request.PrescribedMeds,
            AllergyOverrideNote = request.AllergyOverrideNote,
            DischargeSummary = request.DischargeSummary ?? $"Patient evaluated. Diagnosis: {request.Diagnosis}.",
            CreatedAt = DateTime.UtcNow
        };
        _context.ClinicalRecords.Add(clinicalRecord);

        Bed? affectedBed = null;

        if (request.Action.Equals("Discharge", StringComparison.OrdinalIgnoreCase))
        {
            visit.QueueStatus = "Discharged";

            // Automatic Bed-Turnover Command Center trigger!
            // Find if patient is assigned to any bed
            affectedBed = await _context.Beds.FirstOrDefaultAsync(b => b.CurrentPatientId == visit.PatientId);
            if (affectedBed != null)
            {
                affectedBed.Status = "Cleaning"; // Automatically flips to Cleaning
                affectedBed.CurrentPatientId = null; // Patient discharged from bed
                affectedBed.StatusUpdatedAt = DateTime.UtcNow;
            }
        }
        else if (request.Action.Equals("Admit", StringComparison.OrdinalIgnoreCase))
        {
            visit.QueueStatus = "Admitted";
            if (request.AssignBedId.HasValue && request.AssignBedId.Value > 0)
            {
                var targetBed = await _context.Beds.FindAsync(request.AssignBedId.Value);
                if (targetBed != null)
                {
                    targetBed.Status = "Occupied";
                    targetBed.CurrentPatientId = visit.PatientId;
                    targetBed.StatusUpdatedAt = DateTime.UtcNow;
                    affectedBed = targetBed;
                }
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = request.Action.Equals("Discharge", StringComparison.OrdinalIgnoreCase)
                ? (affectedBed != null
                    ? $"Consultation completed. Patient discharged. Bed {affectedBed.BedCode} automatically transitioned to 'Cleaning' for turnover!"
                    : "Consultation completed. Patient discharged.")
                : "Consultation completed. Patient admitted.",
            clinicalRecordId = clinicalRecord.RecordId,
            bedTurnoverTriggered = affectedBed != null && affectedBed.Status == "Cleaning",
            flippedBed = affectedBed != null ? new { affectedBed.BedId, affectedBed.BedCode, affectedBed.Status } : null
        });
    }

    public static AllergyCheckResult EvaluateAllergyConflict(string? knownAllergies, string? prescribedMeds)
    {
        var result = new AllergyCheckResult
        {
            KnownAllergies = knownAllergies ?? "None",
            HasConflict = false
        };

        if (string.IsNullOrWhiteSpace(knownAllergies) || knownAllergies.Equals("None", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(prescribedMeds))
        {
            return result;
        }

        var medLower = prescribedMeds.ToLowerInvariant();
        var allergyTokens = knownAllergies.Split(new[] { ',', ';', '/' }, StringSplitOptions.RemoveEmptyEntries)
                                          .Select(a => a.Trim().ToLowerInvariant())
                                          .ToList();

        var conflicts = new List<string>();

        foreach (var allergy in allergyTokens)
        {
            if (string.IsNullOrWhiteSpace(allergy) || allergy == "none") continue;

            if (allergy.Contains("penicillin"))
            {
                if (medLower.Contains("penicillin") || medLower.Contains("amoxicillin") ||
                    medLower.Contains("ampicillin") || medLower.Contains("augmentin"))
                {
                    conflicts.Add("Penicillin class antibiotics (Amoxicillin/Ampicillin/Augmentin)");
                }
            }
            else if (allergy.Contains("aspirin"))
            {
                if (medLower.Contains("aspirin") || medLower.Contains("disprin") ||
                    medLower.Contains("ecosprin") || medLower.Contains("nsaid"))
                {
                    conflicts.Add("Aspirin / Salicylates");
                }
            }
            else if (allergy.Contains("ibuprofen") || allergy.Contains("nsaid"))
            {
                if (medLower.Contains("ibuprofen") || medLower.Contains("brufen") ||
                    medLower.Contains("advil") || medLower.Contains("nsaid") || medLower.Contains("diclofenac"))
                {
                    conflicts.Add("Ibuprofen / NSAIDs");
                }
            }
            else if (allergy.Contains("sulfa"))
            {
                if (medLower.Contains("sulfa") || medLower.Contains("bactrim") || medLower.Contains("septra"))
                {
                    conflicts.Add("Sulfa / Sulfonamides");
                }
            }
            else
            {
                if (medLower.Contains(allergy))
                {
                    conflicts.Add(allergy);
                }
            }
        }

        if (conflicts.Count > 0)
        {
            result.HasConflict = true;
            result.ConflictingMeds = conflicts.Distinct().ToList();
            result.WarningMessage = $"ALERT: Patient has documented allergy to '{knownAllergies}'. Prescribed medication matches: {string.Join(", ", result.ConflictingMeds)}.";
        }

        return result;
    }
}
