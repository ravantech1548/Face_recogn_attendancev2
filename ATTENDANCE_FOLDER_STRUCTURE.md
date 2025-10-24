# Attendance Face Capture Folder Structure

## Overview

The attendance face capture images are now organized in a hierarchical folder structure for better organization and easy retrieval.

## Folder Structure

```
backend/uploads/attendance/
├── 2025/
│   ├── 24102025/
│   │   ├── attendance-EMP001-1729756800000.jpg
│   │   ├── attendance-EMP002-1729760400000.jpg
│   │   └── attendance-EMP003-1729764000000.png
│   ├── 25102025/
│   │   ├── attendance-EMP001-1729843200000.jpg
│   │   └── attendance-EMP004-1729846800000.jpg
│   └── 26102025/
│       └── attendance-EMP002-1729929600000.jpg
├── 2024/
│   ├── 31122024/
│   │   └── attendance-EMP001-1704038400000.jpg
│   └── ...
└── ...
```

## Folder Naming Convention

### Year Folder: `YYYY`
- **Format**: Four-digit year
- **Examples**: `2025`, `2024`, `2023`
- **Purpose**: Top-level organization by year

### Daily Folder: `DDMMYYYY`
- **Format**: Day (2 digits) + Month (2 digits) + Year (4 digits)
- **Examples**: 
  - `24102025` = October 24, 2025
  - `01012025` = January 1, 2025
  - `31122024` = December 31, 2024
- **Purpose**: Daily organization within each year

### File Naming: `attendance-{STAFF_ID}-{TIMESTAMP}.{EXT}`
- **Format**: attendance-[Staff ID]-[Unix Timestamp].[Extension]
- **Examples**:
  - `attendance-EMP001-1729756800000.jpg`
  - `attendance-MGR123-1729760400000.png`
- **Components**:
  - `attendance-`: Fixed prefix
  - `EMP001`: Staff ID from the attendance record
  - `1729756800000`: Unix timestamp (milliseconds since epoch)
  - `.jpg`: File extension (jpg, png, etc.)

## Benefits

### 1. **Easy Retrieval**
- Quickly locate images by date
- Navigate to specific year and day
- No need to search through thousands of files

### 2. **Performance**
- Faster file system operations
- Reduced directory size (max ~31 files per day per staff)
- Better OS file indexing

### 3. **Maintenance**
- Easy to archive old years
- Simple to backup specific date ranges
- Clear organization for audits

### 4. **Scalability**
- Supports unlimited staff members
- Handles high-volume organizations
- No file system limits issues

### 5. **Compliance**
- Clear audit trail by date
- Easy to export for legal requirements
- Simple retention policy implementation

## Implementation Details

### Automatic Folder Creation

The system automatically creates the required folder structure when:
1. A face capture is uploaded during check-in
2. A face capture is uploaded during check-out
3. The multer storage middleware processes the upload

No manual folder creation is needed!

### Path Storage in Database

The full relative path is stored in the database:
```
uploads/attendance/2025/24102025/attendance-EMP001-1729756800000.jpg
```

This ensures:
- Correct retrieval from the frontend
- Static file serving works properly
- Export links remain valid

### Date Calculation

The folder structure is based on **server date/time**:
- Uses `new Date()` to get current date
- Extracts year, month, and day
- Formats according to the naming convention
- Creates folders using `fs.mkdirSync` with `recursive: true`

## Frontend Integration

### Image Display

Frontend code remains unchanged! The stored path includes the full folder structure:

```javascript
// In AttendanceReport.jsx
<Avatar
  src={`${API_BASE_URL}/${record.check_in_face_image_path}`}
  // Resolves to: http://localhost:5000/uploads/attendance/2025/24102025/attendance-EMP001-...jpg
/>
```

### Static File Serving

The backend serves static files from the uploads directory:

```javascript
// In server.js (if configured)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

## Archive and Cleanup

### Archiving Old Years

To archive a specific year (e.g., 2023):
```bash
# Windows
Move-Item backend\uploads\attendance\2023 C:\Archives\attendance\2023

