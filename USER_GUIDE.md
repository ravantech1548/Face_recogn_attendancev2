# Face Recognition Attendance System - User Guide

This comprehensive user guide will help you understand and use all features of the Face Recognition Attendance System effectively.

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Staff Management](#staff-management)
4. [Face Attendance](#face-attendance)
5. [Attendance Reports](#attendance-reports)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## System Overview

The Face Recognition Attendance System is a modern, secure solution for tracking employee attendance using advanced facial recognition technology. The system offers two modes of operation:

- **Simple Face Recognition**: Quick and straightforward face detection
- **Liveness Detection**: Enhanced security with blinking and head movement verification

### Key Features
- 🔐 **Secure Authentication**: Face-based attendance marking
- 👥 **Staff Management**: Complete employee database management
- 📊 **Comprehensive Reports**: Detailed attendance analytics
- 🛡️ **Anti-Spoofing**: Liveness detection prevents photo/video attacks
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Real-time Updates**: Live attendance tracking

## Getting Started

### 1. Accessing the System

1. **Open your web browser** and navigate to the system URL
2. **Login** using your admin credentials
3. **Accept camera permissions** when prompted for face recognition features

### 2. Navigation Overview

The system has three main sections accessible from the top navigation:

- **🏠 Dashboard**: System overview and quick stats
- **👥 Staff**: Staff management and user account administration
- **📊 Reports**: Attendance reports and manual entry
- **🎯 Face Attendance**: Face recognition attendance marking

---

## Staff Management

The Staff Management section allows administrators to manage employee information, create user accounts, and configure work settings.

### Adding New Staff

#### Step 1: Access Staff Management
1. Click **"Staff"** in the top navigation
2. Click **"Add New Staff"** button

#### Step 2: Basic Information
Fill in the required basic information:

| Field | Description | Required |
|-------|-------------|----------|
| **Staff ID** | Unique identifier (e.g., EMP001) | ✅ Yes |
| **Full Name** | Complete name of the employee | ✅ Yes |
| **Email** | Work email address | ✅ Yes |
| **Designation** | Job title/position | ✅ Yes |
| **Department** | Department or team | ✅ Yes |

#### Step 3: Work Information
Configure work-related settings:

| Field | Description | Options |
|-------|-------------|---------|
| **Work Status** | Employment type | Full-time, Part-time, Contract |
| **Manager** | Direct manager's name | Free text |
| **Supervisor Name** | Supervisor's name | Free text |
| **Project Code** | Project or department code | Free text |
| **Work From Home Enabled** | Allow WFH attendance | Toggle On/Off |
| **ON DUTY Enabled** | Allow on-duty attendance | Toggle On/Off |
| **Break Time** | Daily break duration | 30 minutes, 1 hour |
| **Work Start Time** | Standard start time | Time picker (default: 09:15) |
| **Work End Time** | Standard end time | Time picker (default: 17:45) |

#### Step 4: Face Image Upload
1. Click **"Choose Face Image"** button
2. Select a clear, front-facing photo of the employee
3. **Requirements for face image:**
   - High resolution (minimum 640x480)
   - Good lighting
   - Face clearly visible
   - No sunglasses or face coverings
   - Front-facing angle

#### Step 5: User Account Creation (Optional)
1. Check **"Create login for this staff"**
2. Enter **Username** and **Password**
3. The system will create a user account for self-service access

#### Step 6: Save Staff
1. Click **"Add Staff"** to save
2. The system will process the face image and create face encodings
3. Staff will appear in the staff list

### Managing Existing Staff

#### Staff List Overview
The staff list displays comprehensive information:

| Column | Description |
|--------|-------------|
| **Staff ID** | Unique identifier |
| **Full Name** | Employee name |
| **Email** | Contact email |
| **Designation** | Job title |
| **Department** | Team/department |
| **Work Status** | Employment type (color-coded) |
| **Manager** | Direct manager |
| **WFH** | Work from home enabled |
| **Working Hours** | Standard work schedule |
| **User Account** | Login account status |
| **Status** | Active/Inactive |
| **Actions** | Edit, Delete, User Management |

#### Editing Staff Information
1. Click the **Edit** button (pencil icon) next to any staff member
2. Modify the required fields
3. Upload a new face image if needed
4. Click **"Update Staff"** to save changes

#### User Account Management
For each staff member, you can:

**Create User Account:**
1. Click the **three-dot menu** (⋮) next to staff member
2. Select **"Create User Account"**
3. Enter username, password, and role
4. Click **"Create Account"**

**Reset Password:**
1. Click the **three-dot menu** (⋮) next to staff member
2. Select **"Reset Password"**
3. Enter new password
4. Click **"Reset Password"**

**Delete User Account:**
1. Click the **three-dot menu** (⋮) next to staff member
2. Select **"Delete User Account"**
3. Confirm deletion

#### Deleting Staff
1. Click the **Delete** button (trash icon) next to staff member
2. Confirm deletion in the popup dialog
3. **Warning**: This action cannot be undone

---

## Face Attendance

The Face Attendance section provides two modes for marking attendance using facial recognition technology.

### Accessing Face Attendance
1. Click **"Face Attendance"** in the top navigation
2. The system will request camera permissions
3. Choose your preferred recognition mode

### Recognition Modes

#### Simple Face Recognition Mode
**Best for**: Quick attendance marking, trusted environments

**Features:**
- Single photo capture
- Fast processing
- Basic face detection
- Immediate results

**How to Use:**
1. Toggle **"Simple Face Recognition Only"** mode
2. Click **"Start Camera"**
3. Position your face in the camera view
4. Click **"Quick Capture"** or **"Start Face Recognition"**
5. Wait for recognition results
6. Attendance will be automatically marked

#### Liveness Detection Mode
**Best for**: High-security environments, preventing spoofing attacks

**Features:**
- Multi-frame capture (6 frames over 3 seconds)
- Blinking detection
- Head movement verification
- Face quality assessment
- Anti-spoofing protection

**How to Use:**
1. Toggle **"Liveness Detection (Blinking & Head Movement)"** mode
2. Click **"Start Camera"**
3. Click **"Start Liveness Detection"**
4. Follow the on-screen instructions:
   - **Blink naturally** during the 3-second capture
   - **Move your head slightly** (nod, shake, or turn)
   - **Look directly at the camera**
   - **Keep your face centered** in the frame
5. Wait for liveness verification
6. Face recognition will proceed automatically
7. Attendance will be marked upon successful match

### Progress Tracking

The system provides visual feedback through a progress stepper:

#### Simple Mode Steps:
1. **Start Camera** - Camera initialization
2. **Capture Face** - Single photo capture
3. **Face Recognition** - Processing and matching
4. **Attendance Marked** - Success confirmation

#### Liveness Mode Steps:
1. **Start Camera** - Camera initialization
2. **Capture Multiple Frames** - 6-frame sequence (3 seconds)
3. **Liveness Detection** - Blinking and movement analysis
4. **Face Recognition** - Processing and matching
5. **Attendance Marked** - Success confirmation

### Status Indicators

#### Liveness Detection Status:
- **Blinking Detected**: ✅/❌ - Natural blinking pattern verified
- **Head Movement**: ✅/❌ - Sufficient head movement detected
- **Face Quality**: Score percentage and size verification

#### Simple Recognition Status:
- **Face Detected**: ✅/❌ - Face found in image
- **Match Found**: ✅/❌ - Face matched with database

### Alternative: Image Upload

If camera access is not available:
1. Click **"Upload Image to Recognize"**
2. Select a clear photo from your device
3. The system will process the uploaded image
4. Follow the same recognition process

### Success Confirmation

Upon successful attendance marking, you'll see:
- **Success popup** with staff details
- **Toast notification** with confirmation
- **Confidence score** of the match
- **Attendance type** (Check-in/Check-out)

---

## Attendance Reports

The Attendance Reports section provides comprehensive analytics and manual attendance management.

### Accessing Reports
1. Click **"Reports"** in the top navigation
2. The system will load attendance data based on your role

### Report Views

#### Admin View
Administrators can:
- View all staff attendance
- Perform manual attendance actions
- Export reports in multiple formats
- Access detailed analytics

#### User View
Regular users can:
- View their own attendance records
- See personal statistics
- Export their own data

### Manual Attendance Actions (Admin Only)

#### Adding Manual Attendance
1. **Select Staff**: Choose employee from dropdown
2. **Set Date/Time** (Optional):
   - Toggle **"Use custom date/time"** for backdating
   - Select date and time
3. **Choose Reason** (Check-in only):
   - **On Duty**: Regular work attendance
   - **Work From Home**: Remote work (if enabled for staff)
   - **Face Detection Failure**: Technical issues
   - **Others**: Custom reason with details
4. **Add Notes** (if "Others" selected)
5. **Click "Check In"** or **"Check Out"**

#### Available Reasons by Staff Settings:
- **On Duty**: Available for all staff
- **Work From Home**: Only if staff has WFH enabled
- **Face Detection Failure**: Available for all staff
- **Others**: Available for all staff

### Date Filtering

#### Quick Filters:
- **Current Month**: Shows current month records
- **Last Month**: Shows previous month records
- **All Records**: Shows all historical data

#### Custom Date Range:
1. Select **"Custom Start Date"**
2. Select **"Custom End Date"**
3. Data will update automatically

#### Staff Filtering (Admin):
1. Select specific staff from dropdown
2. Choose **"All staff"** to see everyone
3. Filter updates in real-time

### Summary Statistics

The system displays key metrics:

| Metric | Description |
|--------|-------------|
| **Days Worked** | Total working days |
| **Total Hours** | Sum of all working hours |
| **Regular Hours** | Standard work hours |
| **Overtime Hours** | Extra hours worked |
| **Late Minutes** | Total late arrival time |
| **WFH Days** | Work from home days |

### Detailed Report Table

#### Column Descriptions:

| Column | Description |
|--------|-------------|
| **Date** | Attendance date |
| **Staff** | Employee name and ID |
| **Department** | Staff department |
| **Work Status** | Employment type |
| **Manager** | Direct manager |
| **Project Code** | Project assignment |
| **Check In** | Check-in time |
| **Check Out** | Check-out time |
| **Total Hours** | Daily total hours |
| **Day Hours** | Regular work hours |
| **Overtime** | Overtime hours |
| **Late Arrival** | Minutes late |
| **Early Departure** | Minutes early |
| **Break Time** | Break duration |
| **WFH** | Work from home status |
| **Notes** | Attendance notes |
| **Face Captures** | Check-in/out face images |
| **Status** | Attendance status |

#### Face Capture Audit:
- Click on face avatars to view captured images
- See confidence scores for each capture
- Verify attendance authenticity

### Exporting Reports

#### Available Formats:
- **Excel (.xlsx)**: Full-featured spreadsheet
- **CSV (.csv)**: Comma-separated values

#### Export Process:
1. Set desired filters (date range, staff)
2. Click **"Excel"** or **"CSV"** button
3. File downloads automatically
4. Filename includes filter information

#### Export Filenames:
- `attendance_report_current_month_2024_01.xlsx`
- `attendance_report_last_month_2023_12.xlsx`
- `attendance_report_all_records.xlsx`
- `attendance_report_staff_EMP001.xlsx`

### Real-time Updates

- Reports update automatically when new attendance is recorded
- Manual entries appear immediately
- Face recognition attendance syncs in real-time
- Statistics recalculate automatically

---

## Troubleshooting

### Common Issues and Solutions

#### Camera Access Issues
**Problem**: Camera not working or permission denied
**Solutions**:
1. Check browser permissions for camera access
2. Ensure camera is not being used by another application
3. Try refreshing the page
4. Use image upload as alternative

#### Face Recognition Failures
**Problem**: Face not recognized or low confidence
**Solutions**:
1. Ensure good lighting conditions
2. Position face directly in front of camera
3. Remove glasses, hats, or face coverings
4. Try liveness detection mode for better accuracy
5. Re-upload face image in staff management

#### Liveness Detection Failures
**Problem**: Liveness check fails repeatedly
**Solutions**:
1. **Blink naturally** during capture
2. **Move head slightly** (nod or shake)
3. **Look directly at camera**
4. **Ensure good lighting**
5. **Keep face centered** in frame
6. Try simple recognition mode as fallback

#### Network Connectivity Issues
**Problem**: Service unavailable or timeout errors
**Solutions**:
1. Check internet connection
2. Verify system is running
3. Try refreshing the page
4. Contact system administrator

#### Manual Attendance Issues
**Problem**: Cannot add manual attendance
**Solutions**:
1. Ensure you have admin privileges
2. Select a valid staff member
3. Choose appropriate reason for check-in
4. Provide details if "Others" is selected

### Error Messages

#### "No matching face found in database"
- Face not registered in system
- Poor image quality
- Face not clearly visible
- **Solution**: Re-register face or use manual attendance

#### "Liveness check failed"
- Insufficient blinking detected
- No head movement detected
- Poor face quality
- **Solution**: Follow liveness instructions carefully

#### "Network error: Unable to connect to recognition service"
- Recognition service is down
- Network connectivity issues
- **Solution**: Contact administrator or try later

#### "Authentication Required"
- Session expired
- Invalid login credentials
- **Solution**: Log in again

---

## Best Practices

### For Administrators

#### Staff Management:
1. **Use high-quality photos** for face registration
2. **Keep staff information updated** regularly
3. **Enable appropriate work modes** (WFH, On Duty) per staff
4. **Create user accounts** for staff who need self-service access
5. **Regularly review and clean up** inactive staff records

#### System Maintenance:
1. **Monitor system performance** regularly
2. **Backup data** on a regular schedule
3. **Update staff photos** when appearance changes significantly
4. **Review attendance reports** for anomalies
5. **Train staff** on proper usage

### For Users

#### Face Recognition:
1. **Use consistent lighting** when marking attendance
2. **Position face properly** in camera view
3. **Follow liveness detection instructions** carefully
4. **Report issues** to administrators promptly
5. **Use manual attendance** as backup when needed

#### General Usage:
1. **Log out** when finished
2. **Keep browser updated** for best compatibility
3. **Use supported browsers** (Chrome, Firefox, Safari, Edge)
4. **Report technical issues** immediately
5. **Follow company attendance policies**

### Security Best Practices

#### Face Recognition Security:
1. **Use liveness detection** in high-security areas
2. **Regularly update face images** for accuracy
3. **Monitor for unusual patterns** in attendance
4. **Implement proper access controls**
5. **Train staff on security awareness**

#### System Security:
1. **Use strong passwords** for admin accounts
2. **Regularly update system** components
3. **Monitor access logs** for suspicious activity
4. **Implement proper backup procedures**
5. **Follow data protection regulations**

### Performance Optimization

#### System Performance:
1. **Use appropriate image sizes** (not too large)
2. **Ensure good lighting** for better recognition
3. **Close unnecessary browser tabs** during use
4. **Use wired internet** for better stability
5. **Regularly clear browser cache**

#### Recognition Accuracy:
1. **Use front-facing photos** for registration
2. **Ensure consistent lighting** in work area
3. **Remove face obstructions** (glasses, masks)
4. **Update photos** when appearance changes
5. **Use liveness detection** for critical applications

---

## Support and Contact

### Getting Help
- **System Issues**: Contact your IT administrator
- **User Training**: Request training sessions
- **Feature Requests**: Submit through proper channels
- **Bug Reports**: Report through support system

### Documentation
- **Installation Guide**: For system setup
- **Technical Documentation**: For developers
- **API Documentation**: For integrations
- **Security Guidelines**: For compliance

### Updates and Maintenance
- **Regular Updates**: System improvements and bug fixes
- **Security Patches**: Critical security updates
- **Feature Releases**: New functionality additions
- **Maintenance Windows**: Scheduled system maintenance

---

*This user guide covers the main features of the Face Recognition Attendance System. For additional support or advanced configuration, please contact your system administrator.*

