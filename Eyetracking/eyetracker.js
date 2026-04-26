// 1. Import MediaPipe Vision tasks
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Matrix, solve } from "https://esm.sh/ml-matrix@6.11.0";

const LEFT_EYELID_INDICIES = [
  263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390,
  249,
];
const RIGHT_EYELID_INDICIES = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
];

// --- NATIVE ML & MATH CLASSES ---

class RidgeRegression {
  constructor(X, y, options = {}) {
    this.alpha = options.alpha || 1.0;
    this.weights = null;
    this.fit(X, y);
  }

  fit(X, y) {
    // Wrap raw arrays into specialized Matrix objects
    const matrixX = new Matrix(X);
    const matrixY = new Matrix(y);
    const N = matrixX.rows;

    // 1. Calculate Gram Matrix: K = X * X^T
    // matrix.mmul() is highly optimized for TypedArrays
    let K = matrixX.mmul(matrixX.transpose());

    // 2. Add Regularization: (K + alpha * I)
    // We use a diagonal matrix for the alpha penalty
    const identity = Matrix.eye(N).mul(this.alpha);
    const regularizedK = K.add(identity);

    // 3. Solve the Linear System: (K + alpha*I)^-1 * y
    // .solve() uses LU or QR decomposition (way faster than manual inversion)
    const dualWeights = solve(regularizedK, matrixY);

    // 4. Final Weights: W = X^T * dualWeights
    this.weights = matrixX.transpose().mmul(dualWeights);
  }

  predict(X) {
    const inputMatrix = new Matrix(X);
    // Result = X * W
    const prediction = inputMatrix.mmul(this.weights);
    return prediction.to2DArray();
  }
}
class StandardScaler {
  constructor() {
    this.means = [];
    this.stds = [];
  }

  fit(data) {
    const numFeatures = data[0].length;
    const numSamples = data.length;
    this.means = new Array(numFeatures).fill(0);
    this.stds = new Array(numFeatures).fill(0);

    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        this.means[j] += data[i][j];
      }
    }
    for (let j = 0; j < numFeatures; j++) {
      this.means[j] /= numSamples;
    }

    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        this.stds[j] += Math.pow(data[i][j] - this.means[j], 2);
      }
    }
    for (let j = 0; j < numFeatures; j++) {
      this.stds[j] = Math.sqrt(this.stds[j] / numSamples);
      if (this.stds[j] === 0) this.stds[j] = 1;
    }
  }

  transform(data) {
    return data.map((row) =>
      row.map((val, j) => (val - this.means[j]) / this.stds[j]),
    );
  }
}

class KalmanFilter1D {
  constructor(processNoise = 0.05, measureNoise = 1.5) {
    this.x = 0;
    this.v = 0;
    this.p_x = 1;
    this.p_v = 1;
    this.p_xv = 0;

    this.q = processNoise;
    this.r = measureNoise;
  }

  predict() {
    this.x += this.v;
    this.p_x += this.p_v + 2 * this.p_xv + this.q;
    this.p_xv += this.p_v;
    this.p_v += this.q;
  }

  correct(measurement) {
    let k_x = this.p_x / (this.p_x + this.r);
    let k_v = this.p_xv / (this.p_x + this.r);
    let innovation = measurement - this.x;

    this.x += k_x * innovation;
    this.v += k_v * innovation;

    let p_x_new = this.p_x * (1 - k_x);
    let p_v_new = this.p_v - k_v * this.p_xv;
    let p_xv_new = this.p_xv * (1 - k_x);

    this.p_x = p_x_new;
    this.p_v = p_v_new;
    this.p_xv = p_xv_new;
  }
}

class EyeFilter {
  constructor() {
    this.kx = new KalmanFilter1D();
    this.ky = new KalmanFilter1D();
    this.initialized = false;
  }

  updateNoise(varX, varY) {
    this.kx.r = varX;
    this.ky.r = varY;
  }

  update(measX, measY) {
    if (!this.initialized) {
      this.kx.x = measX;
      this.ky.x = measY;
      this.initialized = true;
    }

    this.kx.predict();
    this.ky.predict();

    this.kx.correct(measX);
    this.ky.correct(measY);

    return [this.kx.x, this.ky.x];
  }
}

