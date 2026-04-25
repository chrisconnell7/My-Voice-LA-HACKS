import numpy as np
import cv2
import time


class Calibration:
    def __init__(self, screen_w=1440, screen_h=900):
        self.screen_w = screen_w
        self.screen_h = screen_h
        self.is_calibrated = False
        self.face = None
        self.black_screen = np.zeros(
            (self.screen_h, self.screen_w, 3), dtype=np.uint8)

        # 4 Target Points: Top-Left, Top-Right, Bottom-Left, Bottom-Right
        self.targets = [(int(screen_w * x), int(screen_h * y))
                        for y in [0.05, 0.95] for x in [0.02, 0.98]]

        self.raw_samples = []

        # Bounding Box Limits
        self.min_x = 0.0
        self.max_x = 0.0
        self.min_y = 0.0
        self.max_y = 0.0

        # EMA Filter State
        self.smoothed_x = None
        self.smoothed_y = None

    def _get_local_iris(self):
        """Extracts the average iris position relative to the moving/rotating skull."""
        if self.face.left_iris_3d is None or self.face.right_iris_3d is None:
            return None

        if not self.face.detection_result or not self.face.detection_result.facial_transformation_matrixes:
            return None

        # 1. Get raw absolute iris position in camera space (Averaged)
        avg_iris_cam = np.mean(
            [self.face.left_iris_3d, self.face.right_iris_3d], axis=0)

        # 2. Extract the Head's Rigid Transformation Matrix
        matrix = self.face.detection_result.facial_transformation_matrixes[0]
        R = matrix[0:3, 0:3]  # Rotation
        T = matrix[0:3, 3]   # Translation (Skull Center in cm)

        # 3. Center the iris (Translation Immunity)
        centered_iris = avg_iris_cam - T

        # 4. Untwist the head (Rotation Immunity)
        local_iris = R.T @ centered_iris

        return local_iris

    def run(self, cam, face):
        self.face = face
        print("\n" + "="*50)
        print("🚀 STARTING LOCAL IRIS BOUNDING BOX CALIBRATION")
        print("="*50)

        window_name = "Calibration"
        cv2.namedWindow(window_name, cv2.WND_PROP_FULLSCREEN)
        cv2.setWindowProperty(
            window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        self.raw_samples = []

        for idx, target in enumerate(self.targets):
            # --- Phase 1: Prep ---
            prep_start = time.time()
            while time.time() - prep_start < 0.5:
                cam.read()
                canvas = np.ones(
                    (self.screen_h, self.screen_w, 3), dtype=np.uint8)
                cv2.circle(canvas, target, 30, (255, 255, 255), -1)
                cv2.imshow(window_name, canvas)
                cv2.waitKey(1)

            # --- Phase 2: Record ---
            record_start = time.time()
            record_duration = 3.0
            max_radius = 30

            samples = []
            valid_frames = 0
            canvas = np.ones((self.screen_h, self.screen_w, 3), dtype=np.uint8)

            while True:
                elapsed = time.time() - record_start
                if elapsed > record_duration:
                    break

                frame = cam.read()
                if frame is not None:
                    face.update(frame)

                    local_iris = self._get_local_iris()
                    if local_iris is not None:
                        samples.append(local_iris)
                        valid_frames += 1

                if valid_frames % 4 == 0:
                    canvas[:] = 1
                    current_radius = max(
                        int(max_radius * (1.0 - (elapsed / record_duration))), 2)
                    cv2.circle(canvas, target, current_radius, (0, 0, 255), -1)
                    cv2.imshow(window_name, canvas)

                cv2.waitKey(1)

            if valid_frames > 0:
                avg_pt = np.median(np.array(samples), axis=0)
                self.raw_samples.append(avg_pt)
                print(
                    f"Point {idx+1} Captured! (Averaged over {valid_frames} frames)")
            else:
                print(
                    f"Warning: Tracking lost on point {idx+1}. Appending zeros.")
                self.raw_samples.append(np.array([0.0, 0.0, 0.0]))

        cv2.destroyWindow(window_name)
        self._train()

    def _train(self):
        print("\nCalculating Local Min/Max Boundaries...")
        points = np.array(self.raw_samples)

        # X bounds
        self.min_x = np.min(points[:, 0])
        self.max_x = np.max(points[:, 0])

        # Y bounds
        self.min_y = np.min(points[:, 1])
        self.max_y = np.max(points[:, 1])

        # Safety check to prevent division by zero
        if self.max_x == self.min_x:
            self.max_x += 1e-5
        if self.max_y == self.min_y:
            self.max_y += 1e-5

        self.is_calibrated = True
        print(f"✅ CALIBRATION COMPLETE!")
        print(f"   Local X Range: [{self.min_x:.4f}, {self.max_x:.4f}]")
        print(f"   Local Y Range: [{self.min_y:.4f}, {self.max_y:.4f}]")

    def get_screen_pixel(self):
        if not self.is_calibrated:
            return None

        local_iris = self._get_local_iris()
        if local_iris is None:
            return None

        # 2. Manual interpolation to screen percentage
        percent_x = (local_iris[0] - self.min_x) / (self.max_x - self.min_x)
        percent_y = 1 - (local_iris[1] - self.min_y) / \
            (self.max_y - self.min_y)

        # 3. Scale to actual monitor pixels
        raw_screen_x = percent_x * self.screen_w
        raw_screen_y = percent_y * self.screen_h

        # 4. Apply EMA Filter to kill the noise
        alpha = 0.15

        if self.smoothed_x is None:
            self.smoothed_x = raw_screen_x
            self.smoothed_y = raw_screen_y
        else:
            self.smoothed_x = (alpha * raw_screen_x) + \
                ((1.0 - alpha) * self.smoothed_x)
            self.smoothed_y = (alpha * raw_screen_y) + \
                ((1.0 - alpha) * self.smoothed_y)

        # 5. Clamp to screen bounds to prevent the cursor from leaving the monitor
        final_x = max(0, min(self.screen_w, int(self.smoothed_x)))
        final_y = max(0, min(self.screen_h, int(self.smoothed_y)))

        return (final_x, final_y)

    def show_vision_circle(self):
        self.black_screen[:] = 0
        if not self.is_calibrated:
            return self.black_screen

        coords = self.get_screen_pixel()
        if coords is not None:
            screen_x, screen_y = coords
            cv2.circle(self.black_screen, (screen_x, screen_y),
                       30, (255, 255, 255), 2)

        return self.black_screen
