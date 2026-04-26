import cv2
import numpy as np
import matplotlib.pyplot as plt

# MediaPipe Core Tasks (The New API)
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Utilities for drawing and format conversion
from mediapipe.framework.formats import landmark_pb2
from mediapipe.python.solutions import drawing_utils, drawing_styles, face_mesh

# Local utilities
from utils import fit_sphere_constrained, plot_sphere

LEFT_IRIS_CENTER = 473
RIGHT_IRIS_CENTER = 468
LEFT_INNER = 362
LEFT_OUTER = 263
RIGHT_INNER = 133
RIGHT_OUTER = 33

LEFT_IRIS_INDICIES = [474, 475, 476, 477]
RIGHT_IRIS_INDICIES = [469, 470, 471, 472]

LEFT_EYELID_INDICIES = [
    263, 466, 388, 387, 386, 385, 384, 398, 362,
    382, 381, 380, 374, 373, 390, 249
]
RIGHT_EYELID_INDICIES = [
    33, 246, 161, 160, 159, 158, 157, 173, 133,
    155, 154, 153, 145, 144, 163, 7
]
IRIS_RADIUS_CM = 1.17 / 2  # avg diamter 11.7 +-0.5mm
EYEBALL_RADIUS_CM = 1.2  # avg diamter 24mm


