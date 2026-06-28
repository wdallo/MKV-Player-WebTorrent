let torrentParser;

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Show Browse Sites tab only in Electron
  if (window.electronAPI) {
    const browseTabBtn = document.getElementById("browse-tab-btn");
    if (browseTabBtn) browseTabBtn.style.display = "inline-block";

    // Apply Electron fullscreen layout
    document.body.classList.add("electron-app");

    // Add Electron-specific stylesheet
    const electronStyle = document.createElement("link");
    electronStyle.rel = "stylesheet";
    electronStyle.href = "/libs/styles/electron-min.css";
    document.head.appendChild(electronStyle);
  }

  // SAFE WINDOW ASSIGNMENT: Prevents crashing after minifier name mangling
  const ActualParserClass = window.TorrentParser || TorrentParser;
  if (typeof ActualParserClass === "function") {
    torrentParser = new ActualParserClass();
  }

  setupEventListeners();

  // Check if there's a magnet link in the URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const magnetUrl = urlParams.get("magnet");
  if (magnetUrl && magnetUrl.startsWith("magnet:")) {
    const magnetUrlInput = document.getElementById("magnet-url");
    if (magnetUrlInput) magnetUrlInput.value = magnetUrl;
    setTimeout(() => {
      window.location.href = "/player?url=" + encodeURIComponent(magnetUrl);
    }, 500);
  }
});

