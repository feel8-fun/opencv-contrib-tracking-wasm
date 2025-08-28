<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { VideoCaptureSimple } from '@/utils/videocapture-simple.mjs'
import { BoundingBoxTool, BoxType } from '@/utils/boundingbox.mjs'
import PubSub from 'pubsub-js'
// Reactive state
const isVideoPlaying = ref(false)
const error = ref('')
const info = ref('')

// Configuration
const targetFPS = ref(30)

// Statistics
const processingTime = ref(0)
const avgProcessingTime = ref(0)
const videoResolution = ref('0x0')

// Refs for DOM elements
const videoElement = ref(null)
const videoCanvas = ref(null)
const outputCanvas = ref(null)
let outputCtx = null;
// Processor
let processor;
let bboxtool;

const togglePlayPause = () => {
    videoElement.value.paused ? videoElement.value.play() : videoElement.value.pause();
}
const getVideoPlacement = (videoElement) => {
    // Get the intrinsic (actual) video dimensions
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    // Get the displayed video element dimensions
    const elementWidth = videoElement.clientWidth;
    const elementHeight = videoElement.clientHeight;

    // Calculate aspect ratios
    const videoAspectRatio = videoWidth / videoHeight;
    const elementAspectRatio = elementWidth / elementHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (videoAspectRatio > elementAspectRatio) {
        // Video is wider than element (letterboxing - black bars top/bottom)
        displayWidth = elementWidth;
        displayHeight = elementWidth / videoAspectRatio;
        offsetX = 0;
        offsetY = (elementHeight - displayHeight) / 2;
    } else {
        // Video is taller than element (pillarboxing - black bars on sides)
        displayHeight = elementHeight;
        displayWidth = elementHeight * videoAspectRatio;
        offsetX = (elementWidth - displayWidth) / 2;
        offsetY = 0;
    }

    return {
        // Actual video display dimensions
        displayWidth: displayWidth,
        displayHeight: displayHeight,
        // Offsets from top-left corner of video element
        offsetX: offsetX,
        offsetY: offsetY,
        // Original video dimensions
        videoWidth: videoWidth,
        videoHeight: videoHeight,
        // Element dimensions
        elementWidth: elementWidth,
        elementHeight: elementHeight,
        // Scaling factor
        scale: displayWidth / videoWidth
    };
}

const mapToVideoCoordinates = (box) => {
    // Input validation
    if (!box || typeof box !== 'object') {
        throw new Error('Invalid box parameter provided');
    }
    if (!videoElement.value) {
        throw new Error('Video element is not available');
    }
    const { scale, offsetX, offsetY } = getVideoPlacement(videoElement.value);
    if (box.type === BoxType.ABBOX) {
        return {
            ...box,
            startX: box.startX / scale + offsetX,
            startY: box.startY / scale + offsetY,
            endX: box.endX / scale + offsetX,
            endY: box.endY / scale + offsetY,
        };
    } else {
        return {
            ...box,
            centerX: box.centerX / scale + offsetX,
            centerY: box.centerY / scale + offsetY,
            width: box.width / scale,
            height: box.height / scale
        };
    }
}

const isSettingRectROI = ref(false);
const isSettingRotatedROI = ref(false);
const toggleSetRectROI = () => {
    if (isSettingRotatedROI.value) return
    if (isSettingRectROI.value) {
        isSettingRectROI.value = false;
        videoCanvas.value.style.pointerEvents = 'none';
        bboxtool.stop();
        return
    }

    isSettingRectROI.value = true;
    videoCanvas.value.style.pointerEvents = 'auto';
    bboxtool.setMode(BoxType.ABBOX);
    bboxtool.clear();
    bboxtool.start();


    // Update canvas dimensions   

    PubSub.subscribeOnce(bboxtool.TOPICS.DRAW_END, (msg, data) => {
        bboxtool.stop();
        const roi = mapToVideoCoordinates(bboxtool.boxes[0]);
        processor.setROI(roi);
        videoCanvas.value.style.pointerEvents = 'none';
        isSettingRectROI.value = false;
    });

    PubSub.subscribeOnce(bboxtool.TOPICS.DRAW_CANCELLED, (msg, reason) => {
        console.info("Drawing cancelled:", reason);
        videoCanvas.value.style.pointerEvents = 'none';
        isSettingRectROI.value = false;
    });
}

const toggleSetRotatedROI = () => {
    if (isSettingRectROI.value) return
    if (isSettingRotatedROI.value) {
        isSettingRotatedROI.value = false;
        videoCanvas.value.style.pointerEvents = 'none';
        bboxtool.stop();
        return
    }
    isSettingRotatedROI.value = true;
    videoCanvas.value.style.pointerEvents = 'auto';

    bboxtool.setMode(BoxType.OBBOX);
    bboxtool.clear();
    bboxtool.start();

    PubSub.subscribeOnce(bboxtool.TOPICS.DRAW_END, (msg, data) => {

        bboxtool.stop();
        const roi = mapToVideoCoordinates(bboxtool.boxes[0]);
        processor.setROI(roi);
        videoCanvas.value.style.pointerEvents = 'none';
        isSettingRotatedROI.value = false;
    });

    PubSub.subscribeOnce(bboxtool.TOPICS.DRAW_CANCELLED, (msg, reason) => {
        console.info("Drawing cancelled:", reason);
        bboxtool.stop();
        videoCanvas.value.style.pointerEvents = 'none';
        isSettingRotatedROI.value = false;
    });
}

