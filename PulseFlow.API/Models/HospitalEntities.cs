using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PulseFlow.API.Models;

public class StaffMember
{
    [Key]
    public int StaffId { get; set; }
    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;
    [Required, MaxLength(20)]
    public string Role { get; set; } = "Doctor"; // Admin, Doctor, Nurse, Reception
    [MaxLength(50)]
    public string Department { get; set; } = "General";
    public bool IsOnDuty { get; set; } = true;
}

public class Patient
{
    [Key]
    public int PatientId { get; set; }
    [Required, MaxLength(20)]
    public string UHID { get; set; } = string.Empty; // e.g., PF-2026-001
    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;
    public int Age { get; set; }
    [MaxLength(10)]
    public string Gender { get; set; } = "Male";
    [MaxLength(5)]
    public string BloodGroup { get; set; } = "O+";
    [MaxLength(500)]
    public string KnownAllergies { get; set; } = "None"; // Comma-separated e.g. "Penicillin, Aspirin"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Ward
{
    [Key]
    public int WardId { get; set; }
    [Required, MaxLength(50)]
    public string WardName { get; set; } = string.Empty; // ER, ICU, General
    public int FloorNumber { get; set; }
    public int TotalCapacity { get; set; }
    public ICollection<Bed> Beds { get; set; } = new List<Bed>();
}

public class Bed
{
    [Key]
    public int BedId { get; set; }
    public int WardId { get; set; }
    [ForeignKey(nameof(WardId))]
    public Ward? Ward { get; set; }

    [Required, MaxLength(20)]
    public string BedCode { get; set; } = string.Empty; // e.g., ICU-01
    [Required, MaxLength(20)]
    public string Status { get; set; } = "Available"; // Available, Occupied, Cleaning

    public int? CurrentPatientId { get; set; }
    [ForeignKey(nameof(CurrentPatientId))]
    public Patient? CurrentPatient { get; set; }

    public DateTime StatusUpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Appointment
{
    [Key]
    public int AppointmentId { get; set; }
    public int PatientId { get; set; }
    [ForeignKey(nameof(PatientId))]
    public Patient? Patient { get; set; }

    public int DoctorId { get; set; }
    [ForeignKey(nameof(DoctorId))]
    public StaffMember? Doctor { get; set; }

    public DateOnly AppointmentDate { get; set; }
    [Required, MaxLength(15)]
    public string SlotTime { get; set; } = "10:00 AM"; // e.g., "10:00 AM", "10:30 AM"
    [MaxLength(20)]
    public string ConsultationType { get; set; } = "OPD"; // OPD, FollowUp
    [MaxLength(20)]
    public string Status { get; set; } = "Booked"; // Booked, CheckedIn, Completed, Cancelled
    [MaxLength(250)]
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TriageVisit
{
    [Key]
    public int VisitId { get; set; }
    public int PatientId { get; set; }
    [ForeignKey(nameof(PatientId))]
    public Patient? Patient { get; set; }

    public int? AssignedDoctorId { get; set; }
    [ForeignKey(nameof(AssignedDoctorId))]
    public StaffMember? AssignedDoctor { get; set; }

    [Required, MaxLength(250)]
    public string ChiefComplaint { get; set; } = string.Empty;
    public int HeartRate { get; set; }
    [MaxLength(15)]
    public string BP { get; set; } = "120/80";
    public int SpO2 { get; set; } = 98;

    public int TriageLevel { get; set; } = 3; // 1 (Critical) to 5 (Non-Urgent)
    [MaxLength(20)]
    public string QueueStatus { get; set; } = "Waiting"; // Waiting, InConsultation, Admitted, Discharged
    public DateTime CheckInTime { get; set; } = DateTime.UtcNow;
}

public class ClinicalRecord
{
    [Key]
    public int RecordId { get; set; }
    public int VisitId { get; set; }
    [ForeignKey(nameof(VisitId))]
    public TriageVisit? Visit { get; set; }

    [Required, MaxLength(500)]
    public string Diagnosis { get; set; } = string.Empty;
    [Required, MaxLength(500)]
    public string PrescribedMeds { get; set; } = string.Empty;
    [MaxLength(250)]
    public string? AllergyOverrideNote { get; set; }
    [MaxLength(1000)]
    public string? DischargeSummary { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}