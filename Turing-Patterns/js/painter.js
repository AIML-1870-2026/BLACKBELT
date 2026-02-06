// Painter module for mouse/touch drawing interaction on canvas

export class Painter {
    constructor(canvas, simulation, renderer) {
        this.canvas = canvas;
        this.simulation = simulation;
        this.renderer = renderer;

        // Brush settings
        this.brushRadius = 10;
        this.isDrawing = false;

        // Mouse position for cursor
        this.mouseX = -1;
        this.mouseY = -1;
        this.isHovering = false;

        // Chemical to paint (model's default display chemical)
        this.paintChemical = 1;

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        // Attach event listeners
        this.attachListeners();
    }

    // Set simulation reference
    setSimulation(simulation) {
        this.simulation = simulation;
        if (simulation && simulation.model) {
            this.paintChemical = simulation.model.defaultDisplayChemical;
        }
    }

    // Set brush radius
    setBrushRadius(radius) {
        this.brushRadius = Math.max(2, Math.min(30, radius));
    }

    // Set which chemical to paint
    setPaintChemical(index) {
        this.paintChemical = index;
    }

    // Attach all event listeners
    attachListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('mouseenter', this.onMouseEnter);
        this.canvas.addEventListener('mouseleave', this.onMouseLeave);

        // Touch events
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd);

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Convert canvas coordinates to simulation grid coordinates
    canvasToGrid(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.simulation.width / rect.width;
        const scaleY = this.simulation.height / rect.height;

        const x = Math.floor((clientX - rect.left) * scaleX);
        const y = Math.floor((clientY - rect.top) * scaleY);

        return { x, y };
    }

    // Paint at position
    paint(clientX, clientY) {
        if (!this.simulation) return;

        const { x, y } = this.canvasToGrid(clientX, clientY);

        // Paint the selected chemical
        this.simulation.paint(x, y, this.brushRadius, this.paintChemical);
    }

    // Mouse event handlers
    onMouseDown(e) {
        this.isDrawing = true;
        this.paint(e.clientX, e.clientY);
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.isHovering = true;

        if (this.isDrawing) {
            this.paint(e.clientX, e.clientY);
        }
    }

    onMouseUp(e) {
        this.isDrawing = false;
    }

    onMouseEnter(e) {
        this.isHovering = true;
    }

    onMouseLeave(e) {
        this.isDrawing = false;
        this.isHovering = false;
        this.mouseX = -1;
        this.mouseY = -1;
    }

    // Touch event handlers
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.isDrawing = true;
            this.paint(touch.clientX, touch.clientY);
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (this.isDrawing && e.touches.length > 0) {
            const touch = e.touches[0];
            this.paint(touch.clientX, touch.clientY);
        }
    }

    onTouchEnd(e) {
        this.isDrawing = false;
    }

    // Get cursor position and radius for rendering
    getCursorInfo() {
        if (!this.isHovering || this.mouseX < 0) {
            return null;
        }

        // Convert to simulation coordinates for radius
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.simulation.width / rect.width;

        return {
            x: this.mouseX * scaleX,
            y: this.mouseY * (this.simulation.height / rect.height),
            radius: this.brushRadius
        };
    }

    // Detach event listeners (for cleanup)
    detach() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseenter', this.onMouseEnter);
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
    }
}
