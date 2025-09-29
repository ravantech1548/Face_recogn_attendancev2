import os
import io
import json
import time
import gc
import logging
import traceback
from typing import Dict, List, Tuple
from contextlib import contextmanager

from flask import Flask, request, jsonify
from PIL import Image
import numpy as np
import face_recognition
import psycopg2
import ssl
from psycopg2 import pool

from liveness import is_blinking, has_head_movement, detect_face_quality
from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.service.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config.service.log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Base directory for stored face images relative to repository root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND_ROOT = os.path.join(REPO_ROOT, 'backend')

# Global connection pool
connection_pool = None

def init_connection_pool():
    """Initialize database connection pool"""
    global connection_pool
    try:
        connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=config.database.min_connections,
            maxconn=config.database.max_connections,
            **config.database.get_connection_params()
        )
        logger.info(f"Database connection pool initialized with {config.database.min_connections}-{config.database.max_connections} connections")
    except Exception as e:
        logger.error(f"Failed to initialize connection pool: {e}")
        raise

@contextmanager
def get_db_conn():
    """Get database connection from pool with proper cleanup"""
    conn = None
    try:
        if connection_pool is None:
            init_connection_pool()
        conn = connection_pool.getconn()
        yield conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            connection_pool.putconn(conn)

def cleanup_resources():
    """Clean up resources to prevent memory leaks"""
    try:
        gc.collect()
        logger.debug("Memory cleanup completed")
    except Exception as e:
        logger.warning(f"Error during cleanup: {e}")


