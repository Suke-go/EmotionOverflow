import Common from "./Common";

export default class EmotionUI {
    constructor(emotionEngine) {
        this.engine = emotionEngine;
        this.isProcessing = false;
        this.init();
    }

    init() {
        // Container
        this.container = document.createElement("div");
        this.container.id = "emotion-ui";
        this.container.innerHTML = `
            <div id="emotion-input-area">
                <input type="text" id="emotion-text" placeholder="Enter a sentence... (EN)" autocomplete="off" />
                <button id="emotion-submit">▶</button>
            </div>
            <div id="emotion-loading" style="display:none;">Loading model...</div>
            <div id="emotion-feedback" style="display:none;">
                <div id="emotion-color-swatch"></div>
                <div id="emotion-bars"></div>
                <div id="emotion-vad"></div>
            </div>
        `;
        document.body.appendChild(this.container);

        this._injectStyles();

        // Elements
        this.input = document.getElementById("emotion-text");
        this.submitBtn = document.getElementById("emotion-submit");
        this.loading = document.getElementById("emotion-loading");
        this.feedback = document.getElementById("emotion-feedback");
        this.colorSwatch = document.getElementById("emotion-color-swatch");
        this.barsEl = document.getElementById("emotion-bars");
        this.vadEl = document.getElementById("emotion-vad");

        // Events
        this.submitBtn.addEventListener("click", () => this._onSubmit());
        this.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this._onSubmit();
        });

        // Init model
        this._initModel();
    }

    async _initModel() {
        this.loading.style.display = "block";
        this.loading.textContent = "Loading emotion model...";
        await this.engine.init();
        this.loading.style.display = "none";
        this.input.placeholder = this.engine.isReady
            ? "Type a feeling... (EN)"
            : "Model failed to load";
        this.input.disabled = !this.engine.isReady;
    }

    async _onSubmit() {
        const text = this.input.value.trim();
        if (!text || this.isProcessing || !this.engine.isReady) return;

        this.isProcessing = true;
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = "...";

        const result = await this.engine.classify(text);

        this.submitBtn.disabled = false;
        this.submitBtn.textContent = "▶";
        this.isProcessing = false;

        if (result) {
            this._updateFeedback(result);
        }
    }

    _updateFeedback(result) {
        this.feedback.style.display = "flex";

        // Color swatch
        const { r, g, b } = result.color;
        const hex = `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`;
        this.colorSwatch.style.backgroundColor = hex;

        // Emotion bars
        const sorted = Object.entries(result.emotions)
            .sort((a, b) => b[1] - a[1]);

        this.barsEl.innerHTML = sorted.map(([emo, conf]) => {
            const pct = (conf * 100).toFixed(1);
            return `<div class="emo-bar-row">
                <span class="emo-label">${emo}</span>
                <div class="emo-bar-bg"><div class="emo-bar-fill" style="width:${pct}%"></div></div>
                <span class="emo-pct">${pct}%</span>
            </div>`;
        }).join("");

        // VAD values
        const { V, A, D } = result.vad;
        this.vadEl.innerHTML = `V:${V.toFixed(2)} A:${A.toFixed(2)} D:${D.toFixed(2)}`;
    }

    _injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            #emotion-ui {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 1000;
                font-family: 'Inter', 'Segoe UI', sans-serif;
                font-size: 13px;
                color: #e0e0e0;
                max-width: 320px;
            }
            #emotion-input-area {
                display: flex;
                gap: 6px;
            }
            #emotion-text {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 8px;
                background: rgba(0,0,0,0.65);
                color: #fff;
                font-size: 14px;
                outline: none;
                backdrop-filter: blur(12px);
                transition: border-color 0.2s;
            }
            #emotion-text:focus {
                border-color: rgba(255,255,255,0.4);
            }
            #emotion-text::placeholder {
                color: rgba(255,255,255,0.35);
            }
            #emotion-submit {
                padding: 10px 16px;
                border: none;
                border-radius: 8px;
                background: rgba(255,255,255,0.12);
                color: #fff;
                font-size: 14px;
                cursor: pointer;
                backdrop-filter: blur(12px);
                transition: background 0.2s;
            }
            #emotion-submit:hover {
                background: rgba(255,255,255,0.22);
            }
            #emotion-loading {
                margin-top: 8px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.6);
                border-radius: 6px;
                font-size: 12px;
                color: rgba(255,255,255,0.6);
                backdrop-filter: blur(12px);
            }
            #emotion-feedback {
                display: none;
                margin-top: 10px;
                padding: 12px;
                background: rgba(0,0,0,0.65);
                border-radius: 10px;
                backdrop-filter: blur(12px);
                gap: 10px;
                flex-direction: column;
                border: 1px solid rgba(255,255,255,0.08);
            }
            #emotion-color-swatch {
                width: 100%;
                height: 28px;
                border-radius: 6px;
                transition: background-color 0.5s;
            }
            .emo-bar-row {
                display: flex;
                align-items: center;
                gap: 6px;
                margin: 2px 0;
            }
            .emo-label {
                width: 60px;
                text-align: right;
                font-size: 11px;
                color: rgba(255,255,255,0.6);
            }
            .emo-bar-bg {
                flex: 1;
                height: 6px;
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
                overflow: hidden;
            }
            .emo-bar-fill {
                height: 100%;
                background: rgba(255,255,255,0.55);
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            .emo-pct {
                width: 40px;
                font-size: 11px;
                color: rgba(255,255,255,0.45);
            }
            #emotion-vad {
                font-size: 11px;
                color: rgba(255,255,255,0.4);
                letter-spacing: 0.5px;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }
}
