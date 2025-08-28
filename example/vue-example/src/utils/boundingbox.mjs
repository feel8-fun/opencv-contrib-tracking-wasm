import PubSub from "pubsub-js";

/**
 * Bounding box types enumeration
 * @enum {string}
 */
const BoxType = {
    ABBOX: 'ABBox',
    OBBOX: 'OBBox'
};

/**
 * Drawing phases for OBBox
 * @enum {string}
 */
const DrawPhase = {
    ARROW: 'arrow',
    BOX: 'box'
};


/**
 * Default configuration for the bounding box tool
 * @typedef {Object} BoundingBoxConfig
 * @property {Object} colors - Color configuration
 * @property {string} colors.primary - Primary color for active elements
 * @property {string} colors.secondary - Secondary color for inactive elements
 * @property {string} colors.arrow - Arrow color
 * @property {string} colors.fill - Fill color with transparency
 * @property {string} colors.grid - Grid line color
 * @property {Object} styles - Style configuration
 * @property {number} styles.lineWidth - Default line width
 * @property {number} styles.activeLineWidth - Line width for active elements
 * @property {number} styles.arrowHeadLength - Arrow head length in pixels
 * @property {number} styles.arrowHeadWidth - Arrow head width in pixels
 * @property {number} styles.gridSpacing - Grid spacing in pixels
 * @property {Object} constraints - Drawing constraints
 * @property {number} constraints.minBoxSize - Minimum box size in pixels
 * @property {number} constraints.minArrowLength - Minimum arrow length in pixels
 * @property {boolean} features.showGrid - Show background grid
 * @property {boolean} features.showAngle - Show angle annotations
 */
const defaultConfig = {
    topic_prefix: 'bboxtool',
    colors: {
        primary: '#667eea',
        secondary: '#9ca3af',
        arrow: '#764ba2',
        arrowActive: '#ff6b6b',
        fillActive: 'rgba(102, 126, 234, 0.1)',
        fillInactive: 'rgba(102, 126, 234, 0.05)',
        fillActiveOBB: 'rgba(118, 75, 162, 0.1)',
        fillInactiveOBB: 'rgba(118, 75, 162, 0.05)',
        grid: '#e0e0e0',
        text: '#333333'
    },
    styles: {
        lineWidth: 1,
        activeLineWidth: 2,
        arrowHeadLength: 15,
        arrowHeadWidth: 10,
        gridSpacing: 50,
        gridLineWidth: 0.5,
        fontSize: 12,
        fontFamily: 'sans-serif'
    },
    constraints: {
        minBoxSize: 5,
        minArrowLength: 10
    },
    features: {
        showGrid: true,
        showAngle: true
    }
};

class BoundingBoxTool {
    constructor(canvas, config = {}) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('BoundingBoxTool requires an HTMLCanvasElement');
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = this._mergeConfig(defaultConfig, config);

        // State management
        this.mode = BoxType.ABBOX;
        this.boxes = [];
        this.isInteractive = false;
        this.currentBox = null;
        this.isDrawing = false;
        this.drawPhase = null;

        // For OBBox
        this.arrowStart = null;
        this.arrowEnd = null;
        this.fixedAngle = null;

        this.mousePosition = { x: 0, y: 0 };

        // Binding context for event handlers
        this._boundHandlers = {
            mouseDown: this._handleMouseDown.bind(this),
            mouseMove: this._handleMouseMove.bind(this),
            mouseUp: this._handleMouseUp.bind(this),
            touchStart: this._handleTouchStart.bind(this),
            touchMove: this._handleTouchMove.bind(this),
            touchEnd: this._handleTouchEnd.bind(this),
            contextMenu: (e) => e.preventDefault()
        };

