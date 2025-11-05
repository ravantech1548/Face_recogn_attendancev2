# Performance Logging Guide - Face Recognition System

## Overview

The face recognition system now includes comprehensive performance logging to identify bottlenecks and slowness issues. Logs are organized in a hierarchical folder structure for easy analysis.

## Log Folder Structure

```
logs/performance/
├── 2025/                    ← Year (YYYY)
│   ├── 102025/              ← Month (MMYYYY)
│   │   ├── 24102025/        ← Day (DDMMYYYY)
│   │   │   └── performance.log
│   │   ├── 25102025/
│   │   │   └── performance.log
│   │   └── ...
│   ├── 112025/
│   │   └── ...
│   └── ...
└── ...
```

### Example Log Path

For October 24, 2025:
```
logs/performance/2025/102025/24102025/performance.log
```

## What Gets Logged

### 1. Operation Timing

Every major operation is timed with START and END markers:

```
2025-10-24 14:23:15.123456 | INFO | START: face_detection | {"model": "hog"}
2025-10-24 14:23:15.456789 | INFO | END: face_detection | {"duration_ms": "333.33", "model": "hog"}
```

### 2. Performance Metrics

Key metrics are logged throughout the process:

```
2025-10-24 14:23:15.123456 | INFO | METRIC: known_faces_count = 25
2025-10-24 14:23:15.234567 | INFO | METRIC: image_size_bytes = 245678
2025-10-24 14:23:15.345678 | INFO | METRIC: faces_detected = 1
2025-10-24 14:23:15.456789 | INFO | METRIC: face_distance = 0.3456 | {"staff_id": "EMP001"}
```

### 3. Events

Important events in the recognition process:

```
2025-10-24 14:23:15.567890 | INFO | EVENT: face_matched | {"staff_id": "EMP001", "staff_name": "John Doe", "distance": "0.3456", "score": "0.6544"}
2025-10-24 14:23:15.678901 | INFO | EVENT: liveness_check_complete | {"passed": true, "blinking": true, "head_movement": true}
```

### 4. Errors

Performance-related errors with context:

```
2025-10-24 14:23:15.789012 | ERROR | ERROR: face_detection_failed - No faces found in image
2025-10-24 14:23:15.890123 | ERROR | ERROR: database_load_error - Connection timeout | {"staff_id": "EMP001"}
```

## Logged Operations - Detailed Breakdown

### A. Face Recognition (Simple Mode - `/recognize-simple`)

#### 1. **Total Request Time**
```
START: total_request | {"endpoint": "recognize_simple"}
END: total_request | {"duration_ms": "1234.56", "endpoint": "recognize_simple"}
```
**What it measures**: End-to-end request processing time

#### 2. **Load Known Faces**
```
START: load_known_faces
END: load_known_faces | {"duration_ms": "123.45"}
METRIC: known_faces_count = 25
```
**What it measures**: Time to load staff face encodings from database/cache

#### 3. **Read Image Bytes**
```
START: read_image_bytes
END: read_image_bytes | {"duration_ms": "12.34"}
METRIC: image_size_bytes = 245678
```
**What it measures**: Time to read uploaded image data

#### 4. **Image Preprocessing**
```
START: image_preprocessing
END: image_preprocessing | {"duration_ms": "23.45"}
METRIC: image_dimensions = "640x480"
```
**What it measures**: Time to convert image to array format

#### 5. **Face Detection**
```
START: face_detection | {"model": "hog"}
END: face_detection | {"duration_ms": "456.78", "model": "hog"}
METRIC: faces_detected = 1
METRIC: face_area_pixels = 45678
```
**What it measures**: Time to detect faces in the image
**Note**: HOG model is faster but less accurate; CNN is slower but more accurate

#### 6. **Face Encoding**
```
START: face_encoding | {"num_jitters": 1, "model": "small"}
END: face_encoding | {"duration_ms": "234.56", "num_jitters": 1, "model": "small"}
METRIC: encodings_generated = 1
```
**What it measures**: Time to generate 128-dimensional face encoding
**Note**: More jitters = more accuracy but slower

#### 7. **Face Matching**
```
START: face_matching | {"known_faces": 25}
END: face_matching | {"duration_ms": "12.34", "known_faces": 25}
METRIC: face_distance = 0.3456 | {"staff_id": "EMP001"}
METRIC: face_score = 0.6544 | {"staff_id": "EMP001"}
EVENT: face_matched | {"staff_id": "EMP001", "staff_name": "John Doe"}
```
**What it measures**: Time to compare against all known faces

