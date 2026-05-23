export class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.isDrawing = false;
    this.hasInk = false;
    this._init();
  }

  _init() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#111827";

    const toPoint = (event) => {
      const r = this.canvas.getBoundingClientRect();
      const touch = event.touches?.[0] || event.changedTouches?.[0] || null;
      const x = touch ? touch.clientX - r.left : event.clientX - r.left;
      const y = touch ? touch.clientY - r.top : event.clientY - r.top;
      return { x, y };
    };

    const start = (event) => {
      event.preventDefault();
      const p = toPoint(event);
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.isDrawing = true;
      this.hasInk = true;
    };

    const move = (event) => {
      if (!this.isDrawing) return;
      event.preventDefault();
      const p = toPoint(event);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    };

    const end = (event) => {
      if (!this.isDrawing) return;
      event.preventDefault();
      this.isDrawing = false;
      this.ctx.closePath();
    };

    this.canvas.addEventListener("mousedown", start);
    this.canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);

    this.canvas.addEventListener("touchstart", start, { passive: false });
    this.canvas.addEventListener("touchmove", move, { passive: false });
    this.canvas.addEventListener("touchend", end, { passive: false });
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.hasInk = false;
  }

  isEmpty() {
    return !this.hasInk;
  }

  toDataUrl() {
    return this.canvas.toDataURL("image/png");
  }
}
