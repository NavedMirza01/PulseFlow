using PulseFlow.API.Models;

namespace PulseFlow.API.Data;

public static class DbInitializer
{
    public static void Seed(ApplicationDbContext context)
    {
        if (context.StaffMembers.Any()) return;

        var staff = new List<StaffMember>
        {
            new() { FullName = "Dr. Aarav Sharma", Role = "Doctor", Department = "Emergency & Trauma", IsOnDuty = true },
            new() { FullName = "Dr. Meera Nair", Role = "Doctor", Department = "Cardiology", IsOnDuty = true },
            new() { FullName = "Dr. Kabir Verma", Role = "Doctor", Department = "General Medicine", IsOnDuty = true },
            new() { FullName = "Priya Singh", Role = "Reception", Department = "Front Desk", IsOnDuty = true },
            new() { FullName = "Rohan Das", Role = "Admin", Department = "Hospital Ops", IsOnDuty = true }
        };
        context.StaffMembers.AddRange(staff);
        context.SaveChanges();

        var patients = new List<Patient>
        {
            new() { UHID = "PF-2026-101", FullName = "Vikram Malhotra", Age = 54, Gender = "Male", BloodGroup = "B+", KnownAllergies = "Penicillin, Aspirin" },
            new() { UHID = "PF-2026-102", FullName = "Ananya Gupta", Age = 29, Gender = "Female", BloodGroup = "O+", KnownAllergies = "Sulfa Drugs" },
            new() { UHID = "PF-2026-103", FullName = "Rajesh Kumar", Age = 62, Gender = "Male", BloodGroup = "A+", KnownAllergies = "None" },
            new() { UHID = "PF-2026-104", FullName = "Sneha Kapoor", Age = 36, Gender = "Female", BloodGroup = "AB-", KnownAllergies = "Ibuprofen" },
            new() { UHID = "PF-2026-105", FullName = "Mohit Verma", Age = 41, Gender = "Male", BloodGroup = "O-", KnownAllergies = "None" }
        };
        context.Patients.AddRange(patients);
        context.SaveChanges();

        var wards = new List<Ward>
        {
            new() { WardName = "Emergency (ER)", FloorNumber = 1, TotalCapacity = 6 },
            new() { WardName = "Intensive Care (ICU)", FloorNumber = 2, TotalCapacity = 4 },
            new() { WardName = "General Ward", FloorNumber = 3, TotalCapacity = 6 }
        };
        context.Wards.AddRange(wards);
        context.SaveChanges();

        var beds = new List<Bed>
        {
            new() { WardId = wards[0].WardId, BedCode = "ER-01", Status = "Occupied", CurrentPatientId = patients[0].PatientId, StatusUpdatedAt = DateTime.UtcNow.AddMinutes(-25) },
            new() { WardId = wards[0].WardId, BedCode = "ER-02", Status = "Cleaning", StatusUpdatedAt = DateTime.UtcNow.AddMinutes(-8) },
            new() { WardId = wards[0].WardId, BedCode = "ER-03", Status = "Available" },
            new() { WardId = wards[0].WardId, BedCode = "ER-04", Status = "Available" },
            new() { WardId = wards[1].WardId, BedCode = "ICU-01", Status = "Occupied", CurrentPatientId = patients[2].PatientId, StatusUpdatedAt = DateTime.UtcNow.AddHours(-3) },
            new() { WardId = wards[1].WardId, BedCode = "ICU-02", Status = "Available" },
            new() { WardId = wards[2].WardId, BedCode = "GEN-01", Status = "Available" },
            new() { WardId = wards[2].WardId, BedCode = "GEN-02", Status = "Cleaning", StatusUpdatedAt = DateTime.UtcNow.AddMinutes(-4) }
        };
        context.Beds.AddRange(beds);
        context.SaveChanges();

        var today = DateOnly.FromDateTime(DateTime.Today);
        context.Appointments.AddRange(
            new Appointment { PatientId = patients[1].PatientId, DoctorId = staff[1].StaffId, AppointmentDate = today, SlotTime = "10:30 AM", ConsultationType = "OPD", Status = "Booked", Reason = "Recurring palpitations" },
            new Appointment { PatientId = patients[3].PatientId, DoctorId = staff[2].StaffId, AppointmentDate = today, SlotTime = "11:00 AM", ConsultationType = "FollowUp", Status = "Booked", Reason = "Post-viral fever check" }
        );

        context.TriageVisits.AddRange(
            new TriageVisit { PatientId = patients[0].PatientId, AssignedDoctorId = staff[0].StaffId, ChiefComplaint = "Severe chest tightness & sweating", HeartRate = 128, BP = "165/100", SpO2 = 91, TriageLevel = 1, QueueStatus = "Waiting", CheckInTime = DateTime.UtcNow.AddMinutes(-12) },
            new TriageVisit { PatientId = patients[4].PatientId, AssignedDoctorId = staff[2].StaffId, ChiefComplaint = "High fever (103°F) & dizziness", HeartRate = 104, BP = "110/70", SpO2 = 96, TriageLevel = 3, QueueStatus = "Waiting", CheckInTime = DateTime.UtcNow.AddMinutes(-20) }
        );
        context.SaveChanges();
    }
}