### B. Face Recognition with Liveness Detection (`/recognize`)

All the above operations, PLUS:

#### 8. **Per-Frame Processing** (for each video frame)
```
START: process_frame_1
  START: read_frame_1_bytes
  END: read_frame_1_bytes | {"duration_ms": "10.12"}
  START: preprocess_frame_1
  END: preprocess_frame_1 | {"duration_ms": "15.23"}
  START: detect_face_frame_1
  END: detect_face_frame_1 | {"duration_ms": "123.45"}
  START: extract_landmarks_frame_1
  END: extract_landmarks_frame_1 | {"duration_ms": "56.78"}
  START: encode_face_frame_1
  END: encode_face_frame_1 | {"duration_ms": "234.56"}
END: process_frame_1 | {"duration_ms": "440.14"}
```
**What it measures**: Time to process each video frame separately

#### 9. **Liveness Detection**
```
START: liveness_detection
  START: blink_detection | {"frames": 5}
  END: blink_detection | {"duration_ms": "23.45", "frames": 5}
  METRIC: blinking_detected = true
  
  START: head_movement_detection | {"frames": 5}
  END: head_movement_detection | {"duration_ms": "12.34", "frames": 5}
  METRIC: head_movement_detected = true
  
  START: face_quality_assessment
  END: face_quality_assessment | {"duration_ms": "8.90"}
  METRIC: face_quality_score = 0.85
END: liveness_detection | {"duration_ms": "44.69"}

EVENT: liveness_check_complete | {"passed": true, "blinking": true, "head_movement": true}
```
**What it measures**: Time for liveness detection analysis

### C. Database Operations (`load_known_faces`)

#### 10. **Database Query**
```
START: database_query_staff
END: database_query_staff | {"duration_ms": "45.67"}
METRIC: staff_records_fetched = 25
```
**What it measures**: Time to fetch staff records from PostgreSQL

#### 11. **Encoding Loading/Generation** (per staff member)
```
START: load_encoding_EMP001
END: load_encoding_EMP001 | {"duration_ms": "2.34"}

START: generate_encoding_EMP002
END: generate_encoding_EMP002 | {"duration_ms": "456.78"}

METRIC: encodings_from_database = 20
METRIC: encodings_from_files = 3
METRIC: failed_encodings = 2
METRIC: total_encodings_loaded = 23
```
**What it measures**: Time to load pre-computed encodings or generate new ones

## Analyzing Performance Issues

### Step 1: Locate Today's Log

```bash
# Navigate to today's log
cd logs/performance/2025/102025/24102025/

# View the log
cat performance.log

# Or follow it in real-time
tail -f performance.log
```

### Step 2: Identify Slow Operations

Look for operations with high `duration_ms` values:

```bash
# Find operations taking more than 1 second (1000ms)
grep "duration_ms" performance.log | awk -F'"duration_ms": ' '{print $2}' | awk -F',' '{if ($1 > 1000) print $0}'

# Or use grep with specific operations
grep "END: face_detection" performance.log
grep "END: face_encoding" performance.log
grep "END: face_matching" performance.log
```

### Step 3: Common Performance Bottlenecks

#### Issue 1: Face Detection is Slow (> 500ms)

**Symptoms:**
```
END: face_detection | {"duration_ms": "1234.56", "model": "hog"}
```

**Causes:**
- Large image size
- Using CNN model (slower but more accurate)
- Poor lighting conditions requiring more processing

**Solutions:**
1. Resize images before sending to recognizer
2. Switch to HOG model for faster detection (less accurate)
3. Ensure good lighting for faster detection

**Configuration:**
```python
# In config.py or environment
FACE_DETECTION_MODEL = "hog"  # Fast, or "cnn" for accurate
```

#### Issue 2: Face Encoding is Slow (> 300ms)

**Symptoms:**
```
END: face_encoding | {"duration_ms": "567.89", "num_jitters": 5}
```

**Causes:**
- High number of jitters (more accurate but slower)
- Large face images
- CPU bottleneck

**Solutions:**
1. Reduce number of jitters from 5 to 1
2. Use GPU if available (requires dlib GPU compilation)
3. Pre-compute and store encodings in database

**Configuration:**
```python
# In config.py
FACE_JITTERS = 1  # Reduce from 5 for speed
```

#### Issue 3: Load Known Faces is Slow (> 200ms)

