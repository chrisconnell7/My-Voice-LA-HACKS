import cv2
import threading
import time
import numpy as np
import tkinter as tk

from Face import Face
from Calibration2 import Calibration


import ctypes
ctypes.windll.shcore.SetProcessDpiAwareness(1)

class CameraStream:
    def __init__(self, port=0):
        self.cap = cv2.VideoCapture(port)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(port + 1)
            if not self.cap.isOpened():
                print(f"Cannot open camera on port {port} or {port + 1}")
                exit()

        self.ret, self.frame = self.cap.read()
        self.stopped = False
        self.shape = self.frame.shape if self.ret else None

    def start(self):
        thread = threading.Thread(target=self.update, args=())
        thread.daemon = True
        thread.start()
        return self

    def update(self):
        while not self.stopped:
            self.ret, self.frame = self.cap.read()
            self.shape = self.frame.shape

    def read(self):
        if self.ret:
            return self.frame

        print("Feed not available, retrying...")
        return None

    def stop(self):
        self.stopped = True
        self.cap.release()


if __name__ == "__main__":
    print("hello")
    try:
        # 1. Verify Tkinter
        root = tk.Tk()
        logical_width = root.winfo_screenwidth()
        logical_height = root.winfo_screenheight()
        root.destroy()
        print(f"Screen: {logical_width}x{logical_height}")

        # 2. Check for the model file
        import os
        model_file = "./models/face_landmarker.task"
        if not os.path.exists(model_file):
            print(f"❌ ERROR: Model file not found at {model_file}")
            exit()

        # 3. Start Camera
        print("Connecting to camera...")
        cam = CameraStream(port=0).start()
        
        # Give the camera a second to warm up
        time.sleep(2.0) 
        
        if cam.frame is None:
            print("❌ ERROR: Camera connected but no frames received. Check your camera privacy settings.")
            exit()

        face = Face(model_path=model_file, output_face_blendshapes=False,
                    output_facial_transformation_matrixes=True, num_faces=1)
        calibrator = Calibration(screen_w=logical_width, screen_h=logical_height)

        print("🚀 System Live! Press 'q' to quit.")

        while True:
            frame = cam.read()
            if frame is None:
                continue

            face.update(frame)

            black_template = np.zeros((height, width, 3), dtype=np.uint8)

            output_rgb = face.draw_landmark_mesh(black_template)
            output_rgb = face.draw_eyeballs_3d(output_rgb)

            frame = face.draw_iris_contours(frame)
            # frame = face.draw_head_pose_axes(frame)
            # frame = face.draw_landmark_mesh(frame)
            # frame = face.draw_view_rays(frame)

            # 5. Convert back to BGR for OpenCV display
            output_bgr = cv2.cvtColor(output_rgb, cv2.COLOR_RGB2BGR)

            combined_frame = np.concatenate((frame, output_bgr), axis=1)

            cv2.imshow("screen", combined_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

            if cv2.waitKey(1) & 0xFF == ord('c'):
                calibrator.run(cam, face)

            if cv2.waitKey(1) & 0xFF == ord('m'):
                face.generate_point_grid()

            if calibrator.is_calibrated:
                vision_output = calibrator.show_vision_circle()
                vision_output = face.draw_landmark_mesh(vision_output)
                vision_output = face.draw_view_rays(vision_output)

                cv2.imshow("Gaze Cursor", vision_output)
                cv2.waitKey(1)

        cam.stop()
        cv2.destroyAllWindows()
    except Exception as e:
        print(f"🚨 CRASHED WITH ERROR: {e}")
