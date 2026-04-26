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
                        for y in np.linspace(0.05, 0.95, 3) for x in np.linspace(0.05, 0.95, 3)]

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

        # 1. Get the raw live pixel array from the camera frame
        # (Assuming you are passing the 'frame' into this function or grabbing it)
        raw_features = self.face.get_eye_scalars()

        if raw_features is None:
            return None

        # 2. Reshape the 1D array into a 2D matrix (1 row, 4320 columns)
        # scikit-learn STRICTLY requires 2D arrays for predictions
        raw_features_2d = raw_features.reshape(1, -1)

        # 3. Apply the Transform! (Squish 0-255 down to -3 to 3)
        # DO NOT use fit_transform here, only transform() to use the saved weights
        scaled_features = self.scaler.transform(raw_features_2d)

        # 4. Predict the Screen Percentages
        prediction = self.model.predict(scaled_features)

        # prediction is a 2D array like [[0.45, 0.60]], extract the values
        percent_x, percent_y = prediction[0]

        # 5. Scale to actual monitor pixels
        raw_screen_x = percent_x * self.screen_w
        raw_screen_y = percent_y * self.screen_h

        # 6. Apply EMA Filter to kill the noise
        alpha = 0.15

        if self.smoothed_x is None:
            self.smoothed_x = raw_screen_x
            self.smoothed_y = raw_screen_y
        else:
            self.smoothed_x = (alpha * raw_screen_x) + \
                ((1.0 - alpha) * self.smoothed_x)
            self.smoothed_y = (alpha * raw_screen_y) + \
                ((1.0 - alpha) * self.smoothed_y)

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
