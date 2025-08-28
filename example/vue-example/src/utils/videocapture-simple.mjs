import PubSub from 'pubsub-js';
import { ABBox, OBBox } from './boundingbox.mjs';

const defaultConfig = {
    topic_prefix: 'videocapture',
    fps: 30,
    maxWidth: 8192,
    maxHeight: 8192,
    roi: null
};

class VideoCaptureSimple {
    constructor(videoElement, config = {}) {
        this.video = videoElement;

        // Configuration
        this.fps = config.fps || defaultConfig.fps;
        this.maxWidth = config.maxWidth || defaultConfig.maxWidth;
        this.maxHeight = config.maxHeight || defaultConfig.maxHeight;
        this.roi = config.roi || defaultConfig.roi; // ABBox or OBBox in normalized coordinates

        // Internal state
        this.isCapturing = false;
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        this.frameCount = 0;

        // Single canvas for image processing
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: true
        });

        const topic_prefix = config.topic_prefix || defaultConfig.topic_prefix;
        // PubSub topics
        this.TOPICS = {
            FRAME_CAPTURED: topic_prefix + '.captured',
            FRAME_COST: topic_prefix + '.cost',
            STARTED: topic_prefix + '.started',
            STOPPED: topic_prefix + '.stopped',
            ERROR: topic_prefix + '.error'
        };

        this.animationId = null;
    }

    /**
     * Set the Region of Interest (normalized coordinates 0-1)
     * @param {ABBox|OBBox} roi - Region of interest
     */
    setROI(roi) {
        this.roi = roi;
    }

    /**
     * Set capture frame rate
     * @param {number} fps - Frames per second
     */
    setFPS(fps) {
        this.fps = fps;
        this.frameInterval = 1000 / fps;
    }

    /**
     * Set maximum output dimensions
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     */
    setMaxDimensions(maxWidth, maxHeight) {
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
    }

    /**
     * Start capturing frames
     */
    start() {
        if (this.isCapturing) return;

        this.isCapturing = true;
        this.lastFrameTime = 0;

        PubSub.publish(this.TOPICS.STARTED, {
            timestamp: Date.now(),
            fps: this.fps,
            roi: this.roi
        });

        this.captureLoop();
    }

    /**
     * Stop capturing frames
     */
    stop() {
        this.isCapturing = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        PubSub.publish(this.TOPICS.STOPPED, {
            timestamp: Date.now(),
            framesCaptures: this.frameCount
        });
    }

    /**
     * Main capture loop
     */
    captureLoop() {
        if (!this.isCapturing) return;

        const now = performance.now();

        // Check if enough time has passed based on FPS
        if (now - this.lastFrameTime >= this.frameInterval) {
            this.lastFrameTime = now;

            try {
                this.captureFrame();
                const cost = performance.now() - now;
                PubSub.publish(this.TOPICS.FRAME_COST, {
                    cost: cost,
                    timestamp: now
                });
            } catch (error) {
                PubSub.publish(this.TOPICS.ERROR, {
                    error: error.message,
                    timestamp: now
                });
            }
        }

        this.animationId = requestAnimationFrame(() => this.captureLoop());
    }

    /**
     * Calculate output dimensions and scaling
     */
    calculateOutputDimensions() {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;

        // Determine source dimensions
        let sourceWidth, sourceHeight;

        if (this.roi) {
            sourceWidth = this.roi.width * videoWidth;
            sourceHeight = this.roi.height * videoHeight;
        } else {
            sourceWidth = videoWidth;
            sourceHeight = videoHeight;
        }

        // Calculate scale to fit within max dimensions
        const scaleX = this.maxWidth / sourceWidth;
        const scaleY = this.maxHeight / sourceHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

        return {
            width: Math.floor(sourceWidth * scale),
            height: Math.floor(sourceHeight * scale),
            scale: scale
        };
    }

    /**
     * Capture and process a single frame
     */
    captureFrame() {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;

        if (!videoWidth || !videoHeight) {
            throw new Error('Video dimensions not available');
        }

        // Calculate output dimensions
        const output = this.calculateOutputDimensions();

        // Update canvas size if needed
        if (this.canvas.width !== output.width || this.canvas.height !== output.height) {
            this.canvas.width = output.width;
            this.canvas.height = output.height;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, output.width, output.height);

        // Enable high-quality image smoothing
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        if (this.roi) {
            if (this.roi instanceof OBBox && this.roi.angle) {
                this.captureRotatedROI(output);
            } else {
                this.captureRectangularROI(output);
            }
        } else {
            // Capture full frame with scaling
            this.ctx.drawImage(
                this.video,
                0, 0, videoWidth, videoHeight,      // Source (full video)
                0, 0, output.width, output.height   // Destination (scaled)
            );
        }

        // Get image data
        const imageData = this.ctx.getImageData(0, 0, output.width, output.height);

        // Publish frame via PubSub
        PubSub.publish(this.TOPICS.FRAME_CAPTURED, {
            frameId: this.frameCount++,
            timestamp: Date.now(),
            videoTime: this.video.currentTime,
            imageData: imageData,
            width: output.width,
            height: output.height,
            roi: this.roi ? {
                x: this.roi.x,
                y: this.roi.y,
                width: this.roi.width,
                height: this.roi.height,
                angle: this.roi.angle || 0
            } : null
        });
    }

    /**
     * Capture rectangular ROI with scaling in one pass
     */
    captureRectangularROI(output) {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;

        // Convert normalized coordinates to pixel coordinates
        const sourceX = this.roi.x * videoWidth;
        const sourceY = this.roi.y * videoHeight;
        const sourceWidth = this.roi.width * videoWidth;
        const sourceHeight = this.roi.height * videoHeight;

        // Draw and scale in one operation
        this.ctx.drawImage(
            this.video,
            sourceX, sourceY, sourceWidth, sourceHeight,    // Source ROI
            0, 0, output.width, output.height              // Destination (scaled)
        );
    }

    /**
     * Capture rotated ROI with scaling in one pass
     */
    captureRotatedROI(output) {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;

        // Convert normalized coordinates to pixel coordinates
        const sourceX = this.roi.x * videoWidth;
        const sourceY = this.roi.y * videoHeight;
        const sourceWidth = this.roi.width * videoWidth;
        const sourceHeight = this.roi.height * videoHeight;
        const angleRad = (this.roi.angle || 0) * Math.PI / 180;

        // Save context state
        this.ctx.save();

        // Apply transformations for rotation
        // Move origin to center of output canvas
        this.ctx.translate(output.width / 2, output.height / 2);

        // Apply rotation
        this.ctx.rotate(angleRad);

        // Scale factor from source to output
        const scale = output.scale;

        // Draw the rotated and scaled ROI
        // We need to account for the center-based rotation
        this.ctx.drawImage(
            this.video,
            sourceX - sourceWidth / 2,      // Adjusted source X (centered)
            sourceY - sourceHeight / 2,      // Adjusted source Y (centered)
            sourceWidth,                     // Source width
            sourceHeight,                    // Source height
            -output.width / 2,               // Destination X (centered)
            -output.height / 2,              // Destination Y (centered)
            output.width,                    // Destination width (scaled)
            output.height                    // Destination height (scaled)
        );

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();

        // Clear canvas
        this.canvas = null;
        this.ctx = null;
    }
}

// Export classes
export { VideoCaptureSimple, ABBox, OBBox };