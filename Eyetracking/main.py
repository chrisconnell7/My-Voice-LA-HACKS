import cv2
import threading
import time
import numpy as np
import tkinter as tk

from Face import Face
from Calibration3 import Calibration


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
    # 1. Ask macOS for the true logical resolution
    root = tk.Tk()
    logical_width = root.winfo_screenwidth()
    logical_height = root.winfo_screenheight()
    root.destroy()  # Close the invisible tkinter window
    print(f"Logical Screen Resolution: {logical_width}x{logical_height}")

    cam = CameraStream(port=0).start()
    face = Face(model_path="./models/face_landmarker.task", output_face_blendshapes=False,
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
        left_crop, right_crop = face.left_eye_crop, face.right_eye_crop

        # frame = face.draw_head_pose_axes(frame)
        # frame = face.draw_landmark_mesh(frame)
        # frame = face.draw_view_rays(frame)

        # 5. Convert back to BGR for OpenCV display
        output_bgr = cv2.cvtColor(output_rgb, cv2.COLOR_RGB2BGR)

        combined_frame = np.concatenate((frame, output_bgr), axis=1)
        eyes_concat = np.concatenate((left_crop, right_crop), axis=1)
        cv2.imshow("screen", combined_frame)
        cv2.imshow("eyes", eyes_concat)

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
