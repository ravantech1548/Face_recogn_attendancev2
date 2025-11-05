"""
Performance Logger Module
Logs performance metrics to organized folder structure: YYYY/MMYYYY/DDMMYYYY
"""
import os
import time
import logging
from datetime import datetime
from contextlib import contextmanager
from pathlib import Path
import json

class PerformanceLogger:
    """Logger for tracking performance metrics with organized file structure"""
    
    def __init__(self, base_log_dir='logs/performance'):
        self.base_log_dir = base_log_dir
        self.current_log_file = None
        self.logger = None
        self._setup_logger()
    
    def _get_log_path(self):
        """Generate log file path with folder structure: YYYY/MMYYYY/DDMMYYYY/performance.log"""
        now = datetime.now()
        year = now.strftime('%Y')  # YYYY
        month = now.strftime('%m')  # MM
        day = now.strftime('%d')  # DD
        
        month_folder = f"{month}{year}"  # MMYYYY
        date_folder = f"{day}{month}{year}"  # DDMMYYYY
        
        # Create full path: logs/performance/YYYY/MMYYYY/DDMMYYYY/
        log_dir = os.path.join(self.base_log_dir, year, month_folder, date_folder)
        
        # Create directories if they don't exist
        Path(log_dir).mkdir(parents=True, exist_ok=True)
        
        # Log file name with timestamp
        log_file = os.path.join(log_dir, 'performance.log')
        
        return log_file
    
    def _setup_logger(self):
        """Setup logger with current date's log file"""
        log_file = self._get_log_path()
        
        # Only update if log file has changed (new day)
        if self.current_log_file != log_file:
            self.current_log_file = log_file
            
            # Create new logger
            self.logger = logging.getLogger('performance')
            self.logger.setLevel(logging.INFO)
            
            # Remove existing handlers
            self.logger.handlers.clear()
            
            # Add file handler
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.INFO)
            
            # Add console handler
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            
            # Create formatter
            formatter = logging.Formatter(
                '%(asctime)s | %(levelname)s | %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            
            file_handler.setFormatter(formatter)
            console_handler.setFormatter(formatter)
            
            self.logger.addHandler(file_handler)
            self.logger.addHandler(console_handler)
    
    def log(self, message, level='info', **kwargs):
        """Log a message with optional additional data"""
        # Check if we need to rotate to a new log file (new day)
        self._setup_logger()
        
        # Add extra data if provided
        if kwargs:
            message = f"{message} | {json.dumps(kwargs)}"
        
        if level == 'info':
            self.logger.info(message)
        elif level == 'warning':
            self.logger.warning(message)
        elif level == 'error':
            self.logger.error(message)
        elif level == 'debug':
            self.logger.debug(message)
    
    @contextmanager
    def timer(self, operation_name, **context):
        """Context manager for timing operations"""
        start_time = time.time()
        start_time_ms = start_time * 1000
        
        self.log(
            f"START: {operation_name}",
            **context
        )
        
        try:
            yield
        finally:
            end_time = time.time()
            end_time_ms = end_time * 1000
            duration_ms = (end_time - start_time) * 1000
            
            self.log(
                f"END: {operation_name}",
                duration_ms=f"{duration_ms:.2f}",
                **context
            )


# Global performance logger instance
perf_logger = PerformanceLogger()


@contextmanager
def log_performance(operation_name, **context):
    """
    Convenience function for timing operations
    
    Usage:
        with log_performance("face_detection", image_size=image.shape):
            faces = face_recognition.face_locations(image)
    """
    with perf_logger.timer(operation_name, **context):
        yield


def log_metric(metric_name, value, **context):
    """
    Log a specific metric
    
    Usage:
        log_metric("face_distance", 0.35, staff_id="EMP001")
    """
    perf_logger.log(
        f"METRIC: {metric_name} = {value}",
        value=value,
        **context
    )


def log_event(event_name, **context):
    """
    Log an event
    
    Usage:
        log_event("face_matched", staff_id="EMP001", confidence=0.95)
    """
    perf_logger.log(
        f"EVENT: {event_name}",
        **context
    )


def log_error_metric(error_type, error_message, **context):
    """
    Log an error with performance context
    
    Usage:
        log_error_metric("face_detection_failed", str(e), image_path="test.jpg")
    """
    perf_logger.log(
        f"ERROR: {error_type} - {error_message}",
        level='error',
        **context
    )