        // Initialize pub topics
        const topic_prefix = this.config.topic_prefix;
        this.TOPICS = {
            INITIALIZED: topic_prefix + '.initialized',
            STARTED: topic_prefix + '.started',
            STOPPED: topic_prefix + '.stopped',
            DRAW_START: topic_prefix + '.draw.start',
            DRAW_UPDATE: topic_prefix + '.draw.update',
            DRAW_END: topic_prefix + '.draw.end',
            DRAW_CANCELLED: topic_prefix + '.draw.cancelled',
            MOUSE_MOVE: topic_prefix + '.mouse.move',
            PHASE_CHANGE: topic_prefix + '.phase.change',
            MODE_CHANGED: topic_prefix + '.mode.changed',
            BOX_CREATED: topic_prefix + '.box.created',
            BOX_REMOVED: topic_prefix + '.box.removed',
            BOX_ADDED: topic_prefix + '.box.added',
            CLEARED: topic_prefix + '.cleared',
            DESTROYED: topic_prefix + '.destroyed'
        };

        this._initialize();
    }

    start() {
        if (this.isInteractive) return;
        this.isInteractive = true;
        this._attachEventListeners();
        PubSub.publish(this.TOPICS.STARTED);
    }

    stop() {
        if (!this.isInteractive) return;
        this.isInteractive = false;
        this._removeEventListeners();
        PubSub.publish(this.TOPICS.STOPPED);
    }
    /**
     * Deep merge configuration objects
     * @private
     * @param {Object} target - Target configuration
     * @param {Object} source - Source configuration
     * @returns {Object} Merged configuration
     */
    _mergeConfig(target, source) {
        const result = JSON.parse(JSON.stringify(target));

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this._mergeConfig(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Initialize the tool
     * @private
     */
    _initialize() {
        this._setupCanvas();
        this.render();
        PubSub.publish(this.TOPICS.INITIALIZED, { canvas: this.canvas });
    }

    /**
       * Setup canvas dimensions
       * @private
       */
    _setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    _attachEventListeners() {
        this.canvas.addEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.addEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.addEventListener('touchstart', this._boundHandlers.touchStart);
        this.canvas.addEventListener('touchmove', this._boundHandlers.touchMove);
        this.canvas.addEventListener('touchend', this._boundHandlers.touchEnd);
        this.canvas.addEventListener('contextmenu', this._boundHandlers.contextMenu);
    }

    /**
     * Remove event listeners from canvas
     * @private
     */
    _removeEventListeners() {
        this.canvas.removeEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.removeEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.removeEventListener('touchstart', this._boundHandlers.touchStart);
        this.canvas.removeEventListener('touchmove', this._boundHandlers.touchMove);
        this.canvas.removeEventListener('touchend', this._boundHandlers.touchEnd);
        this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextMenu);
    }
    /**
         * Handle mouse down event
         * @private
         * @param {MouseEvent} event - Mouse event
         */
    _handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this._startDrawing(x, y);
    }

    /**
     * Handle mouse move event
     * @private
     * @param {MouseEvent} event - Mouse event
     */
    _handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.mousePosition = { x, y };
        this._updateDrawing(x, y);
    }

    /**
     * Handle mouse up event
     * @private
     * @param {MouseEvent} event - Mouse event
     */
    _handleMouseUp(event) {
        this._endDrawing();
    }

    /**
     * Handle touch start event
     * @private
     * @param {TouchEvent} event - Touch event
     */
    _handleTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this._startDrawing(x, y);
    }

    /**
     * Handle touch move event
     * @private
     * @param {TouchEvent} event - Touch event
     */
    _handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.mousePosition = { x, y };
        this._updateDrawing(x, y);
    }

    /**
     * Handle touch end event
     * @private
     * @param {TouchEvent} event - Touch event
     */
    _handleTouchEnd(event) {
        event.preventDefault();
        this._endDrawing();
    }
    /**
         * Start drawing a bounding box
         * @private
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         */
    _startDrawing(x, y) {
        this.isDrawing = true;

        if (this.mode === BoxType.ABBOX) {
            this.currentBox = {
                type: BoxType.ABBOX,
                startX: x,
                startY: y,
                endX: x,
                endY: y,
                id: this._generateId()
            };
            PubSub.publish(this.TOPICS.DRAW_START, { box: this.currentBox, mode: this.mode });
        } else {
            // OBBox mode
            if (!this.drawPhase) {
                // Phase 1: Start drawing arrow
                this.drawPhase = DrawPhase.ARROW;
                this.arrowStart = { x, y };
                this.arrowEnd = { x, y };
                PubSub.publish(this.TOPICS.DRAW_START, { phase: DrawPhase.ARROW, mode: this.mode });
            } else if (this.drawPhase === DrawPhase.BOX) {
                // Phase 2: Start expanding box
                PubSub.publish(this.TOPICS.DRAW_START, { phase: DrawPhase.BOX, mode: this.mode });
            }
        }
    }

    /**
     * Update drawing based on mouse movement
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    _updateDrawing(x, y) {
        if (!this.isDrawing) {
            PubSub.publish(this.TOPICS.MOUSE_MOVE, { x, y });
            return;
        }

        if (this.mode === BoxType.ABBOX) {
            this.currentBox.endX = x;
            this.currentBox.endY = y;

            PubSub.publish(this.TOPICS.DRAW_UPDATE, { box: this.currentBox, mode: this.mode });
        } else {
            // OBBox mode
            if (this.drawPhase === DrawPhase.ARROW) {
                this.arrowEnd = { x, y };
                PubSub.publish(this.TOPICS.DRAW_UPDATE, {
                    phase: DrawPhase.ARROW,
                    arrow: { start: this.arrowStart, end: this.arrowEnd },
                    mode: this.mode
                });
            } else if (this.drawPhase === DrawPhase.BOX && this.arrowStart && this.arrowEnd) {
                // Calculate perpendicular distance from mouse to arrow line
                const arrowVector = {
                    x: this.arrowEnd.x - this.arrowStart.x,
                    y: this.arrowEnd.y - this.arrowStart.y
                };

                const arrowLength = Math.sqrt(arrowVector.x ** 2 + arrowVector.y ** 2);
                if (arrowLength > 0) {
                    // Normalized arrow direction
                    const arrowDir = {
                        x: arrowVector.x / arrowLength,
                        y: arrowVector.y / arrowLength
                    };

                    // Perpendicular direction (rotate 90 degrees)
                    const perpDir = {
                        x: -arrowDir.y,
                        y: arrowDir.x
                    };

                    // Vector from arrow start to mouse
                    const toMouse = {
                        x: x - this.arrowStart.x,
                        y: y - this.arrowStart.y
                    };

                    // Project onto perpendicular direction
                    const perpDistance = toMouse.x * perpDir.x + toMouse.y * perpDir.y;

                    // Create box
                    this.currentBox = {
                        type: BoxType.OBBOX,
                        centerX: (this.arrowStart.x + this.arrowEnd.x) / 2,
                        centerY: (this.arrowStart.y + this.arrowEnd.y) / 2,
                        width: arrowLength,
                        height: Math.abs(perpDistance) * 2,
                        angle: this.fixedAngle,
                        arrowStart: { ...this.arrowStart },
                        arrowEnd: { ...this.arrowEnd },
                        id: this._generateId()
                    };

                    PubSub.publish(this.TOPICS.DRAW_UPDATE, {
                        phase: DrawPhase.BOX,
                        box: this.currentBox,
                        mode: this.mode
                    });
                }
            }
        }

        this.render();
    }

    /**
     * End drawing
     * @private
     */
    _endDrawing() {
        if (!this.isDrawing) return;

        if (this.mode === BoxType.ABBOX) {
            if (this.currentBox) {
                const width = Math.abs(this.currentBox.endX - this.currentBox.startX);
                const height = Math.abs(this.currentBox.endY - this.currentBox.startY);

                if (width > this.config.constraints.minBoxSize &&
                    height > this.config.constraints.minBoxSize) {
                    this.boxes.push({ ...this.currentBox });
                    PubSub.publish(this.TOPICS.BOX_CREATED, { box: this.currentBox, mode: this.mode });
                }
                this.currentBox = null;
            }
            this.isDrawing = false;
            PubSub.publish(this.TOPICS.DRAW_END, { mode: this.mode });
        } else {
            // OBBox mode
            if (this.drawPhase === DrawPhase.ARROW) {
                const dx = this.arrowEnd.x - this.arrowStart.x;
                const dy = this.arrowEnd.y - this.arrowStart.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length > this.config.constraints.minArrowLength) {
                    // Valid arrow, move to box phase
                    this.fixedAngle = Math.atan2(dy, dx);
                    this.drawPhase = DrawPhase.BOX;
                    this.isDrawing = false;
                    PubSub.publish(this.TOPICS.PHASE_CHANGE, {
                        from: DrawPhase.ARROW,
                        to: DrawPhase.BOX,
                        angle: this.fixedAngle
                    });
                } else {
                    // Invalid arrow, reset
                    this._resetOBBoxDrawing();
                    PubSub.publish(this.TOPICS.DRAW_CANCELLED, { reason: 'Arrow too short' });
                }
            } else if (this.drawPhase === DrawPhase.BOX) {
                if (this.currentBox && this.currentBox.height > this.config.constraints.minBoxSize) {
                    this.boxes.push({ ...this.currentBox });

                    PubSub.publish(this.TOPICS.BOX_CREATED, { box: this.currentBox, mode: this.mode });
                }
                this._resetOBBoxDrawing();
                PubSub.publish(this.TOPICS.DRAW_END, { mode: this.mode });
            }
        }

        this.render();
    }

    /**
     * Reset OBBox drawing state
     * @private
     */
    _resetOBBoxDrawing() {
        this.isDrawing = false;
        this.drawPhase = null;
        this.arrowStart = null;
        this.arrowEnd = null;
        this.fixedAngle = null;
        this.currentBox = null;
    }

    /**
     * Generate unique ID for boxes
     * @private
     * @returns {string} Unique identifier
     */
    _generateId() {
        return `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        if (this.config.features.showGrid) {
            this._drawGrid();
        }

        // Draw existing boxes
        this.boxes.forEach(box => this._drawBox(box, false));


        // Draw current box/arrow
        if (this.mode === BoxType.OBBOX && this.drawPhase === DrawPhase.ARROW &&
            this.arrowStart && this.arrowEnd) {
            this._drawArrow(this.arrowStart, this.arrowEnd, true);
        } else if (this.mode === BoxType.OBBOX && this.drawPhase === DrawPhase.BOX &&
            this.arrowStart && this.arrowEnd) {
            // Keep showing the arrow during box expansion
            this._drawArrow(this.arrowStart, this.arrowEnd, false);
        }

        if (this.currentBox) {
            this._drawBox(this.currentBox, true);
        }
    }

    /**
     * Draw background grid
     * @private
     */
    _drawGrid() {
        const { grid } = this.config.colors;
        const { gridSpacing, gridLineWidth } = this.config.styles;

        this.ctx.strokeStyle = grid;
        this.ctx.lineWidth = gridLineWidth;

        for (let x = 0; x < this.canvas.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw a bounding box
     * @private
     * @param {Object} box - Box object
     * @param {boolean} isActive - Whether the box is currently being drawn
     */
    _drawBox(box, isActive) {
        if (box.type === BoxType.ABBOX) {
            const x = Math.min(box.startX, box.endX);
            const y = Math.min(box.startY, box.endY);
            const width = Math.abs(box.endX - box.startX);
            const height = Math.abs(box.endY - box.startY);

            this.ctx.fillStyle = isActive ?
                this.config.colors.fillActive :
                this.config.colors.fillInactive;
            this.ctx.fillRect(x, y, width, height);

            this.ctx.strokeStyle = isActive ?
                this.config.colors.primary :
                this.config.colors.secondary;
            this.ctx.lineWidth = isActive ?
                this.config.styles.activeLineWidth :
                this.config.styles.lineWidth;
            this.ctx.strokeRect(x, y, width, height);
        } else if (box.type === BoxType.OBBOX) {
            this.ctx.save();
            this.ctx.translate(box.centerX, box.centerY);
            this.ctx.rotate(box.angle);

            // Draw box
            this.ctx.fillStyle = isActive ?
                this.config.colors.fillActiveOBB :
                this.config.colors.fillInactiveOBB;
            this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);

            this.ctx.strokeStyle = isActive ?
                this.config.colors.arrow :
                this.config.colors.secondary;
            this.ctx.lineWidth = isActive ?
                this.config.styles.activeLineWidth :
                this.config.styles.lineWidth;
            this.ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);

            this.ctx.restore();

            // Draw arrow on box
            if (box.arrowStart && box.arrowEnd) {
                this._drawArrow(box.arrowStart, box.arrowEnd, false);
            }
        }
    }

    /**
    * Draw an arrow
    * @private
    * @param {Object} start - Start point {x, y}
    * @param {Object} end - End point {x, y}
    * @param {boolean} isDrawing - Whether the arrow is being drawn
    */
    _drawArrow(start, end, isDrawing) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length < 5) return;

        const { arrowActive, arrow, text } = this.config.colors;
        const { activeLineWidth, arrowHeadLength, arrowHeadWidth, fontSize, fontFamily } = this.config.styles;

        // Draw arrow line
        this.ctx.strokeStyle = isDrawing ? arrowActive : arrow;
        this.ctx.lineWidth = activeLineWidth + 1;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        // Draw arrowhead (triangle)
        this.ctx.save();
        this.ctx.translate(end.x, end.y);
        this.ctx.rotate(angle);

        this.ctx.fillStyle = isDrawing ? arrowActive : arrow;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-arrowHeadLength, -arrowHeadWidth);
        this.ctx.lineTo(-arrowHeadLength, arrowHeadWidth);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();

        // Draw angle text
        if (this.config.features.showAngle) {
            const angleDeg = (angle * 180 / Math.PI).toFixed(1);
            this.ctx.fillStyle = text;
            this.ctx.font = `bold ${fontSize}px ${fontFamily}`;
            this.ctx.fillText(
                `${angleDeg}°`,
                start.x + dx / 2 + 10,
                start.y + dy / 2 - 10
            );
        }
    }

    /**
     * Set drawing mode
     * @public
     * @param {string} mode - Drawing mode (BoxType.ABBOX or BoxType.OBBOX)
     */
    setMode(mode) {
        if (!Object.values(BoxType).includes(mode)) {
            throw new Error(`Invalid mode: ${mode}. Use BoxType.ABBOX or BoxType.OBBOX`);
        }

        const previousMode = this.mode;
        this.mode = mode;
        this._resetOBBoxDrawing();
        this.render();

        PubSub.publish(this.TOPICS.MODE_CHANGED, { from: previousMode, to: mode });
    }

    /**
     * Get current mode
     * @public
     * @returns {string} Current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Clear all boxes
     * @public
     */
    clear() {
        const boxCount = this.boxes.length;
        this.boxes = [];
        this.currentBox = null;
        this._resetOBBoxDrawing();
        this.render();

        PubSub.publish(this.TOPICS.CLEARED, { boxCount });
    }

    /**
     * Remove a box by ID
     * @public
     * @param {string} boxId - Box identifier
     * @returns {boolean} Whether the box was found and removed
     */
    removeBox(boxId) {
        const index = this.boxes.findIndex(box => box.id === boxId);
        if (index !== -1) {
            const removed = this.boxes.splice(index, 1)[0];
            this.render();
            PubSub.publish(this.TOPICS.BOX_REMOVED, { box: removed });
            return true;
        }
        return false;
    }

    addBox(box) {
        const newBox = {
            id: this.boxIdCounter++,
            type: box.type || this.currentMode,
            timestamp: Date.now(),
            ...box
        };

        this.boxes.push(newBox);
        this._emitChange();
        PubSub.publish(this.TOPICS.BOX_ADDED, { box: newBox });

        return newBox.id;
    }

    destroy() {
        // Remove all event listeners
        this._removeEventListeners();
        // Reset drawing state
        this._resetOBBoxDrawing();
        this.clear();
        PubSub.publish(this.TOPICS.DESTROYED);
    }
}


export { BoundingBoxTool, BoxType, DrawPhase };