class Face:

    def __init__(self, model_path: str, output_face_blendshapes: bool, output_facial_transformation_matrixes: bool, num_faces: int):
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=output_face_blendshapes,
            output_facial_transformation_matrixes=output_facial_transformation_matrixes,
            num_faces=num_faces)

        self.detector = vision.FaceLandmarker.create_from_options(options)
        self.detection_result = None
        self.absolute_x = 0
        self.absolute_y = 0
        self.absolute_z = 0

        self.left_iris_radius = None
        self.left_iris_px = None
        self.left_iris_3d = None
        self.left_eyeball_3d = None
        self.left_graze_ray = None
        self.left_eye_crop = np.zeros((36, 60, 3), dtype=np.uint8)

        self.right_iris_radius = None
        self.right_iris_px = None
        self.right_iris_3d = None
        self.right_eyeball_3d = None
        self.right_graze_ray = None
        self.right_eye_crop = np.zeros((36, 60, 3), dtype=np.uint8)

        self.iris_radius_px = None
        self.mm_per_pixel = None

        self.image_width = None
        self.image_height = None

    def update(self, bgr_image):
        height, width, _ = bgr_image.shape
        self.image_width = width
        self.image_height = height

        rgb_frame = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        self.detection_result = self.detector.detect(mp_image)

        if self.detection_result.facial_transformation_matrixes:
            matrix = self.detection_result.facial_transformation_matrixes[0]
            self.absolute_x, self.absolute_y, self.absolute_z = matrix[0:3, 3] / 2.54
            # print(
            #     f"Absolute X: {self.absolute_x:.2f} in, Absolute Y: {self.absolute_y:.2f} in, Absolute Z: {self.absolute_z:.2f} in")

        if not self.detection_result.face_landmarks:
            return

        self._update_eyeballs()
        self._update_irises()
        self._get_eye_cutouts(bgr_image)
        # print(self.left_iris_3d, self.right_iris_3d)
        self.left_graze_ray = self.left_iris_3d - self.left_eyeball_3d
        self.right_graze_ray = self.right_iris_3d - self.right_eyeball_3d

    def _get_eye_cutouts(self, frame, target_w=60, target_h=36):
        """
        Extracts and resizes the left and right eyes.
        Returns two 60x36 COLOR (BGR) numpy arrays.
        """
        if not self.detection_result or not self.detection_result.face_landmarks:
            return np.zeros((target_h, target_w, 3), np.uint8), np.zeros((target_h, target_w, 3), np.uint8)

        landmarks = self.detection_result.face_landmarks[0]
        h, w = frame.shape[:2]

        def get_processed_crop(indices):
            # 1. Get raw pixel coordinates for all eyelid points
            pts_x = [int(landmarks[i].x * w) for i in indices]
            pts_y = [int(landmarks[i].y * h) for i in indices]

            # 2. Find the tight bounding box and center
            min_x, max_x = min(pts_x), max(pts_x)
            min_y, max_y = min(pts_y), max(pts_y)

            cx = (min_x + max_x) // 2
            cy = (min_y + max_y) // 2

            # 3. Calculate current dimensions and add a 20% padding
            current_w = (max_x - min_x) * 1
            current_h = (max_y - min_y) * 1.2

            # 4. Force a strict 5:3 (Target Width / Target Height) aspect ratio
            target_ratio = target_w / target_h

            if current_w / current_h > target_ratio:
                current_h = current_w / target_ratio
            else:
                current_w = current_h * target_ratio

            # 5. Calculate new borders from the center
            start_x = int(cx - current_w / 2)
            end_x = int(cx + current_w / 2)
            start_y = int(cy - current_h / 2)
            end_y = int(cy + current_h / 2)

            # 6. Clamp to physical image boundaries
            start_x, end_x = max(0, start_x), min(w, end_x)
            start_y, end_y = max(0, start_y), min(h, end_y)

            # 7. Slice the image
            crop = frame[start_y:end_y, start_x:end_x]

            if crop.size == 0:
                return None

            # 8. Resize (Still in Color)
            resized = cv2.resize(crop, (target_w, target_h),
                                 interpolation=cv2.INTER_AREA)

            return resized

        self.left_eye_crop = get_processed_crop(LEFT_EYELID_INDICIES)
        self.right_eye_crop = get_processed_crop(RIGHT_EYELID_INDICIES)

    def get_eye_scalars(self):
        # Safety check in case the eyes weren't detected
        if self.left_eye_crop is None or self.right_eye_crop is None:
            return None

        # 1. Convert to Grayscale
        left_gray = cv2.cvtColor(self.left_eye_crop, cv2.COLOR_BGR2GRAY)
        right_gray = cv2.cvtColor(self.right_eye_crop, cv2.COLOR_BGR2GRAY)

        # 2. Equalize Histogram (Crucial for Ridge Regression)
        left_eq = cv2.equalizeHist(left_gray)
        right_eq = cv2.equalizeHist(right_gray)

        # 3. Flatten into 1D arrays
        left_eye_flat = left_eq.flatten()
        right_eye_flat = right_eq.flatten()

        # 4. Concatenate into a single feature vector
        fused = np.concatenate([left_eye_flat, right_eye_flat])

        return fused

    def _update_eyeballs(self):
        # 1. Extract the Head's 3x3 Rotation Matrix
        matrix = self.detection_result.facial_transformation_matrixes[0]
        rotation_matrix = matrix[0:3, 0:3]

        # 2. Define the biological offsets in LOCAL Head Space
        # X: Lateral (Left/Right), Y: Vertical (Up/Down), Z: Depth
        # In MediaPipe local space, +Z points OUT of the face, so -1.2 pushes INTO the skull
        DEPTH_OFFSET = -EYEBALL_RADIUS_CM
        LATERAL_OFFSET = 0.20
        VERTICAL_OFFSET = 0.0

        # ================= LEFT EYE =================
        inner_L = self.get_xyz(LEFT_INNER)
        outer_L = self.get_xyz(LEFT_OUTER)
        socket_L = (inner_L + outer_L) / 2.0

        # Left eye is on the negative X side of the face. Outward is more negative.
        local_offset_L = np.array(
            [-LATERAL_OFFSET, VERTICAL_OFFSET, DEPTH_OFFSET])

        # Rotate the local offset to match the user's current head tilt/yaw
        global_offset_L = rotation_matrix @ local_offset_L

        # Apply the rotated offset to the socket
        self.left_eyeball_3d = socket_L + global_offset_L

        # ================= RIGHT EYE =================
        inner_R = self.get_xyz(RIGHT_INNER)
        outer_R = self.get_xyz(RIGHT_OUTER)
        socket_R = (inner_R + outer_R) / 2.0

        # Right eye is on the positive X side. Outward is positive.
        local_offset_R = np.array(
            [LATERAL_OFFSET, VERTICAL_OFFSET, DEPTH_OFFSET])

        global_offset_R = rotation_matrix @ local_offset_R

        self.right_eyeball_3d = socket_R + global_offset_R

    def _update_irises(self):
        face_landmarks = self.detection_result.face_landmarks[0]
        width, height = self.image_width, self.image_height

        # update information on the left iris
        left_iris_center = face_landmarks[LEFT_IRIS_CENTER]
        left_center_px = np.array(
            [left_iris_center.x * width, left_iris_center.y * height])
        left_ring_px = np.array(
            [[face_landmarks[i].x * width, face_landmarks[i].y * height] for i in LEFT_IRIS_INDICIES])
        avg_left_iris_radius = np.mean(np.linalg.norm(
            left_center_px - left_ring_px, axis=1))

        # update information on the right iris
        right_iris_center = face_landmarks[RIGHT_IRIS_CENTER]
        right_center_px = np.array(
            [right_iris_center.x * width, right_iris_center.y * height])
        right_ring_px = np.array(
            [[face_landmarks[i].x * width, face_landmarks[i].y * height] for i in RIGHT_IRIS_INDICIES])
        avg_right_iris_radius = np.mean(np.linalg.norm(
            right_center_px - right_ring_px, axis=1))

        self.left_iris_3d = self.get_surface_pupil_3d(
            left_iris_center, self.left_eyeball_3d)
        self.right_iris_3d = self.get_surface_pupil_3d(
            right_iris_center, self.right_eyeball_3d)

        # assign for use later
        self.left_iris_radius = int(avg_left_iris_radius)
        self.right_iris_radius = int(avg_right_iris_radius)
        self.left_iris_px = tuple(left_center_px.astype(int))
        self.right_iris_px = tuple(right_center_px.astype(int))

        # use the larger iris radius in pixels to calculate the mm per pixel scaling factor
        self.iris_radius_px = max(avg_left_iris_radius, avg_right_iris_radius)
        self.mm_per_pixel = IRIS_RADIUS_CM / self.iris_radius_px

    def get_surface_pupil_3d(self, iris_landmark, eyeball_center_3d):
        """
        Projects a 2D iris pixel onto the 3D surface of the eyeball sphere
        using exact Line-Sphere Intersection.
        """
        px = iris_landmark.x * self.image_width
        py = iris_landmark.y * self.image_height

        fx = self.image_width
        fy = self.image_width
        cx = self.image_width / 2.0
        cy = self.image_height / 2.0

        # 1. Define the Camera Ray
        # The point on the flat plane is perfectly aligned with the camera lens
        fixed_z = eyeball_center_3d[2]
        flat_x = ((px - cx) * fixed_z) / fx
        flat_y = ((py - cy) * fixed_z) / fy

        # V represents the 3D ray shooting out of the camera lens
        V = np.array([flat_x, flat_y, fixed_z])
        C = eyeball_center_3d
        R = EYEBALL_RADIUS_CM

        # 2. Line-Sphere Intersection Math (Solving for scalar 't')
        # We want to find where (t * V) intersects the sphere at C
        A = np.dot(V, V)
        B = -2.0 * np.dot(V, C)
        C_term = np.dot(C, C) - (R**2)

        discriminant = B**2 - 4 * A * C_term

        if discriminant < 0:
            # Fallback: The camera ray missed the mathematical sphere due to 2D tracking noise.
            # We push the ray point to the closest possible front-surface depth.
            ray_normalized = V / np.linalg.norm(V)
            center_dist = np.linalg.norm(C)
            return ray_normalized * (center_dist - R)

        # 3. Solve the quadratic equation
        t1 = (-B - np.sqrt(discriminant)) / (2.0 * A)
        t2 = (-B + np.sqrt(discriminant)) / (2.0 * A)

        # We want the intersection on the FRONT of the eyeball (closest to the camera)
        t_front = min(t1, t2)

        # Apply the scalar to the ray to get the exact true-3D surface coordinate
        return V * t_front

    def draw_landmark_mesh(self, image):
        face_landmarks_list = self.detection_result.face_landmarks

        for face_landmarks in face_landmarks_list:
            # Convert list to Protobuf for drawing_utils
            face_landmarks_proto = landmark_pb2.NormalizedLandmarkList()
            face_landmarks_proto.landmark.extend([
                landmark_pb2.NormalizedLandmark(
                    x=landmark.x, y=landmark.y, z=landmark.z)
                for landmark in face_landmarks
            ])

            # 1. Draw Mesh (Tesselation)
            drawing_utils.draw_landmarks(
                image=image,
                landmark_list=face_landmarks_proto,
                connections=face_mesh.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=drawing_styles.get_default_face_mesh_tesselation_style())

            # 2. Draw Eye/Lip Outlines (Contours)
            drawing_utils.draw_landmarks(
                image=image,
                landmark_list=face_landmarks_proto,
                connections=face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=drawing_styles.get_default_face_mesh_contours_style())

            # 3. Draw Irises (Crucial for eye tracking!)
            drawing_utils.draw_landmarks(
                image=image,
                landmark_list=face_landmarks_proto,
                connections=face_mesh.FACEMESH_IRISES,
                landmark_drawing_spec=None,
                connection_drawing_spec=drawing_styles.get_default_face_mesh_iris_connections_style())

        return image

    def draw_iris_contours(self, image):
        if not self.detection_result.face_landmarks:
            return image

        cv2.circle(image, self.right_iris_px,
                   self.left_iris_radius, (0, 255, 0), 1, cv2.LINE_AA)
        cv2.circle(image, self.right_iris_px, 1, (255, 255, 255), -1)

        cv2.circle(image, self.left_iris_px,
                   self.right_iris_radius, (255, 0, 0), 1, cv2.LINE_AA)
        cv2.circle(image, self.left_iris_px, 1, (255, 255, 255), -1)

        return image

    def draw_eyeballs_3d(self, image):
        if not self.detection_result or not self.detection_result.face_landmarks:
            return image

        if self.left_eyeball_3d is not None:
            center_px = self.project_3d_to_pixel(self.left_eyeball_3d)
            # Calculate apparent 2D pixel radius based on 3D depth
            radius_px = int(
                (EYEBALL_RADIUS_CM / abs(self.left_eyeball_3d[2])) * self.image_width)
            cv2.circle(image, center_px, radius_px, (0, 255, 255), 1)
            cv2.circle(image, center_px, 2, (0, 0, 255), -1)  # Center dot

        if self.right_eyeball_3d is not None:
            center_px = self.project_3d_to_pixel(self.right_eyeball_3d)
            radius_px = int(
                (EYEBALL_RADIUS_CM / abs(self.right_eyeball_3d[2])) * self.image_width)
            cv2.circle(image, center_px, radius_px, (255, 255, 0), 1)
            cv2.circle(image, center_px, 2, (0, 0, 255), -1)  # Center dot
        return image

    def plot_eye_3d(self):
        if not self.detection_result.face_landmarks:
            print("No landmarks detected")
            return

        # Extract data
        eyelid_pts = self.get_xyz(LEFT_EYELID_INDICIES)
        iris_center = self.get_xyz(LEFT_IRIS_CENTER)
        iris_ring_pts = self.get_xyz(LEFT_IRIS_INDICIES)

        # Setup Plot
        fig = plt.figure(figsize=(10, 8))
        ax = fig.add_subplot(111, projection='3d')

        # Plot Eyelid Contour
        # We add the first point to the end to close the loop
        eyelid_loop = np.vstack([eyelid_pts, eyelid_pts[0]])
        ax.plot(eyelid_loop[:, 0], eyelid_loop[:, 1], eyelid_loop[:, 2],
                label='Eyelid Contour', color='black', marker='o', markersize=3)

        # Plot Iris Ring
        iris_loop = np.vstack([iris_ring_pts, iris_ring_pts[0]])
        ax.plot(iris_loop[:, 0], iris_loop[:, 1], iris_loop[:, 2],
                label='Iris Ring', color='blue', alpha=0.6)

        # Plot Iris Center
        ax.scatter(iris_center[0], iris_center[1], iris_center[2],
                   color='red', s=50, label='Iris Center (Pupil)')

        center, radius = fit_sphere_constrained(eyelid_pts, EYEBALL_RADIUS_CM)
        # print(radius)
        x, y, z = plot_sphere(center, radius)
        ax.plot_surface(x, y, z, color='b', alpha=0.3)

        # Labels and Formatting
        ax.set_box_aspect((1, 1, 1))
        ax.set_xlabel('X (Horizontal)')
        ax.set_ylabel('Y (Vertical)')
        ax.set_zlabel('Z (Depth)')
        ax.set_title('3D Geometric Eye Model')
        ax.legend()

        # Invert Y and Z for standard camera view (optional)
        ax.invert_yaxis()
        ax.invert_zaxis()

        plt.show()

    def get_xyz(self, indices):
        face_landmarks = self.detection_result.face_landmarks[0]
        if isinstance(indices, int):
            lm = face_landmarks[indices]
            return np.array(self.deproject_pixel_to_camera_space(lm.x, lm.y, lm.z))
        return np.array([self.deproject_pixel_to_camera_space(face_landmarks[i].x, face_landmarks[i].y, face_landmarks[i].z) for i in indices])

    def draw_head_pose_axes(self, image, axis_length_cm=5.0):
        if not self.detection_result or not self.detection_result.facial_transformation_matrixes:
            return image

        # 1. Extract the 4x4 Transformation Matrix
        matrix = self.detection_result.facial_transformation_matrixes[0]

        # 2. Define the 3D axes in canonical space
        pts_3d = np.array([
            [0, 0, 0, 1],                          # Origin
            [axis_length_cm, 0, 0, 1],             # X-axis (Right)
            [0, axis_length_cm, 0, 1],             # Y-axis (Down)
            [0, 0, axis_length_cm, 1]              # Z-axis (Forward/Out)
        ]).T

        # 3. Transform to 3D camera space
        pts_cam = matrix @ pts_3d

        # 4. Project using the new helper function (Enabling the mirror fix)
        origin = self.project_3d_to_pixel(
            pts_cam[:, 0][:3], invert_x=True)
        x_pt = self.project_3d_to_pixel(
            pts_cam[:, 1][:3], invert_x=True)
        y_pt = self.project_3d_to_pixel(
            pts_cam[:, 2][:3], invert_x=True)
        z_pt = self.project_3d_to_pixel(
            pts_cam[:, 3][:3], invert_x=True)

        # 5. Draw the axes
        cv2.line(image, origin, x_pt, (0, 0, 255), 3)  # Red X
        cv2.line(image, origin, y_pt, (0, 255, 0), 3)  # Green Y
        cv2.line(image, origin, z_pt, (255, 0, 0), 3)  # Blue Z

        return image

    def deproject_pixel_to_camera_space(self, percentage_width, percentage_height, z_offset):
        """
        Converts a 2D screen pixel into a true 3D coordinate relative to the camera lens.
        """
        # Approximate camera intrinsics (MediaPipe's default assumption)
        fx = self.image_width
        fy = self.image_width
        cx = self.image_width / 2.0
        cy = self.image_height / 2.0

        pixel_x = percentage_width * self.image_width
        pixel_y = percentage_height * self.image_height
        # Z translation component in cm
        depth_z_cm = (
            self.detection_result.facial_transformation_matrixes[0][2, 3]) * (1 + z_offset)

        # Apply Inverse Pinhole Math
        x_cam_cm = ((pixel_x - cx) * depth_z_cm) / fx
        y_cam_cm = ((pixel_y - cy) * depth_z_cm) / fy

        # Return the absolute 3D coordinate (X, Y, Z) in centimeters
        return np.array([x_cam_cm, y_cam_cm, depth_z_cm])

    def project_3d_to_pixel(self, pt_3d, invert_x=False):
        """
        Forward projects a true 3D coordinate (in cm) back onto the 2D screen.
        """
        x, y, z = pt_3d

        # Avoid division by zero if a point crosses the exact camera lens plane
        if z == 0:
            z = 1e-5

        # Approximate camera intrinsics
        fx = self.image_width
        fy = self.image_width
        cx = self.image_width / 2.0
        cy = self.image_height / 2.0

        # Handle the selfie-mirror effect if explicitly requested
        if invert_x:
            x = -x

        # Forward Pinhole Math (Inverse of deproject)
        pixel_x = int((x / z) * fx + cx)
        pixel_y = int((y / z) * fy + cy)

        return (pixel_x, pixel_y)

    def draw_view_rays(self, image):
        # 1. Safety Checks
        if not self.detection_result or not self.detection_result.face_landmarks:
            return image

        if self.left_iris_3d is None or self.left_eyeball_3d is None:
            return image

        # Internal Helper to keep things DRY
        def draw_ray(eyeball_3d, iris_3d, color):
            # 2. Vector Math: Find the direction vector (Destination - Origin)
            direction_vector = iris_3d - eyeball_3d

            # 3. Extrapolate: Scale the vector by 10x and add it to the origin
            # Since direction_vector is exactly 1x the distance, multiplying by 10
            # shoots the point out 10x further along that exact line.
            ray_end_3d = eyeball_3d + (direction_vector * 10.0)

            # 4. Project 3D physical coordinates back to 2D screen pixels
            start_px = self.project_3d_to_pixel(eyeball_3d)
            end_px = self.project_3d_to_pixel(ray_end_3d)

            # 5. Draw the ray
            cv2.line(image, start_px, end_px, color, 3)

            # Optional: Draw a small dot at the end of the ray to make the tip obvious
            cv2.circle(image, end_px, 4, color, -1)

        # Draw Left Eye Gaze Ray (Yellow)
        draw_ray(self.left_eyeball_3d, self.left_iris_3d, (0, 255, 255))

        # Draw Right Eye Gaze Ray (Cyan)
        if self.right_iris_3d is not None and self.right_eyeball_3d is not None:
            draw_ray(self.right_eyeball_3d, self.right_iris_3d, (255, 255, 0))

        return image

    def generate_point_grid(self):
        if not self.detection_result or not self.detection_result.face_landmarks:
            print("No landmarks detected")
            return

        # Setup Plot
        fig = plt.figure(figsize=(12, 10))
        ax = fig.add_subplot(111, projection='3d')

        # 1. Get All Face Mesh Points (478 points)
        # Using your existing get_xyz function to deproject the entire face
        num_landmarks = len(self.detection_result.face_landmarks[0])
        all_indices = list(range(num_landmarks))
        all_pts_3d = self.get_xyz(all_indices)

        # 2. Extract Specific Eye Components
        left_iris_center = self.get_xyz(LEFT_IRIS_CENTER)
        right_iris_center = self.get_xyz(RIGHT_IRIS_CENTER)

        left_eyelid_pts = self.get_xyz(LEFT_EYELID_INDICIES)
        right_eyelid_pts = self.get_xyz(RIGHT_EYELID_INDICIES)

        # ---------------- DRAWING THE COMPONENTS ----------------

        # A. Plot Full Face Mesh (Ghostly grey dots)
        ax.scatter(all_pts_3d[:, 0], all_pts_3d[:, 1], all_pts_3d[:, 2],
                   color='gray', s=8, alpha=0.4, label='Face Mesh')

        # B. Plot Irises (Bright distinct dots)
        ax.scatter(left_iris_center[0], left_iris_center[1], left_iris_center[2],
                   color='lime', s=60, label='Left Iris')
        ax.scatter(right_iris_center[0], right_iris_center[1], right_iris_center[2],
                   color='red', s=60, label='Right Iris')

        # plot ray intersection (view point)
        intersection = self.get_raw_gaze_intersection()
        ax.scatter(intersection[0], intersection[1], intersection[2],
                   color='purple', s=60, label='Gaze Intersection')

        # C. Plot Solid Eyeballs (Translucent 3D Surfaces)
        x_L, y_L, z_L = plot_sphere(self.left_eyeball_3d, EYEBALL_RADIUS_CM)
        ax.plot_surface(x_L, y_L, z_L, color='cyan', alpha=0.3)

        x_R, y_R, z_R = plot_sphere(self.right_eyeball_3d, EYEBALL_RADIUS_CM)
        ax.plot_surface(x_R, y_R, z_R, color='magenta', alpha=0.3)

        # D. Plot Gaze Rays
        def plot_ray(eyeball, iris, color, label):
            direction = iris - eyeball

            ray_end = eyeball + (direction * 15)
            ax.plot([eyeball[0], ray_end[0]], [eyeball[1], ray_end[1]], [eyeball[2], ray_end[2]],
                    color=color, linewidth=2, label=label)

        plot_ray(self.left_eyeball_3d, self.left_iris_3d, 'cyan', 'Left Gaze')
        plot_ray(self.right_eyeball_3d, self.right_iris_3d,
                 'magenta', 'Right Gaze')

        # E. Generate the Absolute "Z-Depth Wall"
        # Extract the base macro depth of the face from the matrix
        matrix = self.detection_result.facial_transformation_matrixes[0]
        base_depth_cm = matrix[2, 3]

        # Find the physical X/Y bounds of the face to size the wall
        min_x, max_x = np.min(all_pts_3d[:, 0]), np.max(all_pts_3d[:, 0])
        min_y, max_y = np.min(all_pts_3d[:, 1]), np.max(all_pts_3d[:, 1])

        # Add 5cm padding around the face bounds
        pad = 5.0

        # Create a 2D grid spanning the face
        xx, yy = np.meshgrid(
            np.linspace(min_x - pad, max_x + pad, 20),
            np.linspace(min_y - pad, max_y + pad, 20)
        )
        # Force every point on the grid to live at the absolute Z depth
        zz = np.full_like(xx, 0)

        # Plot the focal wall as a translucent sheet
        ax.plot_surface(xx, yy, zz, color='yellow', alpha=0.2)
        # Draw the grid points on the sheet
        ax.scatter(xx, yy, zz, color='orange', s=5,
                   alpha=0.6, label='Absolute Z-Wall')

        # ---------------- FORMATTING ----------------

        ax.set_xlabel('X (cm)')
        ax.set_ylabel('Y (cm)')
        ax.set_zlabel('Z (cm)')
        ax.set_title('3D Face Metric Space Visualization')

        # Invert axes so the view matches a mirrored camera feed
        ax.invert_yaxis()
        ax.invert_zaxis()

        # Clean up the legend (prevents duplicate labels)
        handles, labels = ax.get_legend_handles_labels()
        by_label = dict(zip(labels, handles))
        ax.legend(by_label.values(), by_label.keys(),
                  loc='center left', bbox_to_anchor=(1, 0.5))

        plt.show()

    def get_raw_gaze_intersection(self):
        if self.left_graze_ray is None or self.right_graze_ray is None:
            return None

        t = -self.left_eyeball_3d[2] / \
            self.left_graze_ray[2]  # Solve for when z=0
        left_intersection_point = self.left_eyeball_3d + t * self.left_graze_ray

        t = -self.right_eyeball_3d[2] / \
            self.right_graze_ray[2]  # Solve for when z=0
        right_intersection_point = self.right_eyeball_3d + t * self.right_graze_ray

        avg_intersection_point = np.mean(
            [left_intersection_point, right_intersection_point], axis=0)

        return avg_intersection_point

    def get_pose_ray_intersection(self):
        """
        Shoots a ray straight out of the face (perpendicular to the face plane) 
        and finds where it hits the Z=0 plane.
        """
        if not self.detection_result or not self.detection_result.facial_transformation_matrixes:
            return None

        # 1. The origin is the center of the face (from the translation vector of the matrix)
        matrix = self.detection_result.facial_transformation_matrixes[0]
        # Convert to cm just like the eyes
        face_origin_3d = matrix[0:3, 3]

        # 2. The direction vector is the Z-axis of the rotation matrix.
        # MediaPipe's +Z points OUT of the face toward the camera.
        face_direction_vector = matrix[0:3, 2]

        if face_direction_vector[2] == 0:
            return None

        # 3. Intersect with Z=0 (Same math as the gaze rays)
        t = -face_origin_3d[2] / face_direction_vector[2]

        hit_x = face_origin_3d[0] + (face_direction_vector[0] * t)
        hit_y = face_origin_3d[1] + (face_direction_vector[1] * t)

        return np.array([hit_x, hit_y, 0])