function setupEventListeners() {
  // Tab switching setup logic
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const tabName = this.dataset.tab;
      switchTab(tabName);
    });
  });

  // Browser functionality layout references with BrowserView
  const siteUrlInput = document.getElementById("site-url");
  const loadSiteBtn = document.getElementById("load-site-btn");
  const backBtn = document.getElementById("back-btn");
  const forwardBtn = document.getElementById("forward-btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const closeBrowserBtn = document.getElementById("close-browser-btn");

  let webview = null;
  let browserActive = false;
  let loadingTimeout = null;

  async function loadUrl(url) {
    try {
      if (!webview) {
        webview = document.getElementById("browser-webview");

        // Wait for webview frame context to be completely ready before setting up triggers
        await new Promise((resolve) => {
          if (webview.getWebContentsId) {
            resolve();
          } else {
            webview.addEventListener("dom-ready", () => resolve(), {
              once: true,
            });
          }
        });

        // Setup webview loading state event listeners
        webview.addEventListener("did-start-loading", (e) => {
          if (e.isMainFrame === false) return; // Ignore sub-iframe ad hooks

          // Block clicking on the view during active async navigation buffering
          webview.style.pointerEvents = "none";
          const loader = document.getElementById("browser-loading");
          if (loader) loader.style.display = "flex";

          if (loadingTimeout) clearTimeout(loadingTimeout);

          // Force release lock state after a max fallback limit of 3 seconds
          loadingTimeout = setTimeout(() => {
            const fallbackLoader = document.getElementById("browser-loading");
            if (fallbackLoader) fallbackLoader.style.display = "none";
            webview.style.pointerEvents = "auto";
          }, 3000);
        });

        webview.addEventListener("did-finish-load", () => {
          webview.style.pointerEvents = "auto";
          const loader = document.getElementById("browser-loading");
          if (loader) loader.style.display = "none";
          if (loadingTimeout) clearTimeout(loadingTimeout);
          injectMagnetButtons();
        });

        webview.addEventListener("did-fail-load", (e) => {
          if (e.isMainFrame === false) return;
          if (e.errorCode === -3) return; // Ignore navigation abort cancellations

          webview.style.pointerEvents = "auto";
          const loader = document.getElementById("browser-loading");
          if (loader) loader.style.display = "none";
        });

        webview.addEventListener("did-navigate-in-page", () => {
          injectMagnetButtons();
        });

        // Capture downstream console messages emitted from inside webview context
        webview.addEventListener("console-message", (e) => {
          if (e.message && e.message.startsWith("MKV_PLAY:")) {
            const targetMagnet = e.message.replace("MKV_PLAY:", "");
            window.location.href = `/player?url=${encodeURIComponent(targetMagnet)}`;
          }
        });

        webview.addEventListener("will-navigate", (e) => {
          if (e.url.startsWith("magnet:")) {
            e.preventDefault();
          }
        });

        webview.addEventListener("new-window", (e) => {
          e.preventDefault();
          if (!e.url.startsWith("magnet:") && e.url.startsWith("http")) {
            window.electronAPI?.openExternal(e.url);
          }
        });
      }

      // Hide layout placeholders and spin up fullscreen frame rendering bounds
      const placeholderText = document.getElementById("placeholder-text");
      const browserLoader = document.getElementById("browser-loading");
      const browserPlaceholder = document.getElementById("browser-placeholder");
      const browserActiveMsg = document.getElementById("browser-active-msg");

      if (placeholderText) placeholderText.style.display = "none";
      if (browserLoader) browserLoader.style.display = "flex";

      if (browserPlaceholder) {
        browserPlaceholder.style.alignItems = "stretch";
        browserPlaceholder.style.justifyContent = "stretch";
      }

      webview.style.cssText =
        "position: absolute; top: 0; left: 0; width: 100%; height: 100%; ";
      webview.src = url;

      browserActive = true;
      if (browserActiveMsg) browserActiveMsg.style.display = "block";
    } catch (error) {
      console.error("Failed to load URL:", error);
      const magnetForm = document.getElementById("magnet-form");
      showError("Failed to load website: " + error.message, magnetForm);
    }
  }
  function injectMagnetButtons() {
    if (!webview) return;

    // Fully closed production injection template literal layout block
    const injectionScript = `
    (function() {
      // NOTE: Removed window.magnetButtonsInjected guard to ensure mutations can re-evaluate blocks correctly

      if (!document.getElementById('mkv-scrollbar-style')) {
        const scrollbarStyle = document.createElement('style');
        scrollbarStyle.id = 'mkv-scrollbar-style';
        scrollbarStyle.textContent = \`
          *::-webkit-scrollbar { width: 10px; height: 10px; }
          *::-webkit-scrollbar-track { background: #181818; border-radius: 5px; }
          *::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #444, #333); border-radius: 5px; border: 1px solid #222; }
          *::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #555, #444); border: 1px solid #333; }
        \`;
        document.head.appendChild(scrollbarStyle);
      }
      
      function addPlayButton(link) {
        if (link.dataset.playButtonAdded) return;
        link.dataset.playButtonAdded = 'true';
        
        const currentUrl = window.location.href;

        // --- EXCLUSIVE PREMIUM PAIRING FOR SUBSPLEASE ONLY ---
        if (currentUrl.includes('subsplease.org')) {
          const linkText = link.textContent.trim();
          const resolutionText = linkText.replace(/[\\s\\[\\]]/g, '') || '1080p'; 
          
          // Re-render the existing link as a beautiful split badge component (PLAY | 1080p)
          link.innerHTML = '<span style="background: #8b5cf6; color: white; padding: 4px 10px; border-radius: 4px 0 0 4px; font-weight: bold; font-size: 11px;">▶ PLAY</span><span style="background: #333; color: #fff; padding: 4px 10px; border-radius: 0 4px 4px 0; font-size: 11px; font-weight: 600; border-left: 1px solid #444;">' + resolutionText + '</span>';
          
          link.style.cssText = 'display: inline-flex; align-items: center; text-decoration: none !important; margin: 4px 6px; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.2s, box-shadow 0.2s; vertical-align: middle;';
          
          // Smooth hover elevation effects matching your player theme profile
          link.onmouseover = function() {
            link.style.transform = 'translateY(-1px) scale(1.03)';
            link.style.boxShadow = '0 4px 10px rgba(139, 92, 246, 0.35)';
          };
          link.onmouseout = function() {
            link.style.transform = 'none';
            link.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          };

          link.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("MKV_PLAY:" + link.href);
          };
        } 
        // --- ORIGINAL STANDARD BUTTON FOR ALL OTHER WEBSITES (Nyaa, etc.) ---
        else {
          const btn = document.createElement('button');
          btn.textContent = '▶ Play';
          btn.style.cssText = 'display: inline-block; margin-left: 8px; padding: 4px 12px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; vertical-align: middle;';
          btn.onmouseover = function() { btn.style.background = '#7c3aed'; };
          btn.onmouseout = function() { btn.style.background = '#8b5cf6'; };
          
          btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("MKV_PLAY:" + link.href);
          };
          link.parentElement.insertBefore(btn, link.nextSibling);
        }
      }

      // CRITICAL SECURITY FIX: Scans anchors explicitly starting with "magnet:?" 
      // to ensure fake links or plain textual tags are entirely ignored across hosts
      document.querySelectorAll('a[href^="magnet:?"]').forEach(addPlayButton);
      
      const observer = new MutationObserver(function() {
        document.querySelectorAll('a[href^="magnet:?"]').forEach(addPlayButton);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })();
  `;

    webview.executeJavaScript(injectionScript).catch((err) => {
      console.error("Failed to inject buttons:", err);
    });
  }

  // Handle direct navigation text triggers
  if (loadSiteBtn && siteUrlInput) {
    loadSiteBtn.addEventListener("click", async () => {
      const url = siteUrlInput.value.trim();
      if (url) {
        await loadUrl(url.startsWith("http") ? url : "https://" + url);
      }
    });

    siteUrlInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        loadSiteBtn.click();
      }
    });
  }

  // Browser control bar navigation handlers
  if (backBtn)
    backBtn.addEventListener("click", () => {
      if (webview) webview.goBack();
    });
  if (forwardBtn)
    forwardBtn.addEventListener("click", () => {
      if (webview) webview.goForward();
    });
  if (refreshBtn)
    refreshBtn.addEventListener("click", () => {
      if (webview) webview.reload();
    });

  if (closeBrowserBtn) {
    closeBrowserBtn.addEventListener("click", () => {
      if (webview) {
        webview.classList.add("hidden");
        webview.src = "about:blank";
      }

      const blankMessage = document.getElementById("placeholder-text");
      if (blankMessage) {
        blankMessage.style.cssText =
          "display: block; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);";
      }

      const activeMsg = document.getElementById("browser-active-msg");
      if (activeMsg) activeMsg.style.display = "none";
      browserActive = false;
    });
  }

  // Quick link bookmarks triggers
  document.querySelectorAll(".quick-link-btn-small").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const url = this.getAttribute("data-url");
      if (siteUrlInput) siteUrlInput.value = url;
      await loadUrl(url);
    });
  });

  // Magnet URL Form submission validation pipeline
  const magnetForm = document.getElementById("magnet-form");
  if (magnetForm) {
    magnetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const urlInput = document.getElementById("magnet-url");
      const url = urlInput ? urlInput.value.trim() : "";
      if (url && url.startsWith("magnet:")) {
        hideError(this);
        window.location.href = "/player?url=" + encodeURIComponent(url);
      } else {
        showError("Please enter a valid magnet URL.", this);
      }
    });
  }

  // Torrent File Form submission validation pipeline
  const torrentForm = document.getElementById("torrent-form");
  if (torrentForm) {
    torrentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      processTorrentFile();
    });
  }

  // Drag and Drop native filesystem hooks
  const fileInput = document.getElementById("torrent-file");
  const uploadArea = document.getElementById("file-upload-area");
  const chooseFileBtn = document.getElementById("choose-file-btn");

  if (fileInput) fileInput.addEventListener("change", handleFileSelect);
  if (chooseFileBtn && fileInput) {
    chooseFileBtn.addEventListener("click", () => fileInput.click());
  }

  if (uploadArea) {
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("drag-over");
    });
    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("drag-over");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("drag-over");
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith(".torrent")) {
        if (fileInput) {
          fileInput.files = files;
          handleFileSelect();
        }
      } else {
        showError("Please select a valid .torrent file.", torrentForm);
      }
    });
  }
}