const onClearROI = () => {
    isSettingRotatedROI.value = false;
    isSettingRectROI.value = false;

    bboxtool.clear();
    bboxtool.stop();
    videoCanvas.value.style.pointerEvents = 'none';
    PubSub.unsubscribe(bboxtool.TOPICS.BOX_CREATED);
    PubSub.unsubscribe(bboxtool.TOPICS.DRAW_CANCELLED);
    processor.setROI(null);
}

// Event handlers for video
const handlePlay = () => {
    isVideoPlaying.value = true
    processor.start()
}
const handlePause = () => {
    isVideoPlaying.value = false;
    processor.stop()

}
const handleEnded = () => {
    isVideoPlaying.value = false
    processor.stopProcessing()
}

const handleLoadedData = () => {
    console.info(videoElement.value)
    videoResolution.value = `${videoElement.value.videoWidth}x${videoElement.value.videoHeight}`

    const videoBox = videoElement.value.getBoundingClientRect();
    // Update canvas dimensions
    videoCanvas.value.width = videoBox.width;
    videoCanvas.value.height = videoBox.height;
}

const costHistory = [];
const costHistoryMaxLength = 30;

// Lifecycle hooks
onMounted(async () => {
    await nextTick();
    // Add video event listeners
    if (videoElement.value) {
        videoElement.value.addEventListener('play', handlePlay)
        videoElement.value.addEventListener('pause', handlePause)
        videoElement.value.addEventListener('ended', handleEnded)
        videoElement.value.addEventListener('loadeddata', handleLoadedData)
    }
    processor = new VideoCaptureSimple(videoElement.value, {
        fps: targetFPS.value,
        // roi: new ABBox(0.4, 0.2, 0.2, 0.8) // Default to full video
    });
    outputCtx = outputCanvas.value.getContext('2d');

    // Subscribe to captured frames
    const frameSub = PubSub.subscribe(processor.TOPICS.FRAME_CAPTURED, (topic, data) => {
        // console.info(outputCanvas.value, data)
        // if (outputCanvas.value.width != data.width || outputCanvas.value.height != data.height) {
        //     videoResolution.value = `${data.width}x${data.height}`;
        //     console.info("Video resolution changed:", outputCanvas.value, data.width, data.height);
        //     outputCanvas.value.width = data.width;
        //     outputCanvas.value.height = data.height;
        // }

        // Process the frame data
        const { imageData } = data;

        // Draw it on canvas
        outputCtx.putImageData(imageData, 0, 0);
    });

    const costSub = PubSub.subscribe('videocapture.cost', (topic, data) => {

        processingTime.value = data.cost;
        costHistory.push(data.cost);
        if (costHistory.length > costHistoryMaxLength) {
            costHistory.shift();
        }
        avgProcessingTime.value = costHistory.reduce((a, b) => a + b, 0) / costHistory.length;
    });

    bboxtool = new BoundingBoxTool(videoCanvas.value, {
        features: {
            showGrid: false,
        }
    });
    bboxtool.setMode(BoxType.OBBOX)
    // boundingBoxDemo= new BoundingBoxDemo(videoElement.value);
})

onUnmounted(() => {
    // Remove video event listeners
    if (videoElement.value) {
        videoElement.value.removeEventListener('play', handlePlay)
        videoElement.value.removeEventListener('pause', handlePause)
        videoElement.value.removeEventListener('ended', handleEnded)
        videoElement.value.removeEventListener('loadeddata', handleLoadedData)
    }
    processor.stop();
    processor.destroy();
})

</script>

<template>
    <div class="app-container">
        <header class="header">
            <h1>Video Capture</h1>
        </header>

        <main class="main-content">
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

                <div class="slider-group">
                    <button @click="togglePlayPause"> {{ isVideoPlaying ? 'Pause' : 'Play' }}</button>
                    <button @click="toggleSetRectROI" :disabled="isSettingRotatedROI">
                        {{ isSettingRectROI ? "Cancel" : "Set Rect ROI" }}</button>
                    <button @click="toggleSetRotatedROI" :disabled="isSettingRectROI">
                        {{ isSettingRotatedROI ? "Cancel" : "Set Rotated ROI" }}</button>
                    <button @click="onClearROI">Clear ROI</button>
                    <label>Target FPS:</label>
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
                    <canvas ref="videoCanvas" class="video-overlay-canvas"></canvas>
                    <div class="video-overlay">Original Video</div>
                </div>
                <div class="video-container">
                    <canvas ref="outputCanvas" class="canvas-element"></canvas>
                    <div class="video-overlay">Output Video</div>
                </div>
            </section>

            <!-- Statistics Section -->
            <section class="stats-section">
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
    /* aspect-ratio: 16/9; */
}

.video-element,
.canvas-element {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* display: block; */
}

.video-overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    background: transparent;
    pointer-events: none;
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
