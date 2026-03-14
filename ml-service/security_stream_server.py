from flask import Flask, Response, jsonify
from flask_cors import CORS
import threading
import cv2
import time

app = Flask(__name__)
CORS(app)

_frame_lock = threading.Lock()
_frame_event = threading.Event()
_latest_frame = None
_frame_count = 0
_fps = 0
_fps_start = time.time()

def update_security_frame(frame_bgr):
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
    _frame_event.set()

def generate_mjpeg():
    while True:
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
    return Response(
        generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'stream': _latest_frame is not None,
        'fps': round(_fps, 1)
    })

@app.route('/stats')
def stats():
    return jsonify({
        'streamFps': round(_fps, 1),
        'hasFrame': _latest_frame is not None,
        'frameSize': len(_latest_frame) if _latest_frame else 0
    })

def start_security_stream_server(port=8766):
    def run():
        import logging
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.WARNING)
        print(f"📺 Security MJPEG stream started on http://0.0.0.0:{port}/video_feed")
        app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)

    server_thread = threading.Thread(target=run, daemon=True, name="SecurityMJPEGStream")
    server_thread.start()
    return server_thread
