using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Data;
using PulseFlow.API.DTOs;
using PulseFlow.API.Models;

namespace PulseFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    private static readonly string[] StandardSlots = new[]
    {
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
        "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM"
    };

    public AppointmentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("doctors")]
    public async Task<ActionResult<List<StaffMember>>> GetDoctors()
    {
        var doctors = await _context.StaffMembers
            .Where(s => s.Role == "Doctor" && s.IsOnDuty)
            .OrderBy(s => s.FullName)
            .ToListAsync();
        return Ok(doctors);
    }

    [HttpGet("slots")]
    public async Task<ActionResult<List<SlotDto>>> GetAvailableSlots([FromQuery] int doctorId, [FromQuery] DateOnly? date)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.Today);

        var bookedSlots = await _context.Appointments
            .Where(a => a.DoctorId == doctorId && a.AppointmentDate == targetDate && a.Status != "Cancelled")
            .Select(a => a.SlotTime)
            .ToListAsync();

        var bookedSet = new HashSet<string>(bookedSlots, StringComparer.OrdinalIgnoreCase);

        var result = StandardSlots.Select(slot => new SlotDto
        {
            SlotTime = slot,
            IsAvailable = !bookedSet.Contains(slot)
        }).ToList();

        return Ok(result);
    }

    [HttpGet("today")]
    public async Task<IActionResult> GetTodayAppointments()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var appointments = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Where(a => a.AppointmentDate == today)
            .OrderBy(a => a.SlotTime)
            .ToListAsync();

        return Ok(appointments);
    }

    [HttpPost("book")]
    public async Task<IActionResult> BookAppointment([FromBody] BookAppointmentRequest request)
    {
        if (request.DoctorId <= 0) return BadRequest(new { message = "Valid Doctor ID is required." });
        if (string.IsNullOrWhiteSpace(request.SlotTime)) return BadRequest(new { message = "Slot Time is required." });

        // Double booking check
        var isSlotBooked = await _context.Appointments.AnyAsync(a =>
            a.DoctorId == request.DoctorId &&
            a.AppointmentDate == request.AppointmentDate &&
            a.SlotTime == request.SlotTime &&
            a.Status != "Cancelled");

        if (isSlotBooked)
        {
            return Conflict(new { message = $"Conflict: The slot {request.SlotTime} on {request.AppointmentDate} is already booked for this doctor. Zero-conflict guarantee triggered." });
        }

        int patientId;
        if (request.PatientId.HasValue && request.PatientId.Value > 0)
        {
            patientId = request.PatientId.Value;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.FullName))
            {
                return BadRequest(new { message = "Patient Name or valid PatientId is required." });
            }

            var newPatient = new Patient
            {
                UHID = $"PF-2026-{new Random().Next(200, 999)}",
                FullName = request.FullName.Trim(),
                Age = request.Age ?? 30,
                Gender = request.Gender ?? "Male",
                BloodGroup = request.BloodGroup ?? "O+",
                KnownAllergies = string.IsNullOrWhiteSpace(request.KnownAllergies) ? "None" : request.KnownAllergies.Trim()
            };

            _context.Patients.Add(newPatient);
            await _context.SaveChangesAsync();
            patientId = newPatient.PatientId;
        }

        var appointment = new Appointment
        {
            PatientId = patientId,
            DoctorId = request.DoctorId,
            AppointmentDate = request.AppointmentDate,
            SlotTime = request.SlotTime,
            ConsultationType = request.ConsultationType ?? "OPD",
            Status = "Booked",
            Reason = request.Reason ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        var created = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .FirstOrDefaultAsync(a => a.AppointmentId == appointment.AppointmentId);

        return CreatedAtAction(nameof(GetTodayAppointments), new { id = appointment.AppointmentId }, created);
    }
}