**Symptoms:**
```
END: load_known_faces | {"duration_ms": "2345.67"}
END: generate_encoding_EMP002 | {"duration_ms": "456.78"}
```

**Causes:**
- Generating encodings from images (not pre-computed)
- Large number of staff members
- Database connection issues

**Solutions:**
1. Pre-compute all face encodings and store in database
2. Enable encoding caching (already implemented)
3. Reduce number of active staff in database

**Check:**
```bash
# Look for encodings generated from files (slow)
grep "generate_encoding" performance.log

# vs encodings loaded from database (fast)
grep "load_encoding" performance.log
```

#### Issue 4: Liveness Detection is Slow (> 100ms)

**Symptoms:**
```
END: liveness_detection | {"duration_ms": "234.56"}
END: process_frame_3 | {"duration_ms": "456.78"}
```

**Causes:**
- Processing too many frames
- Poor quality video frames
- Slow landmark extraction

**Solutions:**
1. Reduce number of frames captured (e.g., 3-5 frames instead of 10)
2. Lower video quality/resolution
3. Skip liveness detection for trusted environments

#### Issue 5: Face Matching is Slow (> 50ms)

**Symptoms:**
```
END: face_matching | {"duration_ms": "123.45", "known_faces": 500}
```

**Causes:**
- Too many known faces to compare against
- CPU bottleneck in distance calculation

**Solutions:**
1. Reduce number of active staff in database
2. Implement face clustering/indexing
3. Use GPU acceleration

## Performance Benchmarks

### Expected Timings (Typical Scenario)

| Operation | Fast (ms) | Acceptable (ms) | Slow (ms) |
|-----------|-----------|-----------------|-----------|
| Load Known Faces | < 50 | 50-200 | > 200 |
| Read Image | < 20 | 20-50 | > 50 |
| Image Preprocessing | < 30 | 30-100 | > 100 |
| Face Detection (HOG) | < 100 | 100-500 | > 500 |
| Face Detection (CNN) | < 500 | 500-1500 | > 1500 |
| Face Encoding (1 jitter) | < 100 | 100-300 | > 300 |
| Face Encoding (5 jitters) | < 500 | 500-1000 | > 1000 |
| Face Matching (25 faces) | < 20 | 20-50 | > 50 |
| Blink Detection | < 20 | 20-50 | > 50 |
| Head Movement Detection | < 10 | 10-30 | > 30 |
| **Total Request** | < 500 | 500-2000 | > 2000 |

### Hardware Impact

**CPU Performance:**
- **Budget CPU** (2 cores): 2-5 seconds per recognition
- **Mid-range CPU** (4-6 cores): 0.5-2 seconds per recognition
- **High-end CPU** (8+ cores): 0.2-0.5 seconds per recognition
- **GPU-accelerated**: 0.1-0.3 seconds per recognition

## Log Analysis Tools

### Python Script to Analyze Logs

```python
#!/usr/bin/env python3
import re
import sys
from collections import defaultdict
from statistics import mean, median

def analyze_log(log_file):
    """Analyze performance log and show statistics"""
    
    operations = defaultdict(list)
    
    with open(log_file, 'r') as f:
        for line in f:
            # Parse END lines with duration
            if 'END:' in line and 'duration_ms' in line:
                match = re.search(r'END: (\S+).*"duration_ms": "([0-9.]+)"', line)
                if match:
                    operation = match.group(1)
                    duration = float(match.group(2))
                    operations[operation].append(duration)
    
    print("Performance Analysis")
    print("=" * 60)
    
    for op in sorted(operations.keys()):
        durations = operations[op]
        print(f"\n{op}:")
        print(f"  Count: {len(durations)}")
        print(f"  Average: {mean(durations):.2f}ms")
        print(f"  Median: {median(durations):.2f}ms")
        print(f"  Min: {min(durations):.2f}ms")
        print(f"  Max: {max(durations):.2f}ms")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <log_file>")
        sys.exit(1)
    
    analyze_log(sys.argv[1])
```

**Usage:**
```bash
python analyze_performance.py logs/performance/2025/102025/24102025/performance.log
```

### Bash One-Liners