# Linux/Mac
mv backend/uploads/attendance/2023 /archives/attendance/2023
```

### Cleanup Script Example

Create a cleanup script to remove images older than X days:

```javascript
// cleanup-old-images.js
const fs = require('fs');
const path = require('path');

const attendanceDir = path.join(__dirname, 'uploads/attendance');
const retentionDays = 365; // Keep images for 1 year
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

// Implementation to remove old folders...
```

## Troubleshooting

### Issue: Images not displaying

**Check:**
1. Verify the path in the database matches the actual file location
2. Ensure static file serving is enabled in server.js
3. Check folder permissions (read/write)
4. Confirm the file exists: `ls backend/uploads/attendance/YYYY/DDMMYYYY/`

### Issue: Folder creation fails

**Check:**
1. Backend has write permissions to `uploads/` directory
2. Disk space is available
3. No file system corruption
4. Check server logs for detailed error messages

### Issue: Old flat structure images

**Migration:**
If you have old images in the flat structure (`uploads/attendance/*.jpg`), they will continue to work. New images will use the new structure. To migrate:

```bash
# Create migration script to move old images based on their date
# Example: Check file creation date and move to appropriate folder
```

## File System Limits

### Maximum Files Per Folder

With the daily folder structure:
- **Typical usage**: 2-10 files per day per staff (check-in + check-out)
- **Maximum reasonable**: ~100 files per day (for large organizations)
- **No file system limits**: Most file systems support 10,000+ files per directory

### Disk Space Considerations

Average file sizes:
- JPEG (compressed): 50-200 KB per image
- PNG (uncompressed): 200-500 KB per image

**Example calculation** for 100 employees:
- 100 staff × 2 captures/day × 100 KB = 20 MB per day
- 20 MB × 365 days = ~7.3 GB per year

### Backup Recommendations

1. **Daily**: Backup current day's folder
2. **Weekly**: Backup current month's folders
3. **Monthly**: Archive completed months
4. **Yearly**: Archive completed years to long-term storage

## Security Considerations

### Access Control

- Only authenticated users can upload images
- Only admins can trigger face captures via API
- Static file serving should validate authentication (if required)

### Data Privacy

- Images contain biometric data (faces)
- Ensure compliance with GDPR/privacy laws
- Implement retention policies
- Secure the uploads directory

### Recommended Permissions

```bash
# Linux/Mac
chmod 755 backend/uploads/attendance
chmod 755 backend/uploads/attendance/YYYY
chmod 644 backend/uploads/attendance/YYYY/DDMMYYYY/*.jpg

# Ensure only backend process can write
chown -R backend-user:backend-group backend/uploads/
```

## Migration from Old Structure

If you're migrating from the old flat structure to the new hierarchical structure:

### Step 1: Backup existing files
```bash
cp -r backend/uploads/attendance backend/uploads/attendance_backup
```

### Step 2: Update backend code
The code has been updated to use the new structure automatically.

### Step 3: Keep old files accessible
Old files with flat paths will still work. The new structure applies only to new uploads.

### Step 4: (Optional) Migrate old files
Create a migration script to move old files to the new structure based on their creation date or database records.

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Check disk space usage
2. **Monthly**: Review and archive completed months
3. **Quarterly**: Audit folder structure for anomalies
4. **Yearly**: Archive old years to long-term storage

### Monitoring

Monitor these metrics:
- Total disk space usage
- Number of files per day
- Failed upload attempts
- Missing image errors in logs

## Related Documentation

- [ATTENDANCE_EXPORT_SUMMARY.md](ATTENDANCE_EXPORT_SUMMARY.md) - Excel export with summaries
- [USER_GUIDE.md](USER_GUIDE.md) - General user guide
- [LIVENESS_DETECTION_README.md](LIVENESS_DETECTION_README.md) - Face recognition setup

---

**Last Updated**: October 24, 2025  
**Version**: 1.0

