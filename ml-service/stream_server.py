"""
AquaSense360 — MJPEG Stream Server
Serves composited frames (raw camera + detection overlay) as a live MJPEG stream.
The browser loads this directly via <img src="http://localhost:8765/video_feed">.
Uses threading.Event for responsive frame delivery instead of polling.
"""
from flask import Flask, Response, jsonify
from flask_cors import CORS
import threading
import cv2
import time

app = Flask(__name__)
CORS(app)

# Thread-safe shared frame buffer with Event-based notification
_frame_lock = threading.Lock()
_frame_event = threading.Event()
_latest_frame = None  # Raw JPEG bytes
_frame_count = 0
_fps = 0
_fps_start = time.time()


def update_frame(frame_bgr):
    """Called by the StreamCompositor to update the latest composited frame."""
    global _latest_frame, _frame_count, _fps, _fps_start
    _, buffer = cv2.imencode('.jpg', frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 75])
    with _frame_lock:
        _latest_frame = buffer.tobytes()
        _frame_count += 1
        elapsed = time.time() - _fps_start
        if elapsed >= 2.0:
            _fps = _frame_count / elapsed
            _frame_count = 0
            _fps_start = time.time()
    _frame_event.set()  # Wake up any waiting MJPEG generators


def generate_mjpeg():
    """Generator that yields MJPEG frames for the /video_feed endpoint."""
    while True:
        # Wait for a new frame (up to 100ms) instead of busy-polling
        _frame_event.wait(timeout=0.1)
        _frame_event.clear()

        with _frame_lock:
            frame = _latest_frame

        if frame is None:
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
        )


@app.route('/video_feed')
def video_feed():
    """MJPEG stream endpoint — works on laptop and mobile browsers."""
    return Response(
        generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'stream': _latest_frame is not None,
        'fps': round(_fps, 1)
    })


@app.route('/stats')
def stats():
    """Stream statistics for debugging."""
    return jsonify({
        'streamFps': round(_fps, 1),
        'hasFrame': _latest_frame is not None,
        'frameSize': len(_latest_frame) if _latest_frame else 0
    })


def start_stream_server(port=8765):
    """Start the Flask MJPEG server in a background thread."""
    def run():
        # Suppress Flask request logs
        import logging
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.WARNING)

        print(f"📺 MJPEG stream server started on http://0.0.0.0:{port}/video_feed")
        print(f"   📱 Mobile access: http://<your-laptop-ip>:{port}/video_feed")
        app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)

    server_thread = threading.Thread(target=run, daemon=True, name="MJPEGStream")
    server_thread.start()
    return server_thread