class OpenCVFeatureExtractor {
  constructor(videoW, videoH) {
    this.videoW = videoW;
    this.videoH = videoH;
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  getEyeCrop(video, landmarks, indices) {
    let ptsX = indices.map((i) => landmarks[i].x * this.videoW);
    let ptsY = indices.map((i) => landmarks[i].y * this.videoH);

    let minX = Math.min(...ptsX),
      maxX = Math.max(...ptsX);
    let minY = Math.min(...ptsY),
      maxY = Math.max(...ptsY);

    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    let currentW = (maxX - minX) * 1.2;
    let currentH = (maxY - minY) * 1.2;

    let targetRatio = 60 / 36;
    if (currentW / currentH > targetRatio) {
      currentH = currentW / targetRatio;
    } else {
      currentW = currentH * targetRatio;
    }

    let startX = Math.max(0, cx - currentW / 2);
    let startY = Math.max(0, cy - currentH / 2);

    this.offscreenCanvas.width = currentW;
    this.offscreenCanvas.height = currentH;
    this.offscreenCtx.drawImage(
      video,
      startX,
      startY,
      currentW,
      currentH,
      0,
      0,
      currentW,
      currentH,
    );

    let mat = cv.imread(this.offscreenCanvas);
    let resized = new cv.Mat();
    let gray = new cv.Mat();
    let equalized = new cv.Mat();

    cv.resize(mat, resized, new cv.Size(60, 36), 0, 0, cv.INTER_AREA);
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, equalized);

    let flattened = new Float32Array(equalized.data);

    mat.delete();
    resized.delete();
    gray.delete();
    equalized.delete();

    return flattened;
  }

  getEyeScalars(video, landmarks) {
    let leftEq = this.getEyeCrop(video, landmarks, LEFT_EYELID_INDICIES);
    let rightEq = this.getEyeCrop(video, landmarks, RIGHT_EYELID_INDICIES);

    let fused = new Float32Array(leftEq.length + rightEq.length);
    fused.set(leftEq);
    fused.set(rightEq, leftEq.length);
    return Array.from(fused);
  }
}

// --- MAIN APP COMPONENT ---

class EyeTrackerCalibration {
  constructor() {
    this.initUI();

    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;

    this.faceLandmarker = null;
    this.extractor = null;

    this.scaler = new StandardScaler();
    this.model = null;
    this.kalman = null;

    this.targets = [
      [0.5, 0.5],
      [0.05, 0.05],
      [0.5, 0.05],
      [0.95, 0.05],
      [0.95, 0.5],
      [0.95, 0.95],
      [0.5, 0.95],
      [0.05, 0.95],
      [0.05, 0.5],
    ];

    this.state = "WAITING_FOR_OPENCV";
    this.currentTargetIdx = 0;

    this.rawFeatures = [];
    this.targetLabels = [];
    this.tuningSamples = [];

    this.offsetX = 0;
    this.offsetY = 0;

    this.checkDependencies();
  }

  checkDependencies() {
    if (typeof cv === "undefined") {
      console.log("⏳ 1/4: Waiting for OpenCV script to download...");
      setTimeout(() => this.checkDependencies(), 500);
    } else if (typeof cv.Mat === "undefined") {
      console.log(
        "⚙️ 2/4: OpenCV downloaded! Waiting for WebAssembly to compile...",
      );
      setTimeout(() => this.checkDependencies(), 500);
    } else {
      console.log("✅ 3/4: OpenCV is fully loaded and WebAssembly is ready!");
      this.initOpenCVKalman();
      this.initMediaPipe();
    }
  }

