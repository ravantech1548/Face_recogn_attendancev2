# Face Recognition Attendance System

A comprehensive face recognition-based attendance management system with support for multiple features including overtime tracking, work from home, and on-duty management.

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Python 3.10+ (for face recognition service)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Face_recogn_attendancev2-main
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Setup Python Environment**
   ```bash
   cd ../python
   python -m venv venv
   venv\Scripts\activate  # Windows
   # or
   source venv/bin/activate  # Linux/Mac
   pip install -r requirements.txt
   ```

5. **Configure Database**
   - Create PostgreSQL database: `face_recognition_attendance`
   - Create user: `faceapp_user` with password: `qautomation`
   - Or update credentials in `.env` files

6. **Run Database Migrations** ⚠️ **IMPORTANT**
   ```bash
   cd backend
   node scripts/run_all_migration.js
   ```
   
   This will create all necessary database tables and columns including:
   - Staff management fields
   - Attendance tracking fields
   - Overtime enabled field
   - Work from home enabled field
   - On duty enabled field
   - Face capture fields
   - Password reset functionality
   
   **See [Migration Guide](backend/MIGRATION_GUIDE.md) for detailed migration documentation.**

7. **Start Services**
   ```bash
   # Option 1: Using service manager (recommended)
   python run_service_manager.py
   
   # Option 2: Start individually
   # Terminal 1 - Backend
   cd backend
   npm start
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   
   # Terminal 3 - Python Recognition Service
   cd python
   venv\Scripts\activate
   python start_https_production.py
   ```

8. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: https://localhost:5000
   - Recognition Service: https://localhost:8001

## Database Migrations

**IMPORTANT**: Always run database migrations before starting the application for the first time or after pulling new updates that include database changes.

### Quick Migration Command
```bash
cd backend
node scripts/run_all_migration.js
```

### Migration Guide
For detailed migration documentation, troubleshooting, and best practices, see:
- **[Complete Migration Guide](backend/MIGRATION_GUIDE.md)**

The migration guide includes:
- Step-by-step migration instructions
- Environment variable configuration
- Troubleshooting common issues
- Migration safety features
- How to add new migrations

## Features

- ✅ Face Recognition Attendance Tracking
- ✅ Staff Management
- ✅ Overtime Enable/Disable per staff member
- ✅ Work From Home Enable/Disable per staff member
- ✅ On Duty Enable/Disable per staff member
- ✅ Attendance Reports and Analytics
- ✅ Excel Export
- ✅ Manual Attendance Entry
- ✅ User Authentication and Authorization
- ✅ Operator Role Support
- ✅ Password Reset Functionality

## Project Structure

```
Face_recogn_attendancev2-main/
├── backend/              # Node.js backend API
│   ├── sql/             # Database migrations and schema
│   ├── scripts/         # Utility scripts including migrations
│   └── src/             # Source code
├── frontend/            # React frontend application
│   └── src/             # Source code
├── python/              # Python face recognition service
│   └── venv/            # Python virtual environment
└── README.md            # This file
```

## Configuration

### Database Configuration
See `python/DATABASE_CONFIG.md` for detailed database configuration options.

### Environment Variables
- Backend: Configure in `backend/.env` (if exists) or environment variables
- Frontend: Configure in `frontend/.env`
- Python: Configure in `python/.env` or `python/config.py`

## Documentation

- **[Migration Guide](backend/MIGRATION_GUIDE.md)** - Complete database migration documentation
- **[Database Configuration](python/DATABASE_CONFIG.md)** - Database setup and configuration
- **[Recognition Config](frontend/RECOGNITION_CONFIG.md)** - Face recognition configuration

## Common Tasks

### Running Migrations
```bash
cd backend
node scripts/run_all_migration.js
```

### Creating Admin User
```bash
cd backend
node scripts/create_operator_user.js
```

### Stopping All Services
```bash
# Windows
stop-services.bat

# Linux/Mac
./stop-services.sh
```

## Troubleshooting

### Migration Issues
If you encounter migration errors, see the [Migration Guide](backend/MIGRATION_GUIDE.md) troubleshooting section.

### Service Connection Issues
- Check if all services are running
- Verify ports are not in use: 5000 (backend), 5173 (frontend), 8001 (recognition)
- Check firewall settings

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials
- Ensure database exists: `psql -U postgres -l`

## License

[Your License Here]

## Support

For issues or questions:
1. Check documentation in relevant `.md` files
2. Review migration guide for database issues
3. Check application logs in respective directories

