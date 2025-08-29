<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { cvLoadAuto, cvLoadSIMD, cvLoadWASM } from '@feel8.fun/opencv-contrib-tracking-wasm'

// Reactive state
const isOpenCVReady = ref(false)
const isVideoActive = ref(false)
const showOpticalFlow = ref(true)
const error = ref('')
const info = ref('')

// Configuration
const targetFPS = ref(30)

// Statistics
const processingFps = ref(0)
const processingTime = ref(0)
const avgProcessingTime = ref(0)
const videoResolution = ref('0x0')

// Refs for DOM elements
const videoElement = ref(null)
const outputCanvas = ref(null)

// Processor
let processor;

const useTracker = async () => {
    const cv = await cvLoadSIMD();

    const algoParam = new cv.TrackerCSRT_Params();
    // algoParam.use_segmentation=false;
    console.info(algoParam);
    const algo = new cv.TrackerCSRT(algoParam);
    let isInitialized = false


    // // Processing variables
    // const dualGray = [new cv.Mat(), new cv.Mat()];
    // let frame = new cv.Mat();

    let frameCount = 0
    let lastTime = 0
    let procDurations = [] // Store recent processing times for average calculation
    const maxProcessingTimes = 300 // Keep last 30 measurements
    let perf_callback = null

    // Data source
    let inputElement = null
    let outputElement = null
    let ctx = null
    let animationId = null

    const setupCanvas = () => {
        // setup a canvas for optical flow visualization
        const { videoWidth, videoHeight } = videoElement.value
        const canvas = outputCanvas.value

        canvas.width = videoWidth / 4;
        canvas.height = videoHeight / 4;

        // Create or reuse canvas context with willReadFrequently for performance
        if (!ctx) {
            ctx = canvas.getContext('2d', { willReadFrequently: true })
        }
    }

    // const frameRGB = cv.Mat();
    const trackingFrame = () => {
        if (!inputElement || !outputElement || !cv || !ctx) return

        const canvas = outputElement

        // Draw current frame to canvas first
        ctx.drawImage(inputElement, 0, 0, canvas.width, canvas.height)

        // Get image data from video
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const frame = cv.matFromImageData(imageData)

        cv.cvtColor(frame, frame, cv.COLOR_RGBA2RGB);
        console.info(frame.channels())

        if (isInitialized) {
            const _a = performance.now()
            const [isOk, newBox] = algo.update(frame);
            console.log(isOk, newBox, performance.now() - _a);
            isInitialized = isOk;

            // Draw tracking polygon result
            if (isOk && newBox) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(newBox.x, newBox.y, newBox.width, newBox.height);
            }
        } else {
            console.info(frame.cols, frame.rows);
            const x = frame.cols / 2 - 10;
            const width = 20;
            const y = frame.rows / 2 - 10;
            const height = 20;
            const rect = new cv.Rect(x, y, width, height);
            algo.init(frame, rect);
            isInitialized = true;
        }
    }
    const start = (input, output, fps) => {
        inputElement = input
        outputElement = output
        frameCount = 0
        lastTime = performance.now()
        procDurations = []

        setupCanvas()

        if (animationId) return // already processing
        const targetInterval = 1000 / fps

        const processFrame = () => {
            const startTime = performance.now()

            trackingFrame();

            // Calculate FPS
            frameCount++
            const currentTime = performance.now()
            if (currentTime - lastTime >= 1000) {
                frameCount = 0
                lastTime = currentTime
            }

            const procDuration = performance.now() - startTime
            // Update average processing time
            procDurations.push(procDuration)
            if (procDurations.length > maxProcessingTimes) {
                procDurations.shift()
            }
            const avgDuration = procDurations.reduce((a, b) => a + b, 0) / procDurations.length

            // Schedule next frame at target FPS
            const remainDuration = Math.max(0, targetInterval - procDuration)
            if (perf_callback) {
                perf_callback({ avgDuration, procDuration, procFPS: 1000 / (currentTime - lastTime) })
            }

            lastTime = currentTime
            animationId = setTimeout(processFrame, remainDuration)
        }
        processFrame()
    }

    /**
     * Stop optical flow processing
     */
    const stop = () => {
        if (animationId) {
            clearTimeout(animationId)
            animationId = null
        }
    }

    const cleanup = () => {
        // if (hist) hist.delete();
        // if (mask) mask.delete();
        // dualGray.forEach(mat => mat.delete());
        // flow.delete();
        // flowXY.delete();
        // algo.delete();
    }

    const setPerformanceCallback = (callback) => {
        perf_callback = callback
    }

    return { inputElement, outputElement, ctx, start, stop, cleanup, setPerformanceCallback }
}



// Event handlers for video
const handlePlay = () => {
    isVideoActive.value = true
    processor.start(videoElement.value, outputCanvas.value, targetFPS.value)

}
const handlePause = () => {
    isVideoActive.value = false;
    processor.stop()
}
const handleEnded = () => {
    isVideoActive.value = false
    processor.stop()
}
const handleLoadedData = () => {
    videoResolution.value = `${videoElement.value.videoWidth}x${videoElement.value.videoHeight}`
}

/**
 * Toggle optical flow processing
 */
const toggleOpticalFlow = () => {
    if (showOpticalFlow.value && isVideoActive.value) {
        startOpticalFlowProcessing()
    } else {
        stopOpticalFlowProcessing()
    }
}


/**
 * Cleanup resources
 */
const cleanup = () => {
    if (prevGray) prevGray.delete()
    if (currGray) currGray.delete()
    ctx = null
}