  async initMediaPipe() {
    console.log("🚀 Initializing MediaPipe Vision...");
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU",
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 1,
      });

      console.log(
        "📷 Requesting webcam permissions... (Check your browser's address bar!)",
      );

      // CRITICAL FIX: Request native resolution by passing high "ideal" values
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          facingMode: "user",
        },
      });
      console.log("✅ 4/4: Webcam access granted! Starting loop...");

      this.video.srcObject = stream;
      this.video.addEventListener("loadeddata", () => {
        this.extractor = new OpenCVFeatureExtractor(
          this.video.videoWidth,
          this.video.videoHeight,
        );
        this.state = "INSTRUCT";
        this.instructionStartTime = performance.now();
        requestAnimationFrame((time) => this.loop(time));
      });
    } catch (err) {
      console.error(
        "❌ CRITICAL ERROR: Failed to load MediaPipe or access the Webcam!",
        err,
      );
    }
  }

  initOpenCVKalman() {
    this.kalman = new EyeFilter();
  }

  initUI() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    document.body.appendChild(this.canvas);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = "white";
    this.canvas.style.display = "block";
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  drawTarget(x, y, radius) {
    this.ctx.strokeStyle = "#888888";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 20, y);
    this.ctx.lineTo(x + 20, y);
    this.ctx.moveTo(x, y - 20);
    this.ctx.lineTo(x, y + 20);
    this.ctx.stroke();

    if (radius > 0) {
      this.ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  loop(time) {
    let landmarks = null;
    if (this.video.currentTime > 0 && this.faceLandmarker) {
      const results = this.faceLandmarker.detectForVideo(this.video, time);
      if (results.faceLandmarks.length > 0)
        landmarks = results.faceLandmarks[0];
    }

    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === "INSTRUCT") {
      this.ctx.fillStyle = "black";
      this.ctx.font = "30px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "🚀 KEEP YOUR HEAD STILL",
        this.canvas.width / 2,
        this.canvas.height / 2 - 20,
      );
      this.ctx.font = "20px Arial";
      this.ctx.fillText(
        "Follow the dots with your eyes.",
        this.canvas.width / 2,
        this.canvas.height / 2 + 20,
      );

      if (time - this.instructionStartTime > 3000) {
        this.state = "PREP";
        this.phaseStartTime = time;
      }
    } else if (this.state === "TRANSITION") {
      const duration = 300;
      const elapsed = time - this.phaseStartTime;
      let t = Math.min(elapsed / duration, 1.0);
      t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const prevPct = this.lastTargetPct;
      const nextPct =
        this.currentTargetIdx < this.targets.length
          ? this.targets[this.currentTargetIdx]
          : [0.5, 0.5];

      const px =
        (prevPct[0] + (nextPct[0] - prevPct[0]) * t) * this.canvas.width;
      const py =
        (prevPct[1] + (nextPct[1] - prevPct[1]) * t) * this.canvas.height;

      this.drawTarget(px, py, 30);

      if (elapsed > duration) {
        this.state =
          this.currentTargetIdx < this.targets.length ? "PREP" : "TUNE_PREP";
        this.phaseStartTime = time;
      }
    } else if (this.state === "PREP" || this.state === "RECORD") {
      const targetPct = this.targets[this.currentTargetIdx];
      const px = targetPct[0] * this.canvas.width;
      const py = targetPct[1] * this.canvas.height;
      const elapsed = time - this.phaseStartTime;

      if (this.state === "PREP") {
        this.drawTarget(px, py, 30);
        if (elapsed > 500) {
          this.state = "RECORD";
          this.phaseStartTime = time;
        }
      } else if (this.state === "RECORD") {
        const duration = 2000;
        const currentRadius = Math.max(30 * (1.0 - elapsed / duration), 2);
        this.drawTarget(px, py, currentRadius);

        if (landmarks) {
          const fusedArray = this.extractor.getEyeScalars(
            this.video,
            landmarks,
          );
          this.rawFeatures.push(fusedArray);
          this.targetLabels.push(targetPct);
        }

        if (elapsed > duration) {
          this.lastTargetPct = this.targets[this.currentTargetIdx];
          this.currentTargetIdx++;

          if (this.currentTargetIdx === this.targets.length) {
            this.state = "TRAINING";
            setTimeout(() => this.trainModel(), 100);
            return;
          } else {
            this.state = "TRANSITION";
            this.phaseStartTime = time;
          }
        }
      }
    } else if (this.state === "TRAINING") {
      this.ctx.fillStyle = "black";
      this.ctx.font = "24px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "⏳ Training ML Model (Browser may freeze momentarily)...",
        this.canvas.width / 2,
        this.canvas.height / 2,
      );
    } else if (this.state === "TUNE_PREP" || this.state === "TUNE") {
      const px = this.canvas.width * 0.5;
      const py = this.canvas.height * 0.5;
      const elapsed = time - this.phaseStartTime;

      if (this.state === "TUNE_PREP") {
        this.ctx.fillStyle = "black";
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
          "🎯 FINAL PHASE: Stare at the big center dot to tune filtering & offset",
          px,
          py - 80,
        );
        this.drawTarget(px, py, 30);

        if (elapsed > 1000) {
          this.state = "TUNE";
          this.phaseStartTime = time;
        }
      } else if (this.state === "TUNE") {
        const duration = 3000;
        const currentRadius = Math.max(30 * (1.0 - elapsed / duration), 10);
        this.drawTarget(px, py, currentRadius);

        if (landmarks) {
          const fusedArray = this.extractor.getEyeScalars(
            this.video,
            landmarks,
          );
          const scaled = this.scaler.transform([fusedArray]);
          const prediction = this.model.predict(scaled)[0];

          this.tuningSamples.push([
            prediction[0] * this.canvas.width,
            prediction[1] * this.canvas.height,
          ]);
        }

        if (elapsed > duration) {
          this.calculateTuningAndOffset();
          this.state = "DONE";
        }
      }
    } else if (this.state === "DONE") {
      if (landmarks) {
        const fusedArray = this.extractor.getEyeScalars(this.video, landmarks);
        const scaled = this.scaler.transform([fusedArray]);
        const prediction = this.model.predict(scaled)[0];

        let rawX = prediction[0] * this.canvas.width + this.offsetX;
        let rawY = prediction[1] * this.canvas.height + this.offsetY;

        let [smoothX, smoothY] = this.kalman.update(rawX, rawY);

        const clampedX = Math.max(0, Math.min(this.canvas.width, smoothX));
        const clampedY = Math.max(0, Math.min(this.canvas.height, smoothY));

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(clampedX, clampedY, 30, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = "white";
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`✅ Calibration Complete. Move your eyes.`, 30, 40);
      }
    }

    requestAnimationFrame((time) => this.loop(time));
  }

  trainModel() {
    console.log("Scaling Features...");
    this.scaler.fit(this.rawFeatures);
    let scaledFeatures = this.scaler.transform(this.rawFeatures);

    console.log(
      "Training ml-regression-ridge (This might take a few seconds)...",
    );

    // Using the explicitly reduced learning rate
    this.model = new RidgeRegression(scaledFeatures, this.targetLabels, {
      alpha: 1.0,
      learningRate: 0.00005,
    });

    console.log("✅ Model Trained!");
    this.state = "TRANSITION";
    this.phaseStartTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  calculateTuningAndOffset() {
    if (this.tuningSamples.length < 10) return;

    const xs = this.tuningSamples.map((s) => s[0]);
    const ys = this.tuningSamples.map((s) => s[1]);

    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

    const varX = Math.max(
      xs.reduce((acc, val) => acc + Math.pow(val - meanX, 2), 0) / xs.length,
      1.0,
    );
    const varY = Math.max(
      ys.reduce((acc, val) => acc + Math.pow(val - meanY, 2), 0) / ys.length,
      1.0,
    );

    this.kalman.updateNoise(varX, varY);

    this.offsetX = this.canvas.width * 0.5 - meanX;
    this.offsetY = this.canvas.height * 0.5 - meanY;

    // Safety guard so if tuning explodes, it doesn't wipe the offset
    if (isNaN(this.offsetX)) this.offsetX = 0;
    if (isNaN(this.offsetY)) this.offsetY = 0;

    console.log(
      `✅ Kalman Tuned! Var X: ${varX.toFixed(1)}, Var Y: ${varY.toFixed(1)}`,
    );
    console.log(
      `✅ Offset Applied! X: ${this.offsetX.toFixed(1)}px, Y: ${this.offsetY.toFixed(1)}px`,
    );
  }
}

// Start the app automatically once the module loads
window.onload = () => {
  console.log("🚀 Starting Eye Tracker Calibration...");
  new EyeTrackerCalibration();
};
