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

        # 9 Target Points (Inset by 10% from the edges)
        self.targets = [(int(screen_w * x), int(screen_h * y))
                        for y in np.linspace(0.05, 0.96, 50) for x in np.linspace(0.05, 0.96, 30)]

        self.raw_samples = []
        self.coeffs_x = None
        self.coeffs_y = None

    def run(self, cam, face):
        self.face = face
        """
        Takes over the thread to run the visual calibration sequence.
        Requires your existing camera stream and face instances.
        """
        print("\n" + "="*50)
        print("🚀 STARTING CALIBRATION SEQUENCE")
        print("="*50)

        window_name = "Calibration"
        cv2.namedWindow(window_name, cv2.WND_PROP_FULLSCREEN)
        cv2.setWindowProperty(
            window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        self.raw_samples = []

        for idx, target in enumerate(self.targets):
            # --- Phase 1: Prep (Give the user time to move their eyes to the dot) ---
            prep_start = time.time()
            # prep_duration = 0.5

            while time.time() - prep_start < prep_duration:
                cam.read()  # Keep flushing the buffer

                canvas = np.ones(
                    (self.screen_h, self.screen_w, 3), dtype=np.uint8)
                # White prep dot
                cv2.circle(canvas, target, 30, (255, 255, 255), -1)
                cv2.imshow(window_name, canvas)
                cv2.waitKey(1)

            # --- Phase 2: Record (5-second shrinking red dot) ---
            record_start = time.time()
            record_duration = 2.0
            max_radius = 30

            samples = []
            valid_frames = 0

            # OPTIMIZATION 1: Pre-allocate the 6MB array OUTSIDE the loop
            canvas = np.ones((self.screen_h, self.screen_w, 3), dtype=np.uint8)

            while True:
                elapsed = time.time() - record_start
                if elapsed > record_duration:
                    break

                frame = cam.read()
                if frame is not None:
                    face.update(frame)
                    raw_gaze = face.get_raw_gaze_intersection()
                    raw_pose = face.get_pose_ray_intersection()

                    # FIX 1: Capture BOTH gaze and pose during training
                    if raw_gaze is not None and raw_pose is not None:
                        # Store as a flattened 4-element array: [gaze_x, gaze_y, pose_x, pose_y]
                        samples.append(np.concatenate(
                            [raw_gaze[:2], raw_pose[:2]]))
                        valid_frames += 1

                # OPTIMIZATION 2: Throttle the UI to run at half-speed
                # (valid_frames % 2 == 0 ensures the UI updates at ~15 FPS, saving massive time)
                if valid_frames % 4 == 0:

                    # Reset the existing memory buffer in-place instead of creating a new one
                    canvas[:] = 1

                    # Calculate shrinking radius
                    current_radius = int(
                        max_radius * (1.0 - (elapsed / record_duration)))
                    current_radius = max(current_radius, 2)

                    cv2.circle(canvas, target, current_radius, (0, 0, 255), -1)
                    cv2.imshow(window_name, canvas)

                # cv2.waitKey(1) MUST run every loop to keep the window from crashing
                cv2.waitKey(1)

            # Store the averaged point for this target
            if valid_frames > 0:
                # print(samples)
                avg_pt = np.median(np.array(samples), axis=0)
                self.raw_samples.append(avg_pt)
                print(
                    f"Point {idx+1} Captured! (Averaged over {valid_frames} frames)")
            else:
                # Fallback if tracking completely lost during those 5 seconds
                print(
                    f"Warning: Tracking lost on point {idx+1}. Appending zeros.")
                self.raw_samples.append(np.array([0.0, 0.0, 0.0]))

        # Cleanup UI and train the math
        cv2.destroyWindow(window_name)
        self._train()

    def _train(self):
        print("\nCalculating Multivariable Polynomial Fit...")
        X_raw = np.array(self.raw_samples)  # Shape will now be (N, 4)
        Y_screen = np.array(self.targets)

        def build_features(pts):
            gx = pts[:, 0]  # Gaze X
            gy = pts[:, 1]  # Gaze Y
            px = pts[:, 2]  # Pose X
            py = pts[:, 3]  # Pose Y

            # FIX 2: Feature Stack. We include 2nd degree gaze, but keep pose linear
            # to act as a dynamic translation/rotation offset.
            return np.column_stack((
                np.ones(len(gx)),
                gx, gy,
                px, py,       # Head pose features
                gx*gy, gx**2, gy**2
            ))

        features = build_features(X_raw)

        self.coeffs_x, _, _, _ = np.linalg.lstsq(
            features, Y_screen[:, 0], rcond=None)
        self.coeffs_y, _, _, _ = np.linalg.lstsq(
            features, Y_screen[:, 1], rcond=None)

        self.is_calibrated = True
        print("✅ CALIBRATION COMPLETE! Head-pose aware gaze is mapped.")

    def get_screen_pixel(self):
        if not self.is_calibrated:
            return None

        raw_gaze = self.face.get_raw_gaze_intersection()
        raw_pose = self.face.get_pose_ray_intersection()

        if raw_gaze is None or raw_pose is None:
            return None

        # FIX 3: Feed the exact same feature structure used in training
        gx, gy = raw_gaze[0], raw_gaze[1]
        px, py = raw_pose[0], raw_pose[1]

        features = np.array([
            1,
            gx, gy,
            px, py,
            gx*gy, gx**2, gy**2
        ])

        screen_x = np.dot(features, self.coeffs_x)
        screen_y = np.dot(features, self.coeffs_y)

        screen_x = max(0, min(self.screen_w, int(screen_x)))
        screen_y = max(0, min(self.screen_h, int(screen_y)))

        return (screen_x, screen_y)

    def show_vision_circle(self):
        self.black_screen[:] = 0
        if not self.is_calibrated:
            return self.black_screen

        screen_x, screen_y = self.get_screen_pixel()

        cv2.circle(self.black_screen, (screen_x, screen_y), 50,
                   (255, 255, 255), 2)  # Green dot for debugging
        return self.black_screen
