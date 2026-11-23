namespace PulseFlow.API.DTOs;

public class KpiSummaryDto
{
    public int TotalBeds { get; set; }
    public int AvailableBeds { get; set; }
    public int OccupiedBeds { get; set; }
    public int CleaningBeds { get; set; }
    public double BedOccupancyRate { get; set; }
    public int ErWaitingPatients { get; set; }
    public int CriticalPatientsCount { get; set; } // Level 1 & 2
    public int TodayAppointmentsCount { get; set; }
}

public class BedStatusDto
{
    public int BedId { get; set; }
    public int WardId { get; set; }
    public string WardName { get; set; } = string.Empty;
    public string BedCode { get; set; } = string.Empty;
    public string Status { get; set; } = "Available"; // Available, Occupied, Cleaning
    public DateTime StatusUpdatedAt { get; set; }
    public int CleaningMinutesElapsed { get; set; }
    public int? CurrentPatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientUhid { get; set; }
    public int? PatientAge { get; set; }
    public string? PatientGender { get; set; }
}

public class WardSummaryDto
{
    public int WardId { get; set; }
    public string WardName { get; set; } = string.Empty;
    public int FloorNumber { get; set; }
    public int TotalCapacity { get; set; }
    public List<BedStatusDto> Beds { get; set; } = new();
}

public class AssignBedRequest
{
    public int PatientId { get; set; }
}

public class SlotDto
{
    public string SlotTime { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
}

public class BookAppointmentRequest
{
    public int? PatientId { get; set; }
    // Optional if new patient
    public string? FullName { get; set; }
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? BloodGroup { get; set; }
    public string? KnownAllergies { get; set; }

    public int DoctorId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public string SlotTime { get; set; } = string.Empty;
    public string ConsultationType { get; set; } = "OPD";
    public string Reason { get; set; } = string.Empty;
}

public class WalkInTriageRequest
{
    public int? PatientId { get; set; }
    // If registering on the spot:
    public string? FullName { get; set; }
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? BloodGroup { get; set; }
    public string? KnownAllergies { get; set; }

    public int? AssignedDoctorId { get; set; }
    public string ChiefComplaint { get; set; } = string.Empty;
    public int HeartRate { get; set; }
    public string BP { get; set; } = "120/80";
    public int SpO2 { get; set; } = 98;
}

public class TriageCalculationResult
{
    public int TriageLevel { get; set; }
    public string TriageCategory { get; set; } = string.Empty; // Critical, Emergent, Urgent, Less Urgent, Non-Urgent
    public string ColorCode { get; set; } = string.Empty; // Red, Orange, Yellow, Green, Blue
    public List<string> Triggers { get; set; } = new();
}

public class AllergyCheckRequest
{
    public int PatientId { get; set; }
    public string PrescribedMeds { get; set; } = string.Empty;
}

public class AllergyCheckResult
{
    public bool HasConflict { get; set; }
    public string KnownAllergies { get; set; } = string.Empty;
    public List<string> ConflictingMeds { get; set; } = new();
    public string WarningMessage { get; set; } = string.Empty;
}

public class ConsultationDischargeRequest
{
    public int VisitId { get; set; }
    public string Diagnosis { get; set; } = string.Empty;
    public string PrescribedMeds { get; set; } = string.Empty;
    public string? AllergyOverrideNote { get; set; }
    public string? DischargeSummary { get; set; }
    public string Action { get; set; } = "Discharge"; // Discharge or Admit
    public int? AssignBedId { get; set; } // If admitted
}

public class CreatePatientRequest
{
    public string FullName { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = "Male";
    public string BloodGroup { get; set; } = "O+";
    public string KnownAllergies { get; set; } = "None";
}
