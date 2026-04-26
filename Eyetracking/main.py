import cv2
import threading
import time
import numpy as np
import tkinter as tk
import os

from Face import Face
from Calibration3 import Calibration

import pyautogui

# Set this to True to prevent pyautogui from pausing between movements
pyautogui.PAUSE = 0 
# Failsafe: moving the physical mouse to the corner of the screen aborts the script
pyautogui.FAILSAFE = True

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
    # 1. Ask macOS/Windows for the true logical resolution
    root = tk.Tk()
    logical_width = root.winfo_screenwidth()
    logical_height = root.winfo_screenheight()
    root.destroy()  # Close the invisible tkinter window
    print(f"Logical Screen Resolution: {logical_width}x{logical_height}")

    # 2. Safely resolve the model path regardless of where the script is run from
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_file = os.path.join(current_dir, "models", "face_landmarker.task")

    if not os.path.exists(model_file):
        print(f"❌ ERROR: Model file not found at {model_file}")
        exit()

    cam = CameraStream(port=0).start()
    face = Face(model_path=model_file, output_face_blendshapes=False,
                output_facial_transformation_matrixes=True, num_faces=1)
    calibrator = Calibration(screen_w=logical_width, screen_h=logical_height)

    height, width = cam.shape[: 2]

    while True:
        frame = cam.read()
        if frame is None:
            continue

        face.update(frame)

        black_template = np.zeros((height, width, 3), dtype=np.uint8)

        output_rgb = face.draw_landmark_mesh(black_template)
        output_rgb = face.draw_eyeballs_3d(output_rgb)

        frame = face.draw_iris_contours(frame)
        
        # NOTE: Ensure face.left_eye_crop and right_eye_crop exist in your Face.py!
        try:
            left_crop, right_crop = face.left_eye_crop, face.right_eye_crop
            eyes_concat = np.concatenate((left_crop, right_crop), axis=1)
            cv2.imshow("eyes", eyes_concat)
        except AttributeError:
            pass # Fails gracefully if the crops aren't implemented yet

        # Convert back to BGR for OpenCV display
        output_bgr = cv2.cvtColor(output_rgb, cv2.COLOR_RGB2BGR)

        combined_frame = np.concatenate((frame, output_bgr), axis=1)
        cv2.imshow("screen", combined_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            calibrator.run(cam, face)
        elif key == ord('m'):
            face.generate_point_grid()

        # Only process mouse movement and display the cursor window IF calibrated
        if calibrator.is_calibrated:
            vision_output = calibrator.show_vision_circle()
            
            # Note: Calibration3 show_vision_circle returns a fresh black screen. 
            # If you want the mesh/rays drawn on it, these need to be implemented in Face.py
            try:
                vision_output = face.draw_landmark_mesh(vision_output)
                vision_output = face.draw_view_rays(vision_output)
            except Exception as e:
                pass 

            # --- OS MOUSE CONTROL FOR CALIBRATION 3 (RIDGE REGRESSION) ---
            coords = calibrator.get_screen_pixel()
            if coords is not None:
                screen_x, screen_y = coords
                try:
                    # Move the actual Windows/Linux/Mac mouse cursor!
                    pyautogui.moveTo(screen_x, screen_y)
                except pyautogui.FailSafeException:
                    print("Failsafe triggered! Mouse in corner.")
                    break

            cv2.imshow("Gaze Cursor", vision_output)

    cam.stop()
    cv2.destroyAllWindows()