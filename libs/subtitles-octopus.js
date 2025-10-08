"use strict";

/**
 * SubtitlesOctopus - Renders ASS/SSA subtitles on HTML5 video using WebAssembly or fallback worker.
 */
class SubtitlesOctopus {
  /**
   * Initializes the SubtitlesOctopus renderer.
   * @param {Object} options - Configuration options for rendering.
   */
  constructor(options) {
    // Canvas for rendering (optional if video specified)
    this.canvas = options.canvas;
    // Rendering mode: "wasm-blend", "lossy", etc.
    this.renderMode =
      options.renderMode || (options.lossyRender ? "lossy" : "wasm-blend");
    // Memory and glyph limits for libass
    this.libassMemoryLimit = options.libassMemoryLimit || 0;
    this.libassGlyphLimit = options.libassGlyphLimit || 0;
    // Target FPS for rendering
    this.targetFps = options.targetFps || 24;
    // Prescale options for performance
    this.prescaleFactor = options.prescaleFactor || 1.0;
    this.prescaleHeightLimit = options.prescaleHeightLimit || 1080;
    this.maxRenderHeight = options.maxRenderHeight || 0;
    this.dropAllAnimations = options.dropAllAnimations || false;
    this.isOurCanvas = false;
    // Video element to render subtitles over
    this.video = options.video;
    this.canvasParent = null;
    // Font configuration
    this.fonts = options.fonts || [];
    this.availableFonts = options.availableFonts || [];
    this.fallbackFont = options.fallbackFont || "default.woff2";
    this.lazyFileLoading = options.lazyFileLoading || false;
    // Event handlers
    this.onReadyEvent = options.onReady;
    this.subUrl = options.subUrl;
    this.subContent = options.subContent || null;
    this.onErrorEvent = options.onError;
    this.debug = options.debug || false;
    this.lastRenderTime = 0;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.timeOffset = options.timeOffset || 0;
    this.hasAlphaBug = false;
    this.workerActive = false;
    this.frameId = 0;
    this.renderFramesData = null;

    // Detect WebAssembly support and select worker
    this.supportsWebAssembly = SubtitlesOctopus.detectWebAssembly();
    this.workerUrl = this.supportsWebAssembly
      ? options.workerUrl || "subtitles-octopus-worker.js"
      : options.legacyWorkerUrl || "subtitles-octopus-worker-legacy.js";

    this.initImageDataPolyfill();
    this.init();
  }

  /**
   * Detects if WebAssembly is supported in the current browser.
   * @returns {boolean}
   */
  static detectWebAssembly() {
    try {
      if (
        typeof WebAssembly === "object" &&
        typeof WebAssembly.instantiate === "function"
      ) {
        const module = new WebAssembly.Module(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
        );
        return (
          module instanceof WebAssembly.Module &&
          new WebAssembly.Instance(module) instanceof WebAssembly.Instance
        );
      }
    } catch (e) {}
    return false;
  }

  /**
   * Polyfill for ImageData if needed (for browser compatibility).
   */
  initImageDataPolyfill() {
    if (typeof ImageData.prototype.constructor === "function") {
      try {
        new window.ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1);
        return;
      } catch (e) {
        console.log(
          "detected that ImageData is not constructable despite browser saying so"
        );
      }
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    window.ImageData = function () {
      let i = 0;
      let data;
      if (arguments[0] instanceof Uint8ClampedArray) {
        data = arguments[i++];
      }
      const width = arguments[i++];
      const height = arguments[i];
      const imageData = ctx.createImageData(width, height);
      if (data) imageData.data.set(data);
      return imageData;
    };
  }

  /**
   * Handles worker errors.
   */
  workerError = (error) => {
    console.error("Worker error: ", error);
    if (this.onErrorEvent) {
      this.onErrorEvent(error);
    }
    if (!this.debug) {
      this.dispose();
      throw new Error("Worker error: " + error);
    }
  };

  /**
   * Initializes the worker and rendering environment.
   */
  init() {
    if (!window.Worker) {
      this.workerError("worker not supported");
      return;
    }
    if (!this.worker) {
      this.worker = new Worker(this.workerUrl);
      this.worker.addEventListener("message", this.onWorkerMessage);
      this.worker.addEventListener("error", this.workerError);
    }
    this.workerActive = false;
    this.createCanvas();
    this.setVideo(this.video);
    this.setSubUrl(this.subUrl);
    this.worker.postMessage({
      target: "worker-init",
      width: this.canvas.width,
      height: this.canvas.height,
      URL: document.URL,
      currentScript: this.workerUrl,
      preMain: true,
      renderMode: this.renderMode,
      subUrl: this.subUrl,
      subContent: this.subContent,
      fonts: this.fonts,
      availableFonts: this.availableFonts,
      fallbackFont: this.fallbackFont,
      lazyFileLoading: this.lazyFileLoading,
      debug: this.debug,
      targetFps: this.targetFps,
      libassMemoryLimit: this.libassMemoryLimit,
      libassGlyphLimit: this.libassGlyphLimit,
      dropAllAnimations: this.dropAllAnimations,
    });
  }

