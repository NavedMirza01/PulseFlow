using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Data;
using PulseFlow.API.DTOs;
using PulseFlow.API.Models;

namespace PulseFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PatientsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<Patient>>> SearchPatients([FromQuery] string? query)
    {
        var q = _context.Patients.AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim().ToLower();
            q = q.Where(p => p.FullName.ToLower().Contains(term) || p.UHID.ToLower().Contains(term));
        }

        var patients = await q.OrderByDescending(p => p.PatientId).Take(50).ToListAsync();
        return Ok(patients);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Patient>> GetPatient(int id)
    {
        var patient = await _context.Patients.FindAsync(id);
        if (patient == null) return NotFound(new { message = $"Patient with ID {id} not found." });
        return Ok(patient);
    }

    [HttpPost]
    public async Task<ActionResult<Patient>> CreatePatient([FromBody] CreatePatientRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { message = "Patient Name is required." });

        var patient = new Patient
        {
            UHID = $"PF-2026-{new Random().Next(400, 999)}",
            FullName = req.FullName.Trim(),
            Age = req.Age > 0 ? req.Age : 30,
            Gender = req.Gender ?? "Male",
            BloodGroup = req.BloodGroup ?? "O+",
            KnownAllergies = string.IsNullOrWhiteSpace(req.KnownAllergies) ? "None" : req.KnownAllergies.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Patients.Add(patient);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPatient), new { id = patient.PatientId }, patient);
    }
}