def load_known_faces() -> Tuple[List[np.ndarray], List[str], Dict[str, Dict[str, str]]]:
    """Load known faces from database with proper error handling"""
    try:
        with get_db_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT staff_id, full_name, COALESCE(face_encoding, ''), COALESCE(face_image_path, '')
                FROM staff
                WHERE is_active = TRUE
                """
            )
            rows = cur.fetchall()
    except Exception as e:
        logger.error(f"Error loading known faces: {e}")
        return [], [], {}

    encodings: List[np.ndarray] = []
    staff_ids: List[str] = []
    staff_meta: Dict[str, Dict[str, str]] = {}

    for staff_id, full_name, face_encoding_text, face_image_path in rows:
        encoding_loaded = False
        try:
            if face_encoding_text:
                try:
                    arr = np.array(json.loads(face_encoding_text), dtype='float64')
                    if arr.ndim == 1 and arr.shape[0] == 128:
                        encodings.append(arr)
                        staff_ids.append(staff_id)
                        staff_meta[staff_id] = {"full_name": full_name}
                        encoding_loaded = True
                except Exception as e:
                    logger.warning(f"Failed to load encoding for {staff_id}: {e}")
            
            if not encoding_loaded and face_image_path:
                # Build absolute path if relative like 'uploads/faces/...'
                img_path = face_image_path
                if not os.path.isabs(img_path):
                    img_path = os.path.join(BACKEND_ROOT, img_path)
                if os.path.exists(img_path):
                    try:
                        image = face_recognition.load_image_file(img_path)
                        encs = face_recognition.face_encodings(image)
                        if encs:
                            encodings.append(encs[0])
                            staff_ids.append(staff_id)
                            staff_meta[staff_id] = {"full_name": full_name}
                            # Clean up image data
                            del image
                    except Exception as e:
                        logger.warning(f"Failed to process image for {staff_id}: {e}")
        except Exception as e:
            logger.error(f"Error processing staff {staff_id}: {e}")
            continue

    # Clean up resources
    cleanup_resources()
    logger.info(f"Loaded {len(encodings)} known faces")
    return encodings, staff_ids, staff_meta


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@app.route('/recognize', methods=['OPTIONS'])
def recognize_options():
    return ('', 204)


@app.route('/reload', methods=['OPTIONS'])
def reload_options():
    return ('', 204)


@app.route('/health', methods=['OPTIONS'])
def health_options():
    return ('', 204)


@app.route('/recognize-simple', methods=['OPTIONS'])
def recognize_simple_options():
    return ('', 204)


class FaceStore:
    def __init__(self):
        self.encodings: List[np.ndarray] = []
        self.staff_ids: List[str] = []
        self.staff_meta: Dict[str, Dict[str, str]] = {}
        self.last_loaded = 0.0

    def ensure_loaded(self, force: bool = False):
        now = time.time()
        if force or (now - self.last_loaded > 60) or not self.encodings:
            self.encodings, self.staff_ids, self.staff_meta = load_known_faces()
            self.last_loaded = now


store = FaceStore()


@app.get('/health')
def health():
    return jsonify({"status": "ok", "known": len(store.staff_ids)})


@app.post('/reload')
def reload_data():
    store.ensure_loaded(force=True)
    return jsonify({"reloaded": True, "known": len(store.staff_ids)})


@app.post('/liveness-check')
def liveness_check():
    """
    Endpoint specifically for liveness detection without face recognition.
    Useful for testing liveness detection separately.
    """
    face_locations_list = []
    face_landmarks_list = []
    processed_images = []
    
    try:
        logger.info(f"Liveness check request received. Files: {list(request.files.keys())}")
        
        if 'images' not in request.files:
            logger.warning("No 'images' field in request files")
            return jsonify({"message": "'images' field with multiple image files required"}), 400

        image_files = request.files.getlist('images')
        if not image_files:
            return jsonify({"message": "No images provided"}), 400

        for i, file in enumerate(image_files):
            try:
                image_bytes = file.read()
                if not image_bytes:
                    continue

                pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                img_array = np.array(pil_image)
                processed_images.append((pil_image, img_array))

                # Face detection
                face_locations = face_recognition.face_locations(img_array, model=config.service.face_detection_model)
                if not face_locations:
                    continue
                face_locations_list.append(face_locations[0])

                # Face landmarks for liveness detection
                face_landmarks = face_recognition.face_landmarks(img_array, face_locations)
                if face_landmarks:
                    face_landmarks_list.append(face_landmarks[0])
                    
            except Exception as e:
                logger.error(f"Error processing image {i}: {e}")
                continue

        if not face_landmarks_list:
            return jsonify({"message": "No faces detected in any of the provided images"}), 400

        # Liveness Detection
        liveness_details = {
            "blinking_detected": False,
            "head_movement_detected": False,
            "face_quality": {},
            "total_frames": len(face_landmarks_list)
        }

        try:
            if face_landmarks_list:
                liveness_details["blinking_detected"] = bool(is_blinking(face_landmarks_list))
                liveness_details["face_quality"] = detect_face_quality(face_landmarks_list[0], face_locations_list[0])

            if face_locations_list:
                liveness_details["head_movement_detected"] = bool(has_head_movement(face_locations_list))
        except Exception as e:
            logger.error(f"Error in liveness detection: {e}")
            return jsonify({"message": f"Liveness detection error: {str(e)}"}), 500

        # Overall liveness assessment - require both blinking and head movement
        liveness_passed = (liveness_details["blinking_detected"] and 
                          liveness_details["head_movement_detected"])

        return jsonify({
            "liveness_passed": liveness_passed,
            "liveness_details": liveness_details
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in liveness_check: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500
    finally:
        # Clean up resources
        for pil_image, img_array in processed_images:
            try:
                del pil_image
                del img_array
            except:
                pass
        cleanup_resources()


@app.post('/recognize-simple')
def recognize_simple():
    """
    Simple face recognition endpoint without liveness detection.
    Takes a single image and returns recognition results.
    """
    pil_image = None
    img_array = None
    
    try:
        store.ensure_loaded()
        
        logger.info(f"Simple recognize request received. Files: {list(request.files.keys())}")
        
        if 'image' not in request.files:
            return jsonify({"message": "image field required"}), 400
            
        file = request.files['image']
        image_bytes = file.read()
        if not image_bytes:
            return jsonify({"message": "empty image"}), 400

        pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_array = np.array(pil_image)
        faces = face_recognition.face_locations(img_array, model=config.service.face_detection_model)
        if not faces:
            return jsonify({"matches": []})

        encs = face_recognition.face_encodings(img_array, faces, num_jitters=config.service.face_jitters, model=config.service.face_encoding_model)
        if not encs:
            return jsonify({"matches": []})

        # Use the first detected face
        enc = encs[0]
        (top, right, bottom, left) = faces[0]

        results = []
        if store.encodings:
            try:
                distances = face_recognition.face_distance(store.encodings, enc)
                best_idx = int(np.argmin(distances))
                best_dist = float(distances[best_idx])
                staff_id = store.staff_ids[best_idx]
                meta = store.staff_meta.get(staff_id, {})
                # Convert distance to a rough similarity score
                score = max(0.0, 1.0 - best_dist)
                matched = best_dist < config.service.face_distance_threshold
                results.append({
                    "staffId": staff_id,
                    "fullName": meta.get("full_name", staff_id),
                    "bbox": [left, top, right, bottom],
                    "distance": best_dist,
                    "score": score,
                    "matched": matched,
                    "liveness_passed": True,  # Always true for simple mode
                    "liveness_details": {
                        "blinking_detected": False,
                        "head_movement_detected": False,
                        "face_quality": {}
                    }
                })
            except Exception as e:
                logger.error(f"Error in face matching: {e}")
                return jsonify({"message": f"Face matching error: {str(e)}"}), 500

        return jsonify({"matches": results})
        
    except Exception as e:
        logger.error(f"Unexpected error in recognize_simple: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500
    finally:
        # Clean up resources
        if pil_image:
            try:
                del pil_image
            except:
                pass
        if img_array is not None:
            try:
                del img_array
            except:
                pass
        cleanup_resources()


@app.post('/recognize')
def recognize():
    face_locations_list = []
    face_landmarks_list = []
    face_encodings_list = []
    processed_images = []
    
    try:
        store.ensure_loaded()
        
        logger.info(f"Recognize request received. Files: {list(request.files.keys())}")
        
        # Check if single image or multiple images for liveness detection
        if 'images' in request.files:
            # Multiple images for liveness detection
            image_files = request.files.getlist('images')
            if not image_files:
                return jsonify({"message": "No images provided"}), 400
            
            for i, file in enumerate(image_files):
                try:
                    image_bytes = file.read()
                    if not image_bytes:
                        continue
                        
                    pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                    img_array = np.array(pil_image)
                    processed_images.append((pil_image, img_array))
                    
                    # Face detection with configured model
                    face_locations = face_recognition.face_locations(img_array, model=config.service.face_detection_model)
                    if not face_locations:
                        logger.debug(f"No faces detected in image {i + 1}")
                        continue
                    
                    # Take the largest face if multiple faces detected
                    largest_face = max(face_locations, key=lambda face: (face[2] - face[0]) * (face[3] - face[1]))
                    face_locations_list.append(largest_face)
                    
                    # Face landmarks for liveness detection
                    face_landmarks = face_recognition.face_landmarks(img_array, [largest_face])
                    if face_landmarks:
                        face_landmarks_list.append(face_landmarks[0])
                    
                    # Face encodings for recognition
                    face_encodings = face_recognition.face_encodings(img_array, [largest_face], num_jitters=config.service.face_jitters, model=config.service.face_encoding_model)
                    if face_encodings:
                        face_encodings_list.append(face_encodings[0])
                        
                except Exception as e:
                    logger.error(f"Error processing image {i}: {e}")
                    continue
            
            if not face_encodings_list:
                return jsonify({"message": "No faces detected in any of the provided images"}), 400
            
            # Liveness Detection
            liveness_passed = False
            liveness_details = {
                "blinking_detected": False,
                "head_movement_detected": False,
                "face_quality": {}
            }
            
            try:
                if face_landmarks_list:
                    liveness_details["blinking_detected"] = bool(is_blinking(face_landmarks_list))
                    liveness_details["face_quality"] = detect_face_quality(face_landmarks_list[0], face_locations_list[0])
                
                if face_locations_list:
                    liveness_details["head_movement_detected"] = bool(has_head_movement(face_locations_list))
            except Exception as e:
                logger.error(f"Error in liveness detection: {e}")
                return jsonify({"message": f"Liveness detection error: {str(e)}"}), 500
            
            # Require both blinking and head movement for liveness
            liveness_passed = (liveness_details["blinking_detected"] and 
                              liveness_details["head_movement_detected"])
            
            if not liveness_passed:
                return jsonify({
                    "message": "Liveness check failed",
                    "liveness_details": liveness_details
                }), 403
            
            # Face Recognition (using the first detected face encoding)
            enc = face_encodings_list[0]
            (top, right, bottom, left) = face_locations_list[0]
            
        else:
            # Single image (legacy support)
            if 'image' not in request.files:
                return jsonify({"message": "image field required"}), 400
            file = request.files['image']
            image_bytes = file.read()
            if not image_bytes:
                return jsonify({"message": "empty image"}), 400

            try:
                pil = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                img = np.array(pil)
                processed_images.append((pil, img))
                
                faces = face_recognition.face_locations(img, model=config.service.face_detection_model)
                if not faces:
                    return jsonify({"matches": []})
                
                encs = face_recognition.face_encodings(img, faces, num_jitters=config.service.face_jitters, model=config.service.face_encoding_model)
                face_landmarks = face_recognition.face_landmarks(img, faces)
                
                # Basic liveness check for single image
                liveness_passed = True
                liveness_details = {
                    "blinking_detected": False,
                    "head_movement_detected": False,
                    "face_quality": {}
                }
                
                if face_landmarks:
                    liveness_details["face_quality"] = detect_face_quality(face_landmarks[0], faces[0])
                
                enc = encs[0]
                (top, right, bottom, left) = faces[0]
            except Exception as e:
                logger.error(f"Error processing single image: {e}")
                return jsonify({"message": f"Image processing error: {str(e)}"}), 500

        results = []
        if store.encodings:
            try:
                distances = face_recognition.face_distance(store.encodings, enc)
                best_idx = int(np.argmin(distances))
                best_dist = float(distances[best_idx])
                staff_id = store.staff_ids[best_idx]
                meta = store.staff_meta.get(staff_id, {})
                # Convert distance to a rough similarity score
                score = max(0.0, 1.0 - best_dist)
                matched = best_dist < config.service.face_distance_threshold
                results.append({
                    "staffId": staff_id,
                    "fullName": meta.get("full_name", staff_id),
                    "bbox": [left, top, right, bottom],
                    "distance": best_dist,
                    "score": score,
                    "matched": matched,
                    "liveness_passed": liveness_passed,
                    "liveness_details": liveness_details
                })
            except Exception as e:
                logger.error(f"Error in face matching: {e}")
                return jsonify({"message": f"Face matching error: {str(e)}"}), 500

        return jsonify({"matches": results})
        
    except Exception as e:
        logger.error(f"Unexpected error in recognize: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500
    finally:
        # Clean up resources
        for pil_image, img_array in processed_images:
            try:
                del pil_image
                del img_array
            except:
                pass
        cleanup_resources()


def create_app():
    """Create and configure the Flask application"""
    # Initialize connection pool
    try:
        init_connection_pool()
    except Exception as e:
        logger.error(f"Failed to initialize connection pool: {e}")
        raise
    
    # Load known faces at startup
    try:
        store.ensure_loaded(force=True)
        logger.info(f"Loaded {len(store.staff_ids)} known faces at startup")
    except Exception as e:
        logger.error(f"Failed to load known faces: {e}")
        # Don't raise here, allow service to start and retry later
    
    return app

if __name__ == '__main__':
    # Print configuration on startup
    logger.info("Starting Face Recognition Service...")
    config.print_config()
    
    # Create app with proper initialization
    app = create_app()
    
    # Configure Flask for production
    app.config['MAX_CONTENT_LENGTH'] = config.service.max_upload_size
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching for development
    
    # Add request timeout and error handling
    @app.before_request
    def before_request():
        # Set a reasonable timeout for requests
        pass
    
    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"message": "File too large"}), 413
    
    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"message": "Internal server error"}), 500
    
    # Run server with configuration
    try:
        if config.service.ssl_enabled:
            try:
                ssl_cert = os.path.join(REPO_ROOT, config.service.ssl_cert_path)
                ssl_key = os.path.join(REPO_ROOT, config.service.ssl_key_path)
                if os.path.exists(ssl_cert) and os.path.exists(ssl_key):
                    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                    context.load_cert_chain(ssl_cert, ssl_key)
                    logger.info(f"Starting HTTPS server on {config.service.host}:{config.service.port}")
                    app.run(
                        host=config.service.host, 
                        port=config.service.port, 
                        ssl_context=context, 
                        debug=config.service.debug,
                        threaded=True,
                        use_reloader=False  # Disable reloader for production
                    )
                else:
                    logger.warning(f"SSL certificates not found: {ssl_cert}, {ssl_key}")
                    logger.info("Falling back to HTTP server")
                    raise Exception("SSL certificates not found")
            except Exception as e:
                logger.warning(f"HTTPS failed, falling back to HTTP: {e}")
                logger.info(f"Starting HTTP server on {config.service.host}:{config.service.port}")
                app.run(
                    host=config.service.host, 
                    port=config.service.port, 
                    debug=config.service.debug,
                    threaded=True,
                    use_reloader=False
                )
        else:
            logger.info(f"Starting HTTP server on {config.service.host}:{config.service.port}")
            logger.info("Note: For production use, consider using start_windows_production.py with Waitress")
            app.run(
                host=config.service.host, 
                port=config.service.port, 
                debug=config.service.debug,
                threaded=True,
                use_reloader=False
            )
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Service failed to start: {e}")
        logger.error(traceback.format_exc())
    finally:
        # Cleanup on shutdown
        if connection_pool:
            connection_pool.closeall()
        logger.info("Service shutdown complete")