  /**
   * Creates the canvas for rendering subtitles.
   */
  createCanvas() {
    if (!this.canvas) {
      if (this.video) {
        this.isOurCanvas = true;
        this.canvas = document.createElement("canvas");
        this.canvas.className = "libassjs-canvas";
        this.canvas.style.display = "none";

        this.canvasParent = document.createElement("div");
        this.canvasParent.className = "libassjs-canvas-parent";
        this.canvasParent.appendChild(this.canvas);

        if (this.video.nextSibling) {
          this.video.parentNode.insertBefore(
            this.canvasParent,
            this.video.nextSibling
          );
        } else {
          this.video.parentNode.appendChild(this.canvasParent);
        }
      } else {
        this.workerError(
          "Don't know where to render: you should give video or canvas in options."
        );
      }
    }
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCanvasCtx = this.bufferCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    // Test for alpha bug in some browsers
    this.bufferCanvas.width = 1;
    this.bufferCanvas.height = 1;
    const testBuf = new Uint8ClampedArray([0, 255, 0, 0]);
    const testImage = new ImageData(testBuf, 1, 1);
    this.bufferCanvasCtx.clearRect(0, 0, 1, 1);
    this.ctx.clearRect(0, 0, 1, 1);
    const prePut = this.ctx.getImageData(0, 0, 1, 1).data;
    this.bufferCanvasCtx.putImageData(testImage, 0, 0);
    this.ctx.drawImage(this.bufferCanvas, 0, 0);
    const postPut = this.ctx.getImageData(0, 0, 1, 1).data;
    this.hasAlphaBug = prePut[1] !== postPut[1];
    if (this.hasAlphaBug) {
      console.log(
        "Detected a browser having issue with transparent pixels, applying workaround"
      );
    }
  }

  /**
   * Sets the video element for subtitle rendering and binds events.
   * @param {HTMLVideoElement} video
   */
  setVideo(video) {
    this.video = video;
    if (!this.video) return;
    this.video.addEventListener("timeupdate", this.onTimeUpdate, false);
    this.video.addEventListener("playing", this.onPlaying, false);
    this.video.addEventListener("pause", this.onPause, false);
    this.video.addEventListener("seeking", this.onSeeking, false);
    this.video.addEventListener("seeked", this.onSeeked, false);
    this.video.addEventListener("ratechange", this.onRateChange, false);
    this.video.addEventListener("waiting", this.onWaiting, false);

    document.addEventListener(
      "fullscreenchange",
      this.resizeWithTimeout,
      false
    );
    document.addEventListener(
      "mozfullscreenchange",
      this.resizeWithTimeout,
      false
    );
    document.addEventListener(
      "webkitfullscreenchange",
      this.resizeWithTimeout,
      false
    );
    document.addEventListener(
      "msfullscreenchange",
      this.resizeWithTimeout,
      false
    );
    window.addEventListener("resize", this.resizeWithTimeout, false);

    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(this.resizeWithTimeout);
      this.ro.observe(this.video);
    }

