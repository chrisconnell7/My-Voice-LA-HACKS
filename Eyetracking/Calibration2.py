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

        # Bounding Box Limits (Now in absolute Centimeters)
        self.min_x = 0.0
        self.max_x = 0.0
        self.min_y = 0.0
        self.max_y = 0.0

        # EMA Filter State
        self.smoothed_x = None
        self.smoothed_y = None

    def run(self, cam, face):
        self.face = face
        print("\n" + "="*50)
        print("🚀 STARTING PHYSICAL RAY INTERSECTION CALIBRATION")
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

                    # Get the absolute physical intersection point on the Z=0 plane
                    gaze_pt = face.get_raw_gaze_intersection()

                    if gaze_pt is not None:
                        samples.append(gaze_pt)
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
        print("\nCalculating Physical Screen Boundaries (cm)...")
        points = np.array(self.raw_samples)

        # X bounds (Centimeters)
        self.min_x = np.min(points[:, 0])
        self.max_x = np.max(points[:, 0])

        # Y bounds (Centimeters)
        self.min_y = np.min(points[:, 1])
        self.max_y = np.max(points[:, 1])

        # Safety check to prevent division by zero
        if self.max_x == self.min_x:
            self.max_x += 1e-5
        if self.max_y == self.min_y:
            self.max_y += 1e-5

        self.is_calibrated = True
        print(f"✅ CALIBRATION COMPLETE!")
        print(f"   Physical X Range: [{self.min_x:.2f}cm, {self.max_x:.2f}cm]")
        print(f"   Physical Y Range: [{self.min_y:.2f}cm, {self.max_y:.2f}cm]")

    def get_screen_pixel(self):
        if not self.is_calibrated:
            return None

        # Get the real-time physical intersection point
        gaze_pt = self.face.get_raw_gaze_intersection()
        if gaze_pt is None:
            return None

        # 2. Interpolate based on the physical centimeter bounds
        percent_x = (gaze_pt[0] - self.min_x) / (self.max_x - self.min_x)

        # NOTE: Depending on your camera alignment, you may need to remove
        # the '1 -' below if the Y-axis is naturally mirrored.
        percent_y = 1 - (gaze_pt[1] - self.min_y) / (self.max_y - self.min_y)

        # 3. Scale to actual monitor pixels
        raw_screen_x = percent_x * self.screen_w
        raw_screen_y = percent_y * self.screen_h

        # 4. Apply EMA Filter to kill the noise
        alpha = 0.15

        # if self.smoothed_x is None:
        #     self.smoothed_x = raw_screen_x
        #     self.smoothed_y = raw_screen_y
        # else:
        #     self.smoothed_x = (alpha * raw_screen_x) + \
        #         ((1.0 - alpha) * self.smoothed_x)
        #     self.smoothed_y = (alpha * raw_screen_y) + \
        #         ((1.0 - alpha) * self.smoothed_y)

        smoothed_x = raw_screen_x * percent_x
        smoothed_y = raw_screen_y * percent_y
        # 5. Clamp to screen bounds to prevent the cursor from leaving the monitor
        final_x = max(0, min(self.screen_w, int(smoothed_x)))
        final_y = max(0, min(self.screen_h, int(smoothed_y)))

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
