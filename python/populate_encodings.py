#!/usr/bin/env python3
"""
One-time script to populate missing face_encoding values in database.
This will dramatically improve face recognition performance.

Usage:
    python populate_encodings.py
"""

import os
import json
import logging
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

import face_recognition
from config import config
from recognizer_service import get_db_conn, BACKEND_ROOT

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'populate_encodings_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def populate_missing_encodings():
    """
    One-time script to populate face_encoding in database for all staff members.
    This improves performance by avoiding file-based encoding generation.
    """
    logger.info("="*60)
    logger.info("Starting Face Encoding Population Process")
    logger.info("="*60)
    
    try:
        with get_db_conn() as conn:
            cur = conn.cursor()
            
            # Find staff with missing encodings
            logger.info("Querying database for staff with missing encodings...")
            cur.execute("""
                SELECT staff_id, full_name, face_image_path 
                FROM staff 
                WHERE is_active = TRUE 
                AND (face_encoding IS NULL OR face_encoding = '')
            """)
            
            missing_staff = cur.fetchall()
            total_missing = len(missing_staff)
            
            if total_missing == 0:
                logger.info("✅ All active staff already have face encodings!")
                return
            
            logger.info(f"Found {total_missing} staff members with missing encodings")
            logger.info("-"*60)
            
            success_count = 0
            failed_count = 0
            failed_staff = []
            
            for idx, (staff_id, full_name, face_image_path) in enumerate(missing_staff, 1):
                logger.info(f"[{idx}/{total_missing}] Processing {staff_id} - {full_name}")
                
                try:
                    if not face_image_path:
                        logger.warning(f"  ⚠️  No face image path for {staff_id}")
                        failed_count += 1
                        failed_staff.append((staff_id, full_name, "No image path"))
                        continue
                    
                    # Build absolute path
                    img_path = face_image_path if os.path.isabs(face_image_path) else os.path.join(BACKEND_ROOT, face_image_path)
                    
                    if not os.path.exists(img_path):
                        logger.warning(f"  ⚠️  Image file not found: {img_path}")
                        failed_count += 1
                        failed_staff.append((staff_id, full_name, f"File not found: {img_path}"))
                        continue
                    
                    logger.info(f"  📷 Loading image from: {img_path}")
                    
                    # Load image and generate encoding
                    image = face_recognition.load_image_file(img_path)
                    encodings = face_recognition.face_encodings(image)
                    
                    if not encodings:
                        logger.warning(f"  ⚠️  No face detected in image for {staff_id}")
                        failed_count += 1
                        failed_staff.append((staff_id, full_name, "No face detected in image"))
                        del image
                        continue
                    
                    # Convert encoding to JSON
                    encoding_json = json.dumps(encodings[0].tolist())
                    
                    # Update database
                    cur.execute("""
                        UPDATE staff 
                        SET face_encoding = %s 
                        WHERE staff_id = %s
                    """, (encoding_json, staff_id))
                    
                    logger.info(f"  ✅ Successfully populated encoding for {staff_id}")
                    success_count += 1
                    
                    # Clean up
                    del image
                    del encodings
                    
                except Exception as e:
                    logger.error(f"  ❌ Failed to generate encoding for {staff_id}: {str(e)}")
                    failed_count += 1
                    failed_staff.append((staff_id, full_name, str(e)))
                    continue
            
            # Commit all changes
            conn.commit()
            
            # Print summary
            logger.info("="*60)
            logger.info("SUMMARY")
            logger.info("="*60)
            logger.info(f"Total Staff Processed: {total_missing}")
            logger.info(f"✅ Success: {success_count}")
            logger.info(f"❌ Failed: {failed_count}")
            
            if failed_staff:
                logger.info("")
                logger.info("Failed Staff Members:")
                logger.info("-"*60)
                for staff_id, full_name, reason in failed_staff:
                    logger.info(f"  {staff_id} - {full_name}: {reason}")
            
            logger.info("="*60)
            logger.info("✅ Database encoding population complete!")
            logger.info("="*60)
            
            # Verify results
            cur.execute("""
                SELECT COUNT(*) 
                FROM staff 
                WHERE is_active = TRUE 
                AND (face_encoding IS NULL OR face_encoding = '')
            """)
            remaining = cur.fetchone()[0]
            
            if remaining > 0:
                logger.warning(f"⚠️  {remaining} staff members still have missing encodings")
            else:
                logger.info("✅ All active staff now have face encodings!")
            
    except Exception as e:
        logger.error(f"❌ Fatal error during encoding population: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def check_encoding_status():
    """Check and display current encoding status"""
    logger.info("Checking current encoding status...")
    
    try:
        with get_db_conn() as conn:
            cur = conn.cursor()
            
            # Get total active staff
            cur.execute("SELECT COUNT(*) FROM staff WHERE is_active = TRUE")
            total_active = cur.fetchone()[0]
            
            # Get staff with encodings
            cur.execute("""
                SELECT COUNT(*) 
                FROM staff 
                WHERE is_active = TRUE 
                AND face_encoding IS NOT NULL 
                AND face_encoding != ''
            """)
            with_encodings = cur.fetchone()[0]
            
            # Get staff without encodings
            cur.execute("""
                SELECT COUNT(*) 
                FROM staff 
                WHERE is_active = TRUE 
                AND (face_encoding IS NULL OR face_encoding = '')
            """)
            without_encodings = cur.fetchone()[0]
            
            logger.info("="*60)
            logger.info("ENCODING STATUS")
            logger.info("="*60)
            logger.info(f"Total Active Staff: {total_active}")
            logger.info(f"✅ With Encodings: {with_encodings} ({with_encodings/total_active*100:.1f}%)")
            logger.info(f"❌ Missing Encodings: {without_encodings} ({without_encodings/total_active*100:.1f}%)")
            logger.info("="*60)
            
            return without_encodings
            
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        return -1


if __name__ == '__main__':
    print("\n" + "="*60)
    print("Face Encoding Population Script")
    print("="*60 + "\n")
    
    # Check current status
    missing_count = check_encoding_status()
    
    if missing_count == 0:
        print("\n✅ All staff members already have face encodings!")
        print("No action needed.\n")
        sys.exit(0)
    elif missing_count < 0:
        print("\n❌ Error checking database status")
        sys.exit(1)
    
    # Ask for confirmation
    print(f"\nThis script will populate face encodings for {missing_count} staff members.")
    print("This process may take a few minutes.\n")
    
    response = input("Do you want to continue? (yes/no): ").lower().strip()
    
    if response not in ['yes', 'y']:
        print("\n❌ Operation cancelled by user\n")
        sys.exit(0)
    
    print("\n🚀 Starting encoding population...\n")
    
    try:
        populate_missing_encodings()
        print("\n✅ Process completed successfully!")
        print("You can now restart the face recognition service for improved performance.\n")
    except Exception as e:
        print(f"\n❌ Process failed: {str(e)}\n")
        sys.exit(1)





