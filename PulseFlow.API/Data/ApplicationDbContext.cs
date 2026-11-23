using Microsoft.EntityFrameworkCore;
using PulseFlow.API.Models;

namespace PulseFlow.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Ward> Wards => Set<Ward>();
    public DbSet<Bed> Beds => Set<Bed>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<TriageVisit> TriageVisits => Set<TriageVisit>();
    public DbSet<ClinicalRecord> ClinicalRecords => Set<ClinicalRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Bed -> CurrentPatient: OnDelete SetNull
        modelBuilder.Entity<Bed>()
            .HasOne(b => b.CurrentPatient)
            .WithMany()
            .HasForeignKey(b => b.CurrentPatientId)
            .OnDelete(DeleteBehavior.SetNull);

        // Bed -> Ward
        modelBuilder.Entity<Bed>()
            .HasOne(b => b.Ward)
            .WithMany(w => w.Beds)
            .HasForeignKey(b => b.WardId)
            .OnDelete(DeleteBehavior.Cascade);

        // Appointment: unique index on (DoctorId, AppointmentDate, SlotTime) to prevent double booking
        modelBuilder.Entity<Appointment>()
            .HasIndex(a => new { a.DoctorId, a.AppointmentDate, a.SlotTime })
            .IsUnique();

        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Patient)
            .WithMany()
            .HasForeignKey(a => a.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Doctor)
            .WithMany()
            .HasForeignKey(a => a.DoctorId)
            .OnDelete(DeleteBehavior.Restrict);

        // TriageVisit
        modelBuilder.Entity<TriageVisit>()
            .HasOne(tv => tv.Patient)
            .WithMany()
            .HasForeignKey(tv => tv.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TriageVisit>()
            .HasOne(tv => tv.AssignedDoctor)
            .WithMany()
            .HasForeignKey(tv => tv.AssignedDoctorId)
            .OnDelete(DeleteBehavior.SetNull);

        // ClinicalRecord
        modelBuilder.Entity<ClinicalRecord>()
            .HasOne(cr => cr.Visit)
            .WithMany()
            .HasForeignKey(cr => cr.VisitId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