function switchTab(tabName) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
    if (content.id === "browser-tab") content.style.display = "none";
  });

  const activeTab = document.getElementById(`${tabName}-tab`);
  if (activeTab) {
    activeTab.classList.add("active");
    if (tabName === "browser") activeTab.style.display = "flex";

    // Clear old validation banners on contextual tab shifts
    const activeForm = activeTab.querySelector("form");
    hideError(activeForm);
  }
}

function handleFileSelect() {
  const fileInput = document.getElementById("torrent-file");
  const fileInfo = document.getElementById("file-info");
  const fileName = document.getElementById("file-name");
  const torrentForm = document.getElementById("torrent-form");

  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.name.endsWith(".torrent")) {
      if (fileName) fileName.textContent = `Selected: ${file.name}`;
      if (fileInfo) fileInfo.style.display = "block";
      hideError(torrentForm);
    } else {
      showError("Please select a valid .torrent file.", torrentForm);
      if (fileInfo) fileInfo.style.display = "none";
    }
  } else {
    if (fileInfo) fileInfo.style.display = "none";
  }
}

async function processTorrentFile() {
  const fileInput = document.getElementById("torrent-file");
  const loadingDiv = document.getElementById("loading");
  const torrentForm = document.getElementById("torrent-form");

  if (!fileInput || fileInput.files.length === 0) {
    showError("Please select a torrent file first.", torrentForm);
    return;
  }

  const file = fileInput.files[0];
  if (loadingDiv) loadingDiv.style.display = "block";
  hideError(torrentForm);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Dynamic recovery fallback designed to bind class instances safely after bundle shrinking mangle runs
    const SystemParserClass = window.TorrentParser || TorrentParser;
    if (!torrentParser && typeof SystemParserClass === "function") {
      torrentParser = new SystemParserClass();
    }

    const magnetUrl = await torrentParser.parseTorrentFile(uint8Array);
    if (loadingDiv) loadingDiv.style.display = "none";
    window.location.href = "/player?url=" + encodeURIComponent(magnetUrl);
  } catch (error) {
    if (loadingDiv) loadingDiv.style.display = "none";
    console.error("Error parsing torrent file:", error);
    showError(`Failed to parse torrent file: ${error.message}`, torrentForm);
  }
}

