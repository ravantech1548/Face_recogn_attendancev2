# Excel Export Example - Attendance Report with Summary Statistics

## What to Expect

When you download the Excel file from the Attendance Report, you'll get a workbook with three tabs:

---

## 📊 Tab 1: Overall Summary

This sheet provides a quick overview of all attendance data in your selected date range.

| Metric | Value |
|--------|-------|
| Total Days Worked | 45 |
| Total Hours | 362:30 |
| Total Regular Hours | 320:00 |
| Total Overtime Hours | 42:30 |
| Total Late Minutes | 135 |
| Total Work From Home Days | 8 |

**Use this for:**
- Quick executive summaries
- Monthly/quarterly reports
- Overall attendance trends

---

## 👥 Tab 2: Staff Summary

This sheet shows individual statistics for each employee.

| Staff ID | Staff Name | Department | Designation | Work Status | Days Worked | Total Hours | Regular Hours | Overtime Hours | Late Minutes | Work From Home Days |
|----------|-----------|------------|-------------|-------------|-------------|-------------|---------------|----------------|--------------|---------------------|
| EMP001 | John Smith | IT | Developer | Full-time | 15 | 122:00 | 120:00 | 02:00 | 15 | 2 |
| EMP002 | Jane Doe | HR | Manager | Full-time | 15 | 120:30 | 120:00 | 00:30 | 0 | 1 |
| EMP003 | Bob Wilson | Sales | Executive | Part-time | 15 | 120:00 | 120:00 | 00:00 | 30 | 0 |

**Use this for:**
- Individual performance tracking
- Payroll calculations
- Identifying attendance patterns per employee
- Work-from-home utilization

---

## 📋 Tab 3: Detailed Attendance

This sheet contains all the detailed attendance records (same as before).

| Date | Staff ID | Staff Name | Department | Check In Time | Check Out Time | Total Hours | Day Hours | Overtime Hours | Late Arrival (min) | Work From Home | ... |
|------|----------|-----------|------------|---------------|----------------|-------------|-----------|----------------|-------------------|----------------|-----|
| 2025-01-15 | EMP001 | John Smith | IT | 15/01/2025 09:05 | 15/01/2025 18:00 | 08:25 | 08:00 | 00:25 | 5 | No | ... |
| 2025-01-15 | EMP002 | Jane Doe | HR | 15/01/2025 08:58 | 15/01/2025 17:30 | 08:02 | 08:02 | 00:00 | 0 | No | ... |
| 2025-01-14 | EMP001 | John Smith | IT | 14/01/2025 09:00 | 14/01/2025 17:30 | 08:00 | 08:00 | 00:00 | 0 | Yes | ... |

**Use this for:**
- Detailed audit trail
- Day-by-day analysis
- Investigating specific attendance issues
- Compliance documentation

---

## 💡 Tips for Using the Export

### Excel Analysis Tips

1. **Sorting and Filtering**: All sheets support Excel's built-in sort and filter features
2. **Pivot Tables**: Use the Detailed Attendance sheet to create custom pivot tables
3. **Charts**: Create charts from the Staff Summary to visualize team performance
4. **Formulas**: All time values are stored as HH:MM text, but you can convert them for calculations

### Quick Calculations

To calculate total pay based on hours:
```excel
=HOUR(TIME_VALUE(cell)) + MINUTE(TIME_VALUE(cell))/60
```
This converts HH:MM format to decimal hours for calculations.

### Common Use Cases

**Monthly Payroll:**
1. Open the Staff Summary sheet
2. Use Total Hours for regular pay calculation
3. Use Overtime Hours for overtime pay
4. Reference Late Minutes for deductions (if applicable)

**Attendance Monitoring:**
1. Open the Staff Summary sheet
2. Sort by "Days Worked" to identify absence patterns
3. Sort by "Late Minutes" to identify punctuality issues
4. Filter by "Work From Home Days" to track remote work

**Detailed Investigation:**
1. Open the Detailed Attendance sheet
2. Filter by Staff ID to see one employee's records
3. Review check-in/check-out times for accuracy
4. Check "Attendance Notes" for manual entry reasons

---

## 🎯 Key Features

### Automatic Calculations
- ✅ Break time automatically deducted (for shifts > 4.5 hours)
- ✅ Regular hours capped at 8 hours per day
- ✅ Overtime calculated automatically
- ✅ Late arrivals tracked in minutes
- ✅ WFH days counted separately

### Time Format
- All hours displayed in **HH:MM** format (e.g., 08:30 for 8 hours 30 minutes)
- Minutes displayed as numbers (e.g., 15 for 15 minutes late)
- Dates in local format (e.g., 15/01/2025)

### Data Consistency
- All calculations match the system's business logic
- Same formulas used in the UI and exports
- Timezone-aware date handling
- Accurate to the minute

---

## 📝 Export Options

### By Date Range
- **Current Month**: Exports current month's data only
- **Last Month**: Exports previous month's data
- **All Records**: Exports all attendance records
- **Custom Range**: Select specific start and end dates

### By Staff (Admin Only)
- Select "All staff" for organization-wide summary
- Select specific staff for individual reports
- Non-admin users automatically see only their own data

### Format Options
- **Excel (.xlsx)**: Multi-sheet workbook with summaries ✨ NEW
- **CSV (.csv)**: Single file with detailed attendance only (no summaries)

---

## 🔒 Security & Privacy

- Non-admin users can only export their own attendance data
- Admin users can export any staff member's data or organization-wide reports
- All exports include only data within the selected date range
- Face recognition confidence scores included for audit purposes

---

## ❓ FAQs

**Q: Why are summary statistics different from what I see on screen?**  
A: The export includes ALL data in the selected date range, while the screen might be paginated. The summary calculations are accurate for the entire dataset.

**Q: Can I customize the summary calculations?**  
A: The summary calculations are based on system business logic (8-hour day, break time rules). Contact your administrator if you need custom calculations.

**Q: What if I need data in a different format?**  
A: Use the CSV export for importing into other systems. The Excel format is optimized for human review and analysis.

**Q: Are the summaries calculated in Excel or pre-calculated?**  
A: All summaries are pre-calculated on the server to ensure accuracy and consistency with the system's business logic.

**Q: Why doesn't CSV include summaries?**  
A: CSV format supports only single-sheet data. For summaries, use the Excel export option.

---

## 🚀 Next Steps

1. Try downloading a sample report for the current month
2. Review the Overall Summary for quick insights
3. Check the Staff Summary for individual performance
4. Drill into Detailed Attendance for specific investigations
5. Use Excel's features (sorting, filtering, pivot tables) for custom analysis

---

**Need Help?** Contact your system administrator or refer to the main user guide.

