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

        # NEW SEQUENCE: Center, then clockwise around the edges starting Top-Left
        self.targets = [
            (int(screen_w * 0.5), int(screen_h * 0.5)),   # 1. Center
            (int(screen_w * 0.05), int(screen_h * 0.05)),  # 2. Top-Left
            (int(screen_w * 0.5), int(screen_h * 0.05)),  # 3. Top-Middle
            (int(screen_w * 0.95), int(screen_h * 0.05)),  # 4. Top-Right
            (int(screen_w * 0.95), int(screen_h * 0.5)),  # 5. Middle-Right
            (int(screen_w * 0.95), int(screen_h * 0.95)),  # 6. Bottom-Right
            (int(screen_w * 0.5), int(screen_h * 0.95)),  # 7. Bottom-Middle
            (int(screen_w * 0.05), int(screen_h * 0.95)),  # 8. Bottom-Left
            (int(screen_w * 0.05), int(screen_h * 0.5))   # 9. Middle-Left
        ]

        # Offset variables for our final calibration step
        self.offset_x = 0.0
        self.offset_y = 0.0

        self.raw_features = []
        self.target_labels = []
        self.scaler = StandardScaler()

        # Bounding Box Limits
        self.min_x = 0.0
        self.max_x = 0.0
        self.min_y = 0.0
        self.max_y = 0.0

        self.smoothed_x = None
        self.smoothed_y = None

        self.kalman = cv2.KalmanFilter(4, 2)
        self.kalman.measurementMatrix = np.array(
            [[1, 0, 0, 0], [0, 1, 0, 0]], np.float32)
        self.kalman.transitionMatrix = np.array(
            [[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]], np.float32)
        self.kalman.processNoiseCov = np.eye(4, dtype=np.float32) * 0.05
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
            # ... (keep the rest of your run method the same until the end) ...
            else:
                print(
                    f"Warning: Tracking lost on point {idx+1}. Appending zeros.")
                self.raw_samples.append(np.array([0.0, 0.0, 0.0]))

        cv2.destroyWindow(window_name)

        # 1. Train the Ridge Model first
        self._train()

        # 2. Run the final big dot for Kalman tuning and Offset calculation
        self.tune_kalman_and_offset(cam)

        cv2.destroyWindow(window_name)
        self._train()

    def tune_kalman_and_offset(self, cam):
        print("\n" + "="*50)
        print("🎯 FINAL PHASE: Stare at the big center dot to tune filtering & offset")
        print("="*50)

        window_name = "Tuning"
        cv2.namedWindow(window_name, cv2.WND_PROP_FULLSCREEN)
        cv2.setWindowProperty(
            window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        true_center_x = self.screen_w * 0.5
        true_center_y = self.screen_h * 0.5
        center_target = (int(true_center_x), int(true_center_y))

        predicted_x_samples = []
        predicted_y_samples = []

        # Prep phase: Show a big blue dot and let the user focus
        prep_start = time.time()
        canvas = np.ones((self.screen_h, self.screen_w, 3), dtype=np.uint8)
        cv2.circle(canvas, center_target, 60, (255, 0, 0), -1)

        while time.time() - prep_start < 1.0:
            cam.read()
            cv2.imshow(window_name, canvas)
            cv2.waitKey(1)

        # Record Phase: Collect 3 seconds of data
        record_start = time.time()
        record_duration = 3.0

        while True:
            elapsed = time.time() - record_start
            if elapsed > record_duration:
                break

            frame = cam.read()
            if frame is not None:
                self.face.update(frame)
                raw_features = self.face.get_eye_scalars()

                if raw_features is not None:
                    # Run the freshly trained model to get predictions
                    raw_features_2d = raw_features.reshape(1, -1)
                    scaled_features = self.scaler.transform(raw_features_2d)
                    prediction = self.model.predict(scaled_features)

                    percent_x, percent_y = prediction[0]
                    pred_x = percent_x * self.screen_w
                    pred_y = percent_y * self.screen_h

                    predicted_x_samples.append(pred_x)
                    predicted_y_samples.append(pred_y)

            # Animate the dot shrinking slightly to show progress
            canvas[:] = 1
            current_radius = max(
                int(60 * (1.0 - (elapsed / record_duration))), 10)
            cv2.circle(canvas, center_target, current_radius, (255, 0, 0), -1)
            cv2.imshow(window_name, canvas)
            cv2.waitKey(1)

        cv2.destroyWindow(window_name)

        # --- Calculate Variance and Offset ---
        if len(predicted_x_samples) > 10:
            # 1. Kalman Tuning (Variance)
            var_x = np.var(predicted_x_samples)
            var_y = np.var(predicted_y_samples)

            safe_var_x = np.clip(var_x, 1.0, 500.0)
            safe_var_y = np.clip(var_y, 1.0, 500.0)

            self.kalman.measurementNoiseCov = np.array([
                [safe_var_x, 0],
                [0, safe_var_y]
            ], dtype=np.float32)

            # 2. Hard Offset Calculation (Mean Error)
            # mean_pred_x = np.mean(predicted_x_samples)
            # mean_pred_y = np.mean(predicted_y_samples)

            # self.offset_x = true_center_x - mean_pred_x
            # self.offset_y = true_center_y - mean_pred_y

            print(f"✅ Kalman Tuned! Var X: {var_x:.1f}, Var Y: {var_y:.1f}")
            print(
                f"✅ Offset Applied! X: {self.offset_x:+.1f}px, Y: {self.offset_y:+.1f}px")
        else:
            print("⚠️ Not enough data collected during tuning. Using defaults.")

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

        # 5. Scale to monitor pixels AND APPLY THE HARD OFFSET
        raw_screen_x = np.float32((percent_x * self.screen_w) + self.offset_x)
        raw_screen_y = np.float32((percent_y * self.screen_h) + self.offset_y)

        # 6. Apply Kalman Filter
        # FIXED: Added dtype=np.float32 to prevent the gemm crash
        measured = np.array([[raw_screen_x], [raw_screen_y]], dtype=np.float32)

        if not self.kalman_initialized:
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
