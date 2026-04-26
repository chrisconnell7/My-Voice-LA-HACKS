import numpy as np
import cv2
import time
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler


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
                        for y in np.linspace(0.05, 0.95, 4) for x in np.linspace(0.05, 0.95, 4)]

        # Add center point at the beginning
        self.targets.insert(0, (int(screen_w * 0.5), int(screen_h * 0.5)))

        self.raw_features = []  # To store the 4320-length arrays
        self.target_labels = []  # To store the (X, Y) percentages
        self.scaler = StandardScaler()  # The ML scaler

        # Bounding Box Limits (Now in absolute Centimeters)
        self.min_x = 0.0
        self.max_x = 0.0
        self.min_y = 0.0
        self.max_y = 0.0

        # EMA Filter State
        self.smoothed_x = None
        self.smoothed_y = None

        self.kalman = cv2.KalmanFilter(4, 2)

        # Measurement matrix (We only measure x and y)
        self.kalman.measurementMatrix = np.array([[1, 0, 0, 0],
                                                  [0, 1, 0, 0]], np.float32)

        # Transition matrix (How state evolves: x = x + dx*dt, y = y + dy*dt)
        self.kalman.transitionMatrix = np.array([[1, 0, 1, 0],
                                                 [0, 1, 0, 1],
                                                 [0, 0, 1, 0],
                                                 [0, 0, 0, 1]], np.float32)

        # Process Noise: How much we trust the model's prediction (lower = smoother)
        self.kalman.processNoiseCov = np.eye(4, dtype=np.float32) * 0.05

        # Measurement Noise: How much we trust the raw Ridge output (higher = ignores more noise)
        self.kalman.measurementNoiseCov = np.eye(2, dtype=np.float32) * 1.5

        self.kalman_initialized = False

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
            record_duration = 2.0
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

                    # USE THE NEW ML PIPELINE FUNCTION HERE
                    fused_features = face.get_eye_scalars()

                    if fused_features is not None:
                        # Store the 4320-length array
                        self.raw_features.append(fused_features)

                        # Convert the target pixel (e.g., 1368, 855) to a percentage (0.95, 0.95)
                        target_pct_x = target[0] / self.screen_w
                        target_pct_y = target[1] / self.screen_h
                        self.target_labels.append([target_pct_x, target_pct_y])

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
        print("\nTraining Gaze Regression Model...")

        # Convert lists to massive NumPy matrices
        # Shape: (Num_Frames, 4320)
        X_train_raw = np.array(self.raw_features)
        y_train = np.array(self.target_labels)    # Shape: (Num_Frames, 2)

        # Apply the Transform: Scale the raw 0-255 pixels to normalized values
        X_train_scaled = self.scaler.fit_transform(X_train_raw)

        # Create and train the Ridge Regression model
        # alpha is the regularization strength
        self.model = Ridge(alpha=1.0)
        self.model.fit(X_train_scaled, y_train)

        self.is_calibrated = True
        print("✅ CALIBRATION COMPLETE! Model trained.")

    def get_screen_pixel(self):
        if not self.is_calibrated:
            return None

        raw_features = self.face.get_eye_scalars()
        if raw_features is None:
            return None

        raw_features_2d = raw_features.reshape(1, -1)
        scaled_features = self.scaler.transform(raw_features_2d)
        prediction = self.model.predict(scaled_features)
        percent_x, percent_y = prediction[0]

        # 5. Scale to actual monitor pixels (Raw Noisy Measurement)
        raw_screen_x = np.float32(percent_x * self.screen_w)
        raw_screen_y = np.float32(percent_y * self.screen_h)

        # 6. Apply Kalman Filter
        measured = np.array([[raw_screen_x], [raw_screen_y]])

        if not self.kalman_initialized:
            # FIX: Explicitly set dtype to np.float32 here as well
            self.kalman.statePre = np.array(
                [[raw_screen_x], [raw_screen_y], [0], [0]], dtype=np.float32)
            self.kalman.statePost = np.array(
                [[raw_screen_x], [raw_screen_y], [0], [0]], dtype=np.float32)
            self.kalman_initialized = True

        # Phase A: Correct the state with the actual noisy measurement
        self.kalman.correct(measured)

        # Phase B: Predict the *next* smoothed position based on position + velocity
        predicted = self.kalman.predict()

        self.smoothed_x = predicted[0][0]
        self.smoothed_y = predicted[1][0]

        # 7. Clamp to screen bounds
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
