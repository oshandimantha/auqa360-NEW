"""
AquaSense360 — MJPEG Stream Server
Serves annotated YOLO frames as a live MJPEG stream over HTTP.
The browser loads this directly via <img src="http://localhost:8765/video_feed">.
"""
from flask import Flask, Response
from flask_cors import CORS
import threading
import cv2
import time

app = Flask(__name__)
CORS(app)

# Thread-safe shared frame buffer
_frame_lock = threading.Lock()
_latest_frame = None  # Raw JPEG bytes


def update_frame(frame_bgr):
    """Called by the YOLO thread to update the latest annotated frame."""
    global _latest_frame
    _, buffer = cv2.imencode('.jpg', frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 70])
    with _frame_lock:
        _latest_frame = buffer.tobytes()


def generate_mjpeg():
    """Generator that yields MJPEG frames for the /video_feed endpoint."""
    while True:
        with _frame_lock:
            frame = _latest_frame

        if frame is None:
            time.sleep(0.05)
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
        )
        # ~20 FPS max to avoid overwhelming the browser
        time.sleep(0.05)


@app.route('/video_feed')
def video_feed():
    """MJPEG stream endpoint."""
    return Response(
        generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/health')
def health():
    """Health check endpoint."""
    return {'status': 'ok', 'stream': _latest_frame is not None}


def start_stream_server(port=8765):
    """Start the Flask MJPEG server in a background thread."""
    def run():
        # Suppress Flask request logs
        import logging
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.WARNING)

        print(f"📺 MJPEG stream server started on http://localhost:{port}/video_feed")
        app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)

    server_thread = threading.Thread(target=run, daemon=True, name="MJPEGStream")
    server_thread.start()
    return server_thread
