import numpy as np
import cv2
import time
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import warnings

# Suppress the annoying MediaPipe Protobuf deprecation warning
warnings.filterwarnings("ignore", category=UserWarning, module="google.protobuf")


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

        self.smoothed_x = None
        self.smoothed_y = None

        self.kalman = cv2.KalmanFilter(4, 2)
        self.kalman.measurementMatrix = np.array(
            [[1, 0, 0, 0], [0, 1, 0, 0]], np.float32)
        self.kalman.transitionMatrix = np.array(
            [[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]], np.float32)
        # processNoiseCov dictates how "heavy" the cursor feels. (0.05 = standard, 0.005 = very heavy)
        self.kalman.processNoiseCov = np.eye(4, dtype=np.float32) * 0.05
        self.kalman.measurementNoiseCov = np.eye(2, dtype=np.float32) * 1.5
        self.kalman_initialized = False

    def run(self, cam, face):
        self.face = face
        print("\n" + "="*50)
        print("🚀 STARTING ML REGRESSION CALIBRATION")
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

                    fused_features = face.get_eye_scalars()

                    if fused_features is not None:
                        self.raw_features.append(fused_features)

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
                print(f"✅ Point {idx+1} Captured! (Averaged over {valid_frames} frames)")
            else:
                print(f"⚠️ Warning: Tracking lost on point {idx+1}.")

        cv2.destroyWindow(window_name)

        # 1. Train the Ridge Model first
        self._train()

        # 2. Run the final big dot for Kalman tuning and Offset calculation
        self.tune_kalman_and_offset(cam)


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
                    raw_features_2d = raw_features.reshape(1, -1)
                    scaled_features = self.scaler.transform(raw_features_2d)
                    prediction = self.model.predict(scaled_features)

                    percent_x, percent_y = prediction[0]
                    pred_x = percent_x * self.screen_w
                    pred_y = percent_y * self.screen_h

                    predicted_x_samples.append(pred_x)
                    predicted_y_samples.append(pred_y)

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

            safe_var_x = np.clip(var_x, 1.0, 20000.0)
            safe_var_y = np.clip(var_y, 1.0, 20000.0)

            self.kalman.measurementNoiseCov = np.array([
                [safe_var_x, 0],
                [0, safe_var_y]
            ], dtype=np.float32)

            # 2. Hard Offset Calculation (Mean Error)
            mean_pred_x = np.mean(predicted_x_samples)
            mean_pred_y = np.mean(predicted_y_samples)

            self.offset_x = true_center_x - mean_pred_x
            self.offset_y = true_center_y - mean_pred_y

            print(f"✅ Kalman Tuned! Var X: {var_x:.1f}, Var Y: {var_y:.1f}")
            print(f"✅ Offset Applied! X: {self.offset_x:+.1f}px, Y: {self.offset_y:+.1f}px")
        else:
            print("⚠️ Not enough data collected during tuning. Using defaults.")

    def _train(self):
        print("\nTraining Gaze Regression Model...")

        X_train_raw = np.array(self.raw_features)
        y_train = np.array(self.target_labels)

        X_train_scaled = self.scaler.fit_transform(X_train_raw)

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

        # 6. Apply Kalman Filter with Speed Limit
        measured = np.array([[raw_screen_x], [raw_screen_y]], dtype=np.float32)

        if not self.kalman_initialized:
            self.kalman.statePre = np.array(
                [[raw_screen_x], [raw_screen_y], [0], [0]], dtype=np.float32)
            self.kalman.statePost = np.array(
                [[raw_screen_x], [raw_screen_y], [0], [0]], dtype=np.float32)
            self.kalman_initialized = True
            self.smoothed_x = raw_screen_x
            self.smoothed_y = raw_screen_y

        self.kalman.correct(measured)
        predicted = self.kalman.predict()

        pred_x = predicted[0][0]
        pred_y = predicted[1][0]

        # --- THE SPEED LIMITER ---
        MAX_SPEED = 55.0 

        dx = pred_x - self.smoothed_x
        dy = pred_y - self.smoothed_y
        dist = np.hypot(dx, dy)

        if dist > MAX_SPEED:
            scale = MAX_SPEED / dist
            pred_x = self.smoothed_x + (dx * scale)
            pred_y = self.smoothed_y + (dy * scale)

            self.kalman.statePost[0, 0] = pred_x
            self.kalman.statePost[1, 0] = pred_y
            self.kalman.statePost[2, 0] = dx * scale  
            self.kalman.statePost[3, 0] = dy * scale  

        self.smoothed_x = pred_x
        self.smoothed_y = pred_y

        # 7. Clamp to screen bounds
        clamped_x = max(0, min(self.screen_w, int(self.smoothed_x)))
        clamped_y = max(0, min(self.screen_h, int(self.smoothed_y)))

        # --- 8. THE ELASTIC DEADZONE (Soft Fixation Filter) ---
        if not hasattr(self, 'final_cursor_x'):
            self.final_cursor_x = float(clamped_x)
            self.final_cursor_y = float(clamped_y)

        # Calculate distance from our visible cursor to the Kalman target
        dist_from_static = np.hypot(clamped_x - self.final_cursor_x, clamped_y - self.final_cursor_y)

        # The Deadzone Radius
        DEADZONE_RADIUS = 45.0 

        if dist_from_static > DEADZONE_RADIUS:
            # Eye moved outside the circle -> Follow normally
            self.final_cursor_x = float(clamped_x)
            self.final_cursor_y = float(clamped_y)
        else:
            # MICRO-ADJUSTMENT ZONE: Eye is moving inside the circle.
            # Instead of freezing completely (which ruins accuracy), we apply a heavy
            # "honey" filter. It absorbs the fast jitter but still settles exactly on your true target.
            micro_alpha = 0.05 
            self.final_cursor_x += micro_alpha * (clamped_x - self.final_cursor_x)
            self.final_cursor_y += micro_alpha * (clamped_y - self.final_cursor_y)

        return (int(self.final_cursor_x), int(self.final_cursor_y))
    
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