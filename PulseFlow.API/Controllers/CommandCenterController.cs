using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Data;
using PulseFlow.API.DTOs;
using PulseFlow.API.Models;

namespace PulseFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommandCenterController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CommandCenterController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("kpis")]
    public async Task<ActionResult<KpiSummaryDto>> GetKpis()
    {
        var totalBeds = await _context.Beds.CountAsync();
        var availableBeds = await _context.Beds.CountAsync(b => b.Status == "Available");
        var occupiedBeds = await _context.Beds.CountAsync(b => b.Status == "Occupied");
        var cleaningBeds = await _context.Beds.CountAsync(b => b.Status == "Cleaning");

        var occupancyRate = totalBeds > 0 ? Math.Round(((double)occupiedBeds / totalBeds) * 100, 1) : 0;

        var erWaiting = await _context.TriageVisits.CountAsync(v => v.QueueStatus == "Waiting");
        var criticalCount = await _context.TriageVisits.CountAsync(v => v.QueueStatus == "Waiting" && (v.TriageLevel == 1 || v.TriageLevel == 2));

        var today = DateOnly.FromDateTime(DateTime.Today);
        var todayAppointments = await _context.Appointments.CountAsync(a => a.AppointmentDate == today);

        return Ok(new KpiSummaryDto
        {
            TotalBeds = totalBeds,
            AvailableBeds = availableBeds,
            OccupiedBeds = occupiedBeds,
            CleaningBeds = cleaningBeds,
            BedOccupancyRate = occupancyRate,
            ErWaitingPatients = erWaiting,
            CriticalPatientsCount = criticalCount,
            TodayAppointmentsCount = todayAppointments
        });
    }

    [HttpGet("wards-beds")]
    public async Task<ActionResult<List<WardSummaryDto>>> GetWardsAndBeds()
    {
        var wards = await _context.Wards
            .Include(w => w.Beds)
            .ThenInclude(b => b.CurrentPatient)
            .OrderBy(w => w.FloorNumber)
            .ToListAsync();

        var now = DateTime.UtcNow;

        var result = wards.Select(w => new WardSummaryDto
        {
            WardId = w.WardId,
            WardName = w.WardName,
            FloorNumber = w.FloorNumber,
            TotalCapacity = w.TotalCapacity,
            Beds = w.Beds.OrderBy(b => b.BedCode).Select(b => new BedStatusDto
            {
                BedId = b.BedId,
                WardId = b.WardId,
                WardName = w.WardName,
                BedCode = b.BedCode,
                Status = b.Status,
                StatusUpdatedAt = b.StatusUpdatedAt,
                CleaningMinutesElapsed = b.Status == "Cleaning" ? (int)Math.Max(0, (now - b.StatusUpdatedAt).TotalMinutes) : 0,
                CurrentPatientId = b.CurrentPatientId,
                PatientName = b.CurrentPatient?.FullName,
                PatientUhid = b.CurrentPatient?.UHID,
                PatientAge = b.CurrentPatient?.Age,
                PatientGender = b.CurrentPatient?.Gender
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    [HttpPost("beds/{bedId}/mark-clean")]
    public async Task<IActionResult> MarkBedAsClean(int bedId)
    {
        var bed = await _context.Beds.FindAsync(bedId);
        if (bed == null) return NotFound(new { message = $"Bed with ID {bedId} not found." });

        bed.Status = "Available";
        bed.CurrentPatientId = null;
        bed.StatusUpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Bed {bed.BedCode} marked as Clean and is now Available.", bedId = bed.BedId, status = bed.Status });
    }

    [HttpPost("beds/{bedId}/assign-patient")]
    public async Task<IActionResult> AssignPatientToBed(int bedId, [FromBody] AssignBedRequest request)
    {
        var bed = await _context.Beds.FindAsync(bedId);
        if (bed == null) return NotFound(new { message = $"Bed with ID {bedId} not found." });

        var patient = await _context.Patients.FindAsync(request.PatientId);
        if (patient == null) return NotFound(new { message = $"Patient with ID {request.PatientId} not found." });

        bed.Status = "Occupied";
        bed.CurrentPatientId = request.PatientId;
        bed.StatusUpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Bed {bed.BedCode} assigned to {patient.FullName}.", bedId = bed.BedId, status = bed.Status });
    }
}