// Lifecycle hooks
onMounted(async () => {

    try {
        await cvLoadAuto();
        isOpenCVReady.value = true
        info.value = 'OpenCV.js loaded successfully! Ready to process video.'

    } catch (err) {
        error.value = `Failed to initialize OpenCV.js: ${err.message}`
        console.error('OpenCV initialization error:', err)
    }
    await nextTick();
    // Add video event listeners
    if (videoElement.value) {
        videoElement.value.addEventListener('play', handlePlay)
        videoElement.value.addEventListener('pause', handlePause)
        videoElement.value.addEventListener('ended', handleEnded)
        videoElement.value.addEventListener('loadeddata', handleLoadedData)
    }
    processor = await useTracker();

    videoElement.value.currentTime = 3.0;
    processor.setPerformanceCallback(({ avgDuration, procDuration, procFPS }) => {
        avgProcessingTime.value = avgDuration
        processingTime.value = procDuration
        processingFps.value = procFPS
    })

})

onUnmounted(() => {
    // Remove video event listeners
    if (videoElement.value) {
        videoElement.value.removeEventListener('play', handlePlay)
        videoElement.value.removeEventListener('pause', handlePause)
        videoElement.value.removeEventListener('ended', handleEnded)
        videoElement.value.removeEventListener('loadeddata', handleLoadedData)
    }
    processor.cleanup()
})

// Watchers
// watch(showOpticalFlow, (newValue) => {
//     if (newValue && isVideoActive.value) {
//         startOpticalFlowProcessing()
//     } else {
//         stopOpticalFlowProcessing()
//     }
// })
</script>

<template>
    <div class="app-container">
        <header class="header">
            <h1>Tracker Analyzer</h1>
        </header>

        <main class="main-content">
            <!-- Loading Screen -->
            <div v-if="!isOpenCVReady" class="loading-screen">
                <div class="loading-spinner"></div>
                <h3>Loading OpenCV.js...</h3>
                <p>Please wait while we initialize the computer vision library</p>
            </div>

            <!-- Main Application -->
            <div v-else>
                <!-- Error Messages -->
                <div v-if="error" class="error-message">
                    <strong>Error:</strong> {{ error }}
                </div>

                <!-- Info Messages -->
                <div v-if="info" class="info-message">
                    <strong>Info:</strong> {{ info }}
                </div>

                <!-- Controls Section -->
                <div class="control-group">
                    <label>
                        <input type="checkbox" v-model="showOpticalFlow" @change="toggleOpticalFlow">
                        Enable Optical Flow
                    </label>

                    <div class="slider-group">
                        <label>Processing FPS:</label>
                        <input type="range" v-model="targetFPS" min="5" max="60" step="5" class="slider">
                        <span>{{ targetFPS }}</span>
                    </div>
                </div>


                <!-- Video Section -->
                <section class="video-section">
                    <div class="video-container">
                        <video ref="videoElement" class="video-element" controls crossorigin="anonymous">
                            <source src="/1.mp4" type="video/mp4">
                        </video>
                        <div class="video-overlay">Original Video</div>
                    </div>
                    <div class="video-container">
                        <canvas ref="outputCanvas" class="canvas-element"></canvas>
                        <div class="video-overlay">Optical Flow</div>
                    </div>
                </section>

                <!-- Statistics Section -->
                <section class="stats-section">
                    <div class="stat-card">
                        <div class="stat-value">{{ processingFps.toFixed(1) }}</div>
                        <div class="stat-label">FPS</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ avgProcessingTime.toFixed(1) }}ms</div>
                        <div class="stat-label">Avg Processing Time</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ processingTime.toFixed(1) }}ms</div>
                        <div class="stat-label">Current Processing Time</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ videoResolution }}</div>
                        <div class="stat-label">Resolution</div>
                    </div>
                </section>
            </div>
        </main>
    </div>
</template>

<style scoped>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

.app-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    min-height: 100vh;
    color: #333;
}

.header {
    text-align: center;
    margin-bottom: 30px;
    color: white;
}

.header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.header p {
    font-size: 1.1rem;
    opacity: 0.9;
}

.main-content {
    background: white;
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.loading-screen {
    text-align: center;
    padding: 60px 20px;
}

.loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #2a5298;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.controls-section {
    background: #f8f9fa;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 20px;
}

.control-group {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    margin-bottom: 15px;
}

.control-group:last-child {
    margin-bottom: 0;
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-primary {
    background: #2a5298;
    color: white;
}

.btn-primary:hover {
    background: #1e3c72;
    transform: translateY(-2px);
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background: #545b62;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    background: #c82333;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.file-input-wrapper {
    position: relative;
    display: inline-block;
}

.file-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
}

.slider-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.slider {
    width: 150px;
}

.video-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
}

.video-container {
    background: #000;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    aspect-ratio: 16/9;
}

.video-element,
.canvas-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.video-overlay {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
}

.stats-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
}

.stat-card {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
}

.stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #2a5298;
    margin-bottom: 5px;
}

.stat-label {
    font-size: 0.9rem;
    color: #6c757d;
}

.error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid #f5c6cb;
}

.info-message {
    background: #d1ecf1;
    color: #0c5460;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid #bee5eb;
}

@media (max-width: 768px) {
    .app-container {
        padding: 10px;
    }

    .main-content {
        padding: 20px;
    }

    .header h1 {
        font-size: 2rem;
    }

    .video-section {
        grid-template-columns: 1fr;
    }

    .control-group {
        flex-direction: column;
        align-items: stretch;
    }

    .btn {
        justify-content: center;
    }
}
</style>
