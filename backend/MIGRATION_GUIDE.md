# Database Migration Guide

This guide explains how to run database migrations for the Face Recognition Attendance System.

## Overview

The system uses SQL migration files to manage database schema changes. Migrations are stored in the `backend/sql/` directory and can be run using the migration script.

## Available Migrations

The following migrations are available and will be run in order:

1. **migration_add_attendance_fields.sql** - Adds attendance tracking fields (notes, late arrival, early departure, work from home, etc.)
2. **migration_add_face_captures.sql** - Adds face capture image paths and confidence scores to attendance records
3. **migration_add_on_duty_enabled.sql** - Adds `on_duty_enabled` field to control "On Duty" manual attendance reason
4. **migration_add_overtime_enabled.sql** - Adds `overtime_enabled` field to control overtime eligibility for staff members
5. **migration_add_staff_work_fields.sql** - Adds work-related fields (work status, manager, work hours, break time, etc.)
6. **migration_add_password_reset.sql** - Adds password reset functionality fields

## Running Migrations

### Prerequisites

- Node.js installed
- PostgreSQL database running and accessible
- Database credentials configured (see Database Configuration below)

### Method 1: Run All Migrations (Recommended)

Run all migrations in the correct order using the migration script:

```bash
cd backend
node scripts/run_all_migration.js
```

This will:
- Execute all migration files in order
- Skip migrations that have already been applied (uses `IF NOT EXISTS` checks)
- Provide detailed output showing which migrations ran successfully
- Continue with remaining migrations if one fails (non-destructive)

**Expected Output:**
```
🚀 Starting database migration process...

📄 Running migration: migration_add_attendance_fields.sql...
✅ Migration migration_add_attendance_fields.sql completed successfully!

📄 Running migration: migration_add_face_captures.sql...
✅ Migration migration_add_face_captures.sql completed successfully!

📄 Running migration: migration_add_on_duty_enabled.sql...
✅ Migration migration_add_on_duty_enabled.sql completed successfully!

📄 Running migration: migration_add_overtime_enabled.sql...
✅ Migration migration_add_overtime_enabled.sql completed successfully!

📄 Running migration: migration_add_staff_work_fields.sql...
✅ Migration migration_add_staff_work_fields.sql completed successfully!

📄 Running migration: migration_add_password_reset.sql...
✅ Migration migration_add_password_reset.sql completed successfully!

🎉 All migrations completed!
```

### Method 2: Run from Project Root

You can also run the migration script from the project root directory:

```bash
node backend/scripts/run_all_migration.js
```

### Method 3: Run Individual Migration (Manual)

If you need to run a specific migration file manually, you can execute the SQL directly using `psql`:

```bash
psql -U faceapp_user -d face_recognition_attendance -f backend/sql/migration_add_overtime_enabled.sql
```

Or using the PostgreSQL command line:

```sql
\i backend/sql/migration_add_overtime_enabled.sql
```

## Database Configuration

The migration script uses the following default database connection settings:

- **Host**: `127.0.0.1`
- **Port**: `5432`
- **Database**: `face_recognition_attendance`
- **User**: `faceapp_user`
- **Password**: `qautomation`

### Using Environment Variables

You can override these defaults by setting environment variables:

```bash
# Windows PowerShell
$env:DB_USER="your_username"
$env:DB_HOST="your_host"
$env:DB_NAME="your_database"
$env:DB_PASSWORD="your_password"
$env:DB_PORT="5432"

# Then run migrations
node backend/scripts/run_all_migration.js
```

```bash
# Linux/Mac
export DB_USER="your_username"
export DB_HOST="your_host"
export DB_NAME="your_database"
export DB_PASSWORD="your_password"
export DB_PORT="5432"

# Then run migrations
node backend/scripts/run_all_migration.js
```

## Migration Details

### migration_add_overtime_enabled.sql

This migration adds the `overtime_enabled` field to the `staff` table.

**What it does:**
- Adds `overtime_enabled` BOOLEAN column (default: FALSE)
- Creates a constraint to ensure valid boolean values
- Creates an index for better query performance
- Sets default value (FALSE) for all existing staff records
- Adds a column comment for documentation

**Column Details:**
- **Name**: `overtime_enabled`
- **Type**: `BOOLEAN`
- **Default**: `FALSE`
- **Description**: Whether staff member is eligible for overtime tracking

**Usage:**
This field can be toggled in the Staff Management interface to enable/disable overtime eligibility for individual staff members.

### Other Migrations

For details on other migrations, refer to the comments in each migration file located in `backend/sql/`.

## Safety Features

The migration script includes several safety features:

1. **Idempotent**: Migrations can be run multiple times safely
2. **IF NOT EXISTS checks**: Prevents errors if columns/tables already exist
3. **Transaction-like behavior**: Each migration file is executed atomically
4. **Error handling**: Failed migrations are logged but don't stop other migrations
5. **Non-destructive**: Migrations only add new fields/tables, never delete data

## Troubleshooting

### Common Issues

#### 1. Connection Error
**Error**: `Connection refused` or `Authentication failed`

**Solution**:
- Verify PostgreSQL is running: `pg_isready` or check services
- Verify database credentials are correct
- Check if the database exists: `psql -U postgres -l`
- Ensure the user has necessary permissions

#### 2. Migration Already Applied
**Error**: Column already exists

**Solution**: This is normal and safe. The migration script uses `IF NOT EXISTS` checks, so you'll see warnings but the migration will continue.

#### 3. Permission Denied
**Error**: `permission denied for table staff`

**Solution**:
- Ensure the database user has ALTER TABLE permissions
- Grant necessary permissions: 
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE face_recognition_attendance TO faceapp_user;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO faceapp_user;
  ```

#### 4. Node.js Module Not Found
**Error**: `Cannot find module 'pg'`

**Solution**:
- Install backend dependencies: `cd backend && npm install`
- Verify `node_modules` exists in the backend directory

### Verification

After running migrations, you can verify the changes:

```sql
-- Check if overtime_enabled column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'staff' AND column_name = 'overtime_enabled';

-- Check all staff columns
\d staff

-- Check migration status
SELECT * FROM staff LIMIT 1;
```

## Best Practices

1. **Backup First**: Always backup your database before running migrations in production
   ```bash
   pg_dump -U faceapp_user face_recognition_attendance > backup_before_migration.sql
   ```

2. **Test in Development**: Run migrations on a development/test database first

3. **Review Migration Files**: Read the migration SQL files to understand what changes will be made

4. **Run During Maintenance**: Schedule migrations during maintenance windows for production systems

5. **Monitor After Migration**: Check application logs and functionality after migrations complete

## Adding New Migrations

When adding new migrations:

1. Create the migration file in `backend/sql/` directory
2. Follow naming convention: `migration_add_feature_name.sql`
3. Use `IF NOT EXISTS` checks for idempotency
4. Add the migration filename to the migrations array in `backend/scripts/run_all_migration.js`
5. Test the migration on a development database first
6. Update this documentation

Example migration structure:

```sql
-- Migration to add new_field to staff table

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff' AND column_name = 'new_field') THEN
        ALTER TABLE staff ADD COLUMN new_field VARCHAR(100);
    END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_staff_new_field ON staff(new_field);

-- Update existing records with default value
UPDATE staff SET new_field = 'default_value' WHERE new_field IS NULL;
```

## Related Documentation

- Database Configuration: See `python/DATABASE_CONFIG.md` for database setup details
- Staff Management: See frontend documentation for using overtime_enabled feature
- API Documentation: See backend routes for API endpoints

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review migration file comments
3. Check application logs
4. Verify database connection and permissions

