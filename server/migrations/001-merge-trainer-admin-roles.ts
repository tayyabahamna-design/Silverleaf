import { db } from "../db";
import { users, teachers, approvalHistory } from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Migration: Merge Trainer and Admin Roles
 *
 * This migration consolidates the "trainer" role into the "admin" role.
 * All users with role='trainer' will be updated to role='admin'.
 * All related records in approval_history and teachers tables will be updated.
 *
 * WARNING: This is a one-way migration. Backup your database before running!
 *
 * Run this migration with: node -r esbuild-register server/migrations/001-merge-trainer-admin-roles.ts
 */

async function runMigration() {
  console.log("Starting migration: Merge Trainer and Admin Roles...\n");

  try {
    // Step 1: Count current trainers
    console.log("Step 1: Counting current trainers...");
    const currentTrainers = await db
      .select()
      .from(users)
      .where(eq(users.role, "trainer"));

    console.log(`Found ${currentTrainers.length} trainer(s) to convert to admin.`);

    if (currentTrainers.length > 0) {
      console.log("\nTrainers to be converted:");
      currentTrainers.forEach((trainer) => {
        console.log(`  - ${trainer.username} (${trainer.email})`);
      });
    }

    // Step 2: Update all trainer roles to admin
    console.log("\nStep 2: Converting all trainers to admins...");
    const result1 = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.role, "trainer"));

    console.log(`✓ Updated ${currentTrainers.length} user(s) from trainer to admin.`);

    // Step 3: Update approval history records
    console.log("\nStep 3: Updating approval history records...");
    const result2 = await db
      .update(approvalHistory)
      .set({ performedByRole: "admin" })
      .where(eq(approvalHistory.performedByRole, "trainer"));

    console.log("✓ Updated approval history records.");

    // Step 4: Update teacher approval records
    console.log("\nStep 4: Updating teacher approval records...");
    const result3 = await db
      .update(teachers)
      .set({ approvedByRole: "admin" })
      .where(eq(teachers.approvedByRole, "trainer"));

    console.log("✓ Updated teacher approval records.");

    // Step 5: Verify migration
    console.log("\nStep 5: Verifying migration...");
    const remainingTrainers = await db
      .select()
      .from(users)
      .where(eq(users.role, "trainer"));

    if (remainingTrainers.length === 0) {
      console.log("✓ Verification passed: No trainers remain in database.");
    } else {
      console.error(`✗ Verification failed: ${remainingTrainers.length} trainer(s) still exist!`);
      process.exit(1);
    }

    // Step 6: Count new admins
    const totalAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"));

    console.log(`\n✓ Migration completed successfully!`);
    console.log(`  Total admins in database: ${totalAdmins.length}`);
    console.log(`  Converted ${currentTrainers.length} trainer(s) to admin.\n`);

  } catch (error) {
    console.error("\n✗ Migration failed with error:");
    console.error(error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("Migration script completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:");
      console.error(error);
      process.exit(1);
    });
}

export { runMigration };