/**
 * @param {string} message - The validation error text string to display.
 * @param {HTMLElement} [formElement] - Optional context form block override.
 */
function showError(message, formElement) {
  // 1. Locate your unique pre-existing error layout placeholder node
  const errorDiv = document.getElementById("magnet-error");

  // 2. Identify the currently selected active tab context
  const activeTab = document.querySelector(".tab-content.active") || document;
  const activeForm =
    formElement || activeTab.querySelector("form") || activeTab;
  const textInput = activeForm.querySelector('input[type="text"], textarea');
  const uploadArea = document.getElementById("file-upload-area");

  if (!errorDiv || !activeForm) {
    console.error(
      "Required structural form elements missing from the active view hierarchy.",
    );
    return;
  }

  // 3. DYNAMIC REPOSITIONING: Append your existing div directly to the very bottom of the active form
  activeForm.appendChild(errorDiv);

  // 4. Inject high-priority premium inline layout style rules with full-width centering
  errorDiv.style.cssText = `
    display: flex !important; 
    align-items: center; 
    justify-content: center; /* Centers everything inside the box horizontally */
    background-color: rgba(229, 9, 20, 0.12) !important; 
    border: 1px solid rgba(229, 9, 20, 0.4) !important; 
    border-radius: 6px; 
    padding: 12px 16px; 
    margin-top: 20px !important; /* Generates a clean gap directly below the active button context */
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2); 
    box-sizing: border-box; 
    width: 100% !important; /* Stretches the alert container fully across your form layout wrapper */
    animation: fadeInOpacityBlock 0.18s ease-out;
  `;

  // 5. Populate structural warning marks and message strings into your container
  errorDiv.innerHTML = `
    <span style="color: #ff5555 !important; font-size: 1.1em; font-weight: bold; margin-right: 10px; flex-shrink: 0; display: inline-block;">⚠</span>
    <span style="color: #ffb3b3 !important; font-size: 0.95em; font-weight: 500; font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.3px; text-align: center;">
      ${message}
    </span>
  `;

  // 6. Project validation error glowing frames onto Magnet input elements if active
  if (textInput && activeTab.id === "magnet-tab") {
    textInput.style.setProperty("border-color", "#ff5555", "important");
    textInput.style.setProperty(
      "box-shadow",
      "0 0 8px rgba(255, 85, 85, 0.25)",
      "important",
    );

    textInput.addEventListener(
      "input",
      () => {
        textInput.style.removeProperty("border-color");
        textInput.style.removeProperty("box-shadow");
        hideError();
      },
      { once: true },
    );
  }

  // 7. Project drag-and-drop validation error frames onto Torrent file container boundaries if active
  if (uploadArea && activeTab.id === "torrent-tab") {
    uploadArea.style.setProperty("border-color", "#ff5555", "important");
    uploadArea.style.setProperty(
      "box-shadow",
      "0 0 12px rgba(255, 85, 85, 0.15)",
      "important",
    );

    const resetTorrentState = () => {
      uploadArea.style.removeProperty("border-color");
      uploadArea.style.removeProperty("box-shadow");
      hideError();
    };

    uploadArea.addEventListener("dragenter", resetTorrentState, { once: true });
    const selectButton = document.getElementById("choose-file-btn");
    if (selectButton)
      selectButton.addEventListener("click", resetTorrentState, { once: true });
  }
}

/**
 * Universal safe cleanup script to instantly drop active input border glows and hide the shared error div.
 */
function hideError() {
  const errorDiv = document.getElementById("magnet-error");
  if (errorDiv) {
    errorDiv.style.setProperty("display", "none", "important");
    errorDiv.innerHTML = "";
  }

  // Clear text input fields styling variables
  document.querySelectorAll('input[type="text"], textarea').forEach((input) => {
    input.style.removeProperty("border-color");
    input.style.removeProperty("box-shadow");
  });

  // Clear upload area boundary styling variables
  const uploadArea = document.getElementById("file-upload-area");
  if (uploadArea) {
    uploadArea.style.removeProperty("border-color");
    uploadArea.style.removeProperty("box-shadow");
  }
}
