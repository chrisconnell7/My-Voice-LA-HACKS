import numpy as np
from mpl_toolkits.mplot3d import Axes3D
import matplotlib.pyplot as plt
from scipy.optimize import least_squares


def fit_sphere(points):
    """
    Fits a sphere to a collection of 3D points.
    :param points: Nx3 numpy array of (x, y, z) coordinates
    :return: center (1x3 array), radius (float)
    """
    # 1. Setup the A matrix
    # Columns are 2*x, 2*y, 2*z, and a column of ones
    A = np.zeros((len(points), 4))
    A[:, 0] = points[:, 0] * 2
    A[:, 1] = points[:, 1] * 2
    A[:, 2] = points[:, 2] * 2
    A[:, 3] = 1

    # 2. Setup the B vector
    # B = x^2 + y^2 + z^2
    B = points[:, 0]**2 + points[:, 1]**2 + points[:, 2]**2

    # 3. Solve the linear system using Least Squares
    # result = [xc, yc, zc, w]
    result, residues, rank, sing = np.linalg.lstsq(A, B, rcond=None)

    # 4. Extract center and calculate radius
    center = result[0:3]
    # w = R^2 - xc^2 - yc^2 - zc^2  => R = sqrt(w + xc^2 + yc^2 + zc^2)
    radius = np.sqrt(result[3] + np.sum(center**2))

    return center, radius


def plot_sphere(center, radius):
    """
    Plots a sphere in 3D using Matplotlib.
    :param center: 1x3 array of (x, y, z) coordinates for the sphere center
    :param radius: radius of the sphere
    """

    # Create a grid of points for the sphere surface
    u = np.linspace(0, 2 * np.pi, 100)
    v = np.linspace(0, np.pi, 100)
    x = center[0] + radius * np.outer(np.cos(u), np.sin(v))
    y = center[1] + radius * np.outer(np.sin(u), np.sin(v))
    z = center[2] + radius * np.outer(np.ones(np.size(u)), np.cos(v))

    return x, y, z


def fit_sphere_constrained(points, fixed_radius_cm):
    """
    Fits a sphere to 3D points, forcing the radius to a specific biological constant.
    :param points: Nx3 numpy array of (x, y, z) eyelid coordinates
    :param fixed_radius_cm: float, the exact radius you want in centimeters
    :return: center (1x3 array), fixed_radius (float)
    """

    fixed_radius = fixed_radius_cm  # MP units are cm
    # 1. Define the Cost Function
    # This function calculates the error we want to minimize.
    # It measures the distance from our guessed center to every eyelid point,
    # and subtracts our strict fixed_radius.
    # A perfect fit means this returns an array of zeros.

    def cost_function(center, pts, R):
        distances = np.linalg.norm(pts - center, axis=1)
        return distances - R

    # 2. Provide a Smart Initial Guess
    # Optimization algorithms need a starting point.
    # If we start at (0,0,0), it might get confused.
    # Let's start with our logical geometric deduction:
    # The centroid of the eyelids, pushed back by the radius!
    eyelid_centroid = np.mean(points, axis=0)
    initial_guess = np.copy(eyelid_centroid)
    initial_guess[2] -= fixed_radius  # Assuming -Z goes into the head

    # 3. Run the Non-Linear Least Squares Solver
    # This will iteratively move the [xc, yc, zc] center point to minimize the error
    result = least_squares(cost_function, initial_guess,
                           args=(points, fixed_radius))

    # 4. Extract the mathematically optimized center
    optimized_center = result.x

    return optimized_center, fixed_radius
