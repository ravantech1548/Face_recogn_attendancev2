#!/usr/bin/env python3
"""
Quick script to check face encoding status in database.

Usage:
    python check_encodings.py
"""

import os
import sys
import logging

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from recognizer_service import get_db_conn

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def check_encoding_status():
    """Check and display detailed encoding status"""
    
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
                SELECT staff_id, full_name, face_image_path
                FROM staff 
                WHERE is_active = TRUE 
                AND (face_encoding IS NULL OR face_encoding = '')
                ORDER BY staff_id
            """)
            without_encodings = cur.fetchall()
            
            # Display summary
            print("\n" + "="*70)
            print(" "*20 + "FACE ENCODING STATUS REPORT")
            print("="*70)
            print(f"\nTotal Active Staff Members: {total_active}")
            print(f"✅ Staff WITH encodings:    {with_encodings} ({with_encodings/total_active*100:.1f}%)")
            print(f"❌ Staff WITHOUT encodings: {len(without_encodings)} ({len(without_encodings)/total_active*100:.1f}%)")
            
            if without_encodings:
                print("\n" + "-"*70)
                print("Staff Members Missing Face Encodings:")
                print("-"*70)
                print(f"{'Staff ID':<15} {'Name':<30} {'Has Image':<10}")
                print("-"*70)
                
                for staff_id, full_name, image_path in without_encodings:
                    has_image = "Yes" if image_path else "No"
                    print(f"{staff_id:<15} {full_name:<30} {has_image:<10}")
                
                print("-"*70)
                print("\n⚠️  PERFORMANCE IMPACT:")
                print("   Staff without encodings will have slow recognition times.")
                print("   Each recognition will regenerate encoding from file (~200-500ms).")
                print("\n💡 RECOMMENDATION:")
                print("   Run: python populate_encodings.py")
                print("   This will populate all missing encodings and improve performance.\n")
            else:
                print("\n✅ All active staff members have face encodings!")
                print("   System is optimized for fast face recognition.\n")
            
            print("="*70 + "\n")
            
            # Check for staff with images but no encodings
            if without_encodings:
                with_images = sum(1 for _, _, img in without_encodings if img)
                without_images = len(without_encodings) - with_images
                
                if with_images > 0:
                    print(f"📊 Breakdown:")
                    print(f"   - {with_images} staff have images (can be populated)")
                    print(f"   - {without_images} staff missing images (need to upload)\n")
            
    except Exception as e:
        logger.error(f"\n❌ Error checking encoding status: {str(e)}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    check_encoding_status()