    if (this.video.videoWidth > 0) {
      this.resize();
    } else {
      this.video.addEventListener(
        "loadedmetadata",
        this.onLoadedMetadata,
        false
      );
    }
  }

  /**
   * Calculates the position and size of the video for subtitle overlay.
   * @returns {Object} - { width, height, x, y }
   */
  getVideoPosition() {
    const videoRatio = this.video.videoWidth / this.video.videoHeight;
    const width = this.video.offsetWidth,
      height = this.video.offsetHeight;
    const elementRatio = width / height;
    let realWidth = width,
      realHeight = height;
    if (elementRatio > videoRatio) realWidth = Math.floor(height * videoRatio);
    else realHeight = Math.floor(width / videoRatio);

    const x = (width - realWidth) / 2;
    const y = (height - realHeight) / 2;

    return { width: realWidth, height: realHeight, x, y };
  }

  /**
   * Sets the subtitle URL for loading.
   * @param {string} subUrl
   */
  setSubUrl(subUrl) {
    this.subUrl = subUrl;
  }

  /**
   * Renders frames received from the worker (blend mode).
   */
  renderFrames = () => {
    const data = this.renderFramesData;
    const beforeDrawTime = performance.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const image of data.canvases) {
      this.bufferCanvas.width = image.w;
      this.bufferCanvas.height = image.h;
      const imageBuffer = new Uint8ClampedArray(image.buffer);
      if (this.hasAlphaBug) {
        for (let j = 3; j < imageBuffer.length; j += 4) {
          imageBuffer[j] = imageBuffer[j] >= 1 ? imageBuffer[j] : 1;
        }
      }
      const imageData = new ImageData(imageBuffer, image.w, image.h);
      this.bufferCanvasCtx.putImageData(imageData, 0, 0);
      this.ctx.drawImage(this.bufferCanvas, image.x, image.y);
    }
    if (this.debug) {
      const drawTime = Math.round(performance.now() - beforeDrawTime);
      const blendTime = data.blendTime;
      if (typeof blendTime !== "undefined") {
        console.log(
          `render: ${Math.round(
            data.spentTime - blendTime
          )} ms, blend: ${Math.round(
            blendTime
          )} ms, draw: ${drawTime} ms; TOTAL=${Math.round(
            data.spentTime + drawTime
          )} ms`
        );
      } else {
        console.log(`${Math.round(data.spentTime)} ms (+ ${drawTime} ms draw)`);
      }
      this.renderStart = performance.now();
    }
  };

  /**
   * Renders frames received from the worker (fast bitmap mode).
   */
  renderFastFrames = () => {
    const data = this.renderFramesData;
    const beforeDrawTime = performance.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const image of data.bitmaps) {
      this.ctx.drawImage(image.bitmap, image.x, image.y);
    }
    if (this.debug) {
      const drawTime = Math.round(performance.now() - beforeDrawTime);
      console.log(
        `${data.bitmaps.length} bitmaps, libass: ${Math.round(
          data.libassTime
        )}ms, decode: ${Math.round(data.decodeTime)}ms, draw: ${drawTime}ms`
      );
      this.renderStart = performance.now();
    }
  };

  /**
   * Handles messages from the worker.
   */
  onWorkerMessage = (event) => {
    if (!this.workerActive) {
      this.workerActive = true;
      if (this.onReadyEvent) this.onReadyEvent();
    }
    const data = event.data;
    switch (data.target) {
      case "stdout":
        console.log(data.content);
        break;
      case "console-log":
        console.log(...JSON.parse(data.content));
        break;
      case "console-debug":
        console.debug(...JSON.parse(data.content));
        break;
      case "console-info":
        console.info(...JSON.parse(data.content));
        break;
      case "console-warn":
        console.warn(...JSON.parse(data.content));
        break;
      case "console-error":
        console.error(...JSON.parse(data.content));
        break;
      case "stderr":
        console.error(data.content);
        break;
      case "window":
        window[data.method]();
        break;
      case "canvas":
        switch (data.op) {
          case "getContext":
            this.ctx = this.canvas.getContext(data.type, data.attributes);
            break;
          case "resize":
            this.resize(data.width, data.height);
            break;
          case "renderCanvas":
            if (this.lastRenderTime < data.time) {
              this.lastRenderTime = data.time;
              this.renderFramesData = data;
              window.requestAnimationFrame(this.renderFrames);
            }
            break;
          case "renderFastCanvas":
            if (this.lastRenderTime < data.time) {
              this.lastRenderTime = data.time;
              this.renderFramesData = data;
              window.requestAnimationFrame(this.renderFastFrames);
            }
            break;
          case "setObjectProperty":
            this.canvas[data.object][data.property] = data.value;
            break;
          default:
            throw "eh?";
        }
        break;
      case "tick":
        this.frameId = data.id;
        this.worker.postMessage({ target: "tock", id: this.frameId });
        break;
      case "custom":
        if (this.onCustomMessage) {
          this.onCustomMessage(event);
        } else {
          throw "Custom message received but client onCustomMessage not implemented.";
        }
        break;
      case "setimmediate":
        this.worker.postMessage({ target: "setimmediate" });
        break;
      case "get-events":
      case "get-styles":
      case "ready":
        break;
      default:
        throw "what? " + data.target;
    }
  };

  /**
   * Computes the canvas size for rendering subtitles.
   */
  _computeCanvasSize(width, height) {
    const scalefactor = this.prescaleFactor <= 0 ? 1.0 : this.prescaleFactor;
    if (height <= 0 || width <= 0) {
      width = 0;
      height = 0;
    } else {
      const sgn = scalefactor < 1 ? -1 : 1;
      let newH = height;
      if (sgn * newH * scalefactor <= sgn * this.prescaleHeightLimit)
        newH *= scalefactor;
      else if (sgn * newH < sgn * this.prescaleHeightLimit)
        newH = this.prescaleHeightLimit;
      if (this.maxRenderHeight > 0 && newH > this.maxRenderHeight)
        newH = this.maxRenderHeight;
      width *= newH / height;
      height = newH;
    }
    return { width, height };
  }

  /**
   * Resizes the subtitle canvas to match the video or specified size.
   */
  resize = (width, height, top = 0, left = 0) => {
    let videoSize = null;
    if ((!width || !height) && this.video) {
      videoSize = this.getVideoPosition();
      const newSize = this._computeCanvasSize(
        videoSize.width * this.pixelRatio,
        videoSize.height * this.pixelRatio
      );
      width = newSize.width;
      height = newSize.height;
      const offset =
        this.canvasParent.getBoundingClientRect().top -
        this.video.getBoundingClientRect().top;
      top = videoSize.y - offset;
      left = videoSize.x;
    }
    if (!width || !height) {
      if (!this.video) {
        console.error(
          "width or height is 0. You should specify width & height for resize."
        );
      }
      return;
    }
    if (
      this.canvas.width !== width ||
      this.canvas.height !== height ||
      this.canvas.style.top !== `${top}px` ||
      this.canvas.style.left !== `${left}px`
    ) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (videoSize != null) {
        this.canvasParent.style.position = "relative";
        this.canvas.style.display = "block";
        this.canvas.style.position = "absolute";
        this.canvas.style.width = videoSize.width + "px";
        this.canvas.style.height = videoSize.height + "px";
        this.canvas.style.top = top + "px";
        this.canvas.style.left = left + "px";
        this.canvas.style.pointerEvents = "none";
      }
      this.worker.postMessage({
        target: "canvas",
        width: this.canvas.width,
        height: this.canvas.height,
      });
    }
  };

  /**
   * Resizes the canvas with a timeout (for fullscreen changes, etc.).
   */
  resizeWithTimeout = () => {
    this.resize();
    setTimeout(this.resize, 100);
  };

  /**
   * Runs a benchmark in the worker.
   */
  runBenchmark() {
    this.worker.postMessage({ target: "runBenchmark" });
  }

  /**
   * Sends a custom message to the worker.
   */
  customMessage(data, options = {}) {
    this.worker.postMessage({
      target: "custom",
      userData: data,
      preMain: options.preMain,
    });
  }

  /**
   * Sets the current playback time for subtitle rendering.
   */
  setCurrentTime(currentTime) {
    this.worker.postMessage({
      target: "video",
      currentTime,
    });
  }

  /**
   * Sets the subtitle track by URL.
   */
  setTrackByUrl(url) {
    this.worker.postMessage({
      target: "set-track-by-url",
      url,
    });
  }

  /**
   * Sets the subtitle track by content.
   */
  setTrack(content) {
    this.worker.postMessage({
      target: "set-track",
      content,
    });
  }

  /**
   * Frees the current subtitle track.
   */
  freeTrack() {
    this.worker.postMessage({
      target: "free-track",
    });
  }

  /**
   * Sets the paused state for subtitle rendering.
   */
  setIsPaused(isPaused, currentTime) {
    this.worker.postMessage({
      target: "video",
      isPaused,
      currentTime,
    });
  }

  /**
   * Sets the playback rate for subtitle rendering.
   */
  setRate(rate) {
    this.worker.postMessage({
      target: "video",
      rate,
    });
  }

  /**
   * Cleans up and disposes the renderer and worker.
   */
  dispose() {
    this.worker.postMessage({ target: "destroy" });
    this.worker.terminate();
    this.worker.removeEventListener("message", this.onWorkerMessage);
    this.worker.removeEventListener("error", this.workerError);
    this.workerActive = false;
    this.worker = null;
    if (this.video) {
      this.video.removeEventListener("timeupdate", this.onTimeUpdate, false);
      this.video.removeEventListener("playing", this.onPlaying, false);
      this.video.removeEventListener("pause", this.onPause, false);
      this.video.removeEventListener("seeking", this.onSeeking, false);
      this.video.removeEventListener("seeked", this.onSeeked, false);
      this.video.removeEventListener("ratechange", this.onRateChange, false);
      this.video.removeEventListener("waiting", this.onWaiting, false);
      this.video.removeEventListener(
        "loadedmetadata",
        this.onLoadedMetadata,
        false
      );

      document.removeEventListener(
        "fullscreenchange",
        this.resizeWithTimeout,
        false
      );
      document.removeEventListener(
        "mozfullscreenchange",
        this.resizeWithTimeout,
        false
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        this.resizeWithTimeout,
        false
      );
      document.removeEventListener(
        "msfullscreenchange",
        this.resizeWithTimeout,
        false
      );
      window.removeEventListener("resize", this.resizeWithTimeout, false);

      this.video.parentNode.removeChild(this.canvasParent);
      this.video = null;
    }
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    this.onCustomMessage = null;
    this.onErrorEvent = null;
    this.onReadyEvent = null;
  }

  /**
   * Fetches data from the worker with a timeout and success/error callbacks.
   */
  fetchFromWorker(workerOptions, onSuccess, onError) {
    try {
      const target = workerOptions["target"];
      const timeout = setTimeout(() => {
        reject(Error("Error: Timeout while try to fetch " + target));
      }, 5000);

      const resolve = (event) => {
        if (event.data.target === target) {
          onSuccess(event.data);
          this.worker.removeEventListener("message", resolve);
          this.worker.removeEventListener("error", reject);
          clearTimeout(timeout);
        }
      };

      const reject = (event) => {
        onError(event);
        this.worker.removeEventListener("message", resolve);
        this.worker.removeEventListener("error", reject);
        clearTimeout(timeout);
      };

      this.worker.addEventListener("message", resolve);
      this.worker.addEventListener("error", reject);

      this.worker.postMessage(workerOptions);
    } catch (error) {
      onError(error);
    }
  }

  /**
   * Creates a new subtitle event in the worker.
   */
  createEvent(event) {
    this.worker.postMessage({
      target: "create-event",
      event,
    });
  }

  /**
   * Gets all subtitle events from the worker.
   */
  getEvents(onSuccess, onError) {
    this.fetchFromWorker(
      {
        target: "get-events",
      },
      (data) => onSuccess(data.events),
      onError
    );
  }

  /**
   * Sets a subtitle event at a specific index.
   */
  setEvent(event, index) {
    this.worker.postMessage({
      target: "set-event",
      event,
      index,
    });
  }

  /**
   * Removes a subtitle event at a specific index.
   */
  removeEvent(index) {
    this.worker.postMessage({
      target: "remove-event",
      index,
    });
  }

  /**
   * Creates a new subtitle style in the worker.
   */
  createStyle(style) {
    this.worker.postMessage({
      target: "create-style",
      style,
    });
  }

  /**
   * Gets all subtitle styles from the worker.
   */
  getStyles(onSuccess, onError) {
    this.fetchFromWorker(
      {
        target: "get-styles",
      },
      (data) => onSuccess(data.styles),
      onError
    );
  }

  /**
   * Sets a subtitle style at a specific index.
   */
  setStyle(style, index) {
    this.worker.postMessage({
      target: "set-style",
      style,
      index,
    });
  }

  /**
   * Removes a subtitle style at a specific index.
   */
  removeStyle(index) {
    this.worker.postMessage({
      target: "remove-style",
      index,
    });
  }

  // Video event handlers as arrow functions to preserve 'this'
  onTimeUpdate = () => {
    this.setCurrentTime(this.video.currentTime + this.timeOffset);
  };

  onPlaying = () => {
    this.setIsPaused(false, this.video.currentTime + this.timeOffset);
  };

  onPause = () => {
    this.setIsPaused(true, this.video.currentTime + this.timeOffset);
  };

  onSeeking = () => {
    this.video.removeEventListener("timeupdate", this.onTimeUpdate, false);
  };

  onSeeked = () => {
    this.video.addEventListener("timeupdate", this.onTimeUpdate, false);
    const currentTime = this.video.currentTime + this.timeOffset;
    this.setCurrentTime(currentTime);
  };

  onRateChange = () => {
    this.setRate(this.video.playbackRate);
  };

  onWaiting = () => {
    this.setIsPaused(true, this.video.currentTime + this.timeOffset);
  };

  onLoadedMetadata = (e) => {
    e.target.removeEventListener(e.type, this.onLoadedMetadata, false);
    this.resize();
  };
}

// Call global on-load handler if present
if (typeof SubtitlesOctopusOnLoad === "function") {
  SubtitlesOctopusOnLoad();
}

// Export for CommonJS or browser global
if (typeof exports !== "undefined") {
  if (typeof module !== "undefined" && module.exports) {
    exports = module.exports = SubtitlesOctopus;
  }
}
window.SubtitlesOctopus = SubtitlesOctopus;