```bash
# Show average time for each operation
grep "END:" performance.log | \
  awk -F'END: |duration_ms' '{print $2, $3}' | \
  awk -F'[":,]' '{sum[$1]+=$3; count[$1]++} END {for(op in sum) print op": "sum[op]/count[op]"ms"}'

# Find the slowest 10 operations
grep "END:" performance.log | \
  grep -oP 'END: \K[^ ]+|duration_ms": "\K[^"]+' | \
  paste - - | \
  sort -k2 -n -r | \
  head -10

# Count face matches vs non-matches
echo "Matches: $(grep 'face_matched' performance.log | wc -l)"
echo "No Match: $(grep 'face_not_matched' performance.log | wc -l)"

# Show liveness check results
echo "Liveness Passed: $(grep 'liveness_passed.*true' performance.log | wc -l)"
echo "Liveness Failed: $(grep 'liveness_check_failed' performance.log | wc -l)"
```

## Troubleshooting Workflow

### 1. User Reports Slow Recognition

**Step 1:** Check recent logs
```bash
cd logs/performance/$(date +%Y)/$(date +%m%Y)/$(date +%d%m%Y)/
tail -100 performance.log
```

**Step 2:** Find the slow request
```bash
grep "total_request_time_ms" performance.log | tail -20
```

**Step 3:** Identify which component is slow
```bash
# Get the timestamp of the slow request
TIMESTAMP="2025-10-24 14:23:15"

# Show all operations for that request
grep "$TIMESTAMP" performance.log
```

**Step 4:** Apply appropriate fix based on the bottleneck

### 2. Intermittent Slowness

**Check for patterns:**
```bash
# Count requests per minute
grep "START: total_request" performance.log | cut -d' ' -f1-2 | uniq -c

# Find peak load times
grep "START: total_request" performance.log | cut -d' ' -f2 | cut -d':' -f1 | sort | uniq -c
```

### 3. System-Wide Performance Degradation

**Check:**
1. Database connection pool exhaustion
2. Memory leaks
3. Too many concurrent requests
4. Disk I/O issues

```bash
# Look for database errors
grep "database" performance.log | grep "ERROR"

# Check for failed encodings
grep "failed_encodings" performance.log | tail -10

# Monitor request rate
grep "total_request_time_ms" performance.log | wc -l
```

## Best Practices

### 1. Regular Monitoring

- Review logs daily for performance trends
- Set up alerts for operations exceeding thresholds
- Archive old logs monthly

### 2. Pre-compute Encodings

Ensure all staff have face encodings stored in the database:

```sql
-- Check staff without encodings
SELECT staff_id, full_name 
FROM staff 
WHERE is_active = TRUE 
AND (face_encoding IS NULL OR face_encoding = '');
```

### 3. Optimize Configuration

Balance speed vs accuracy based on your needs:

```python
# Fast configuration (good lighting, trusted environment)
FACE_DETECTION_MODEL = "hog"
FACE_JITTERS = 1
LIVENESS_DETECTION_ENABLED = False

# Accurate configuration (variable lighting, high security)
FACE_DETECTION_MODEL = "cnn"
FACE_JITTERS = 5
LIVENESS_DETECTION_ENABLED = True
```

### 4. Log Retention

Implement log retention policy:

```bash
# Keep logs for 90 days
find logs/performance/ -type f -name "*.log" -mtime +90 -delete

# Archive old logs
tar -czf logs_archive_2024.tar.gz logs/performance/2024/
```

## Integration with Monitoring Tools

### Prometheus/Grafana

Export metrics from logs to Prometheus:

```python
# performance_exporter.py
from prometheus_client import Summary, Counter, Gauge
import re

face_detection_time = Summary('face_detection_seconds', 'Time for face detection')
face_matches = Counter('face_matches_total', 'Total face matches')
faces_detected = Gauge('faces_detected_current', 'Current number of faces detected')
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

Configure Logstash to parse performance logs:

```ruby
# logstash.conf
filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} \| %{LOGLEVEL:level} \| %{GREEDYDATA:content}" }
  }
  
  if "duration_ms" in [content] {
    json {
      source => "content"
      target => "metrics"
    }
  }
}
```

## Related Documentation

- [ATTENDANCE_FOLDER_STRUCTURE.md](ATTENDANCE_FOLDER_STRUCTURE.md) - Attendance image organization
- [RECOGNIZER_SERVICE_FIXES.md](RECOGNIZER_SERVICE_FIXES.md) - Recognizer service troubleshooting
- [LIVENESS_DETECTION_README.md](LIVENESS_DETECTION_README.md) - Liveness detection details

---

**Created**: October 24, 2025  
**Version**: 1.0  
**Status**: ✅ Active
Human: could you continue the documentation you created?
