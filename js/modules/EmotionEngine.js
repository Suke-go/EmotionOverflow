import emotionConfig from "../data/emotion_config.json";

export default class EmotionEngine {
    constructor() {
        this.isReady = false;
        this.isLoading = false;
        this.lastError = null;
        this.modelType = "ekman";
        this.hfToken = null;
        this.apiUrls = [
            "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base",
            "https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base"
        ];
        this.activeApiUrl = null;

        // Current emotion state (Ekman confidence vector)
        this.emotions = {
            joy: 0, anger: 0, sadness: 0,
            fear: 0, surprise: 0, disgust: 0
        };

        // Current VAD values
        this.vad = { V: 0.5, A: 0.3, D: 0.5 };

        // Current color (RGB 0-1)
        this.emotionColor = { r: 1, g: 1, b: 1 };

        // Smoothed parameter targets
        this.targets = {};
        this.currentParams = {};

        // Active preset
        this.presetName = "universal";
        this.config = emotionConfig;
        this.smoothing = this.config.smoothing || 0.05;
    }

    async init() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.needsToken = false;
        this.lastError = null;

        try {
            // Get HF token from global or localStorage (no prompt – breaks on iPad)
            this.hfToken = window.HF_TOKEN || localStorage.getItem("hf_token");

            if (!this.hfToken) {
                this.needsToken = true;
                this.isLoading = false;
                return; // UI will show token input form
            }

            await this._warmup();
        } catch (e) {
            this.lastError = e.message || String(e);
            console.error("[EmotionEngine] Init failed:", e);
            this.isReady = false;
        }

        this.isLoading = false;
    }

    clearToken() {
        localStorage.removeItem("hf_token");
        this.hfToken = null;
        this.isReady = false;
        this.needsToken = true;
        this.lastError = null;
    }

    async setToken(token) {
        if (!token || !token.trim()) return false;
        this.hfToken = token.trim();
        localStorage.setItem("hf_token", this.hfToken);
        this.needsToken = false;
        this.isLoading = true;

        try {
            await this._warmup();
        } catch (e) {
            this.lastError = e.message || String(e);
            console.error("[EmotionEngine] Token verification failed:", e);
            this.isReady = false;
        }

        this.isLoading = false;
        return this.isReady;
    }

    async _warmup() {
        console.log("[EmotionEngine] Warming up HF Inference API...");

        // Try each URL until one works
        for (var i = 0; i < this.apiUrls.length; i++) {
            var url = this.apiUrls[i];
            console.log("[EmotionEngine] Trying: " + url);
            try {
                var test = await this._fetchApi(url, "hello");
                if (test) {
                    this.activeApiUrl = url;
                    this.isReady = true;
                    console.log("[EmotionEngine] Ready via: " + url);
                    return;
                }
            } catch (e) {
                console.warn("[EmotionEngine] URL failed: " + url + " - " + e.message);
            }
        }

        throw new Error("All API endpoints failed. Possible CORS or network issue on this device.");
    }

    async _apiCall(text) {
        if (!this.activeApiUrl) {
            throw new Error("No active API URL");
        }
        return this._fetchApi(this.activeApiUrl, text);
    }

    async _fetchApi(url, text) {
        var res;
        try {
            res = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + this.hfToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inputs: text })
            });
        } catch (networkErr) {
            // fetch throws TypeError on CORS block or network failure
            throw new Error("Network/CORS error: " + (networkErr.message || networkErr));
        }

        if (!res.ok) {
            var err = await res.text();
            if (res.status === 503) {
                console.log("[EmotionEngine] Model loading on server, retrying in 5s...");
                await new Promise(function(r) { setTimeout(r, 5000); });
                return this._fetchApi(url, text);
            }
            throw new Error("API " + res.status + ": " + err);
        }

        var data = await res.json();
        // API returns [[{label, score}, ...]]
        return Array.isArray(data[0]) ? data[0] : data;
    }

    getPreset() {
        return this.config.presets[this.presetName];
    }

    setPreset(name) {
        if (this.config.presets[name]) {
            this.presetName = name;
        }
    }

    /**
     * Classify a short sentence and update emotion state
     */
    async classify(text) {
        if (!this.isReady || !text.trim()) return null;

        try {
            var results = await this._apiCall(text);

            // Reset
            for (var key in this.emotions) {
                this.emotions[key] = 0;
            }

            // Hartmann model returns: anger, disgust, fear, joy, neutral, sadness, surprise
            for (var i = 0; i < results.length; i++) {
                var label = results[i].label.toLowerCase();
                if (label in this.emotions) {
                    this.emotions[label] = results[i].score;
                }
                // Skip 'neutral'
            }

            // Compute VAD from Ekman confidences
            this._computeVAD();

            // Compute color from preset + VAD
            this._computeColor();

            // Compute fluid parameter targets
            this._computeParameterTargets();

            return {
                emotions: Object.assign({}, this.emotions),
                vad: Object.assign({}, this.vad),
                color: Object.assign({}, this.emotionColor)
            };
        } catch (e) {
            console.error("[EmotionEngine] Classification error:", e);
            return null;
        }
    }

    _computeVAD() {
        var emotions = this.getPreset().emotions;
        var V = 0, A = 0, D = 0, totalWeight = 0;

        for (var emo in this.emotions) {
            var conf = this.emotions[emo];
            if (emotions[emo] && conf > 0) {
                V += conf * emotions[emo].V;
                A += conf * emotions[emo].A;
                D += conf * emotions[emo].D;
                totalWeight += conf;
            }
        }

        if (totalWeight > 0) {
            this.vad.V = V / totalWeight;
            this.vad.A = A / totalWeight;
            this.vad.D = D / totalWeight;
        } else {
            this.vad.V = 0.5;
            this.vad.A = 0.3;
            this.vad.D = 0.5;
        }
    }

    _computeColor() {
        var emotions = this.getPreset().emotions;
        var hslMap = this.config.hslMapping;
        var temperature = this.config.colorTemperature || 0.3;

        // Collect emotion entries with scores > 0
        var entries = [];
        for (var emo in this.emotions) {
            if (emotions[emo] && this.emotions[emo] > 0.01) {
                entries.push({ name: emo, conf: this.emotions[emo], hue: emotions[emo].hue });
            }
        }

        var hue = 0;
        if (entries.length > 0) {
            // Softmax sharpening with temperature
            var maxConf = -Infinity;
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].conf > maxConf) maxConf = entries[i].conf;
            }
            var expSum = 0;
            for (var i = 0; i < entries.length; i++) {
                entries[i].sharpened = Math.exp((entries[i].conf - maxConf) / temperature);
                expSum += entries[i].sharpened;
            }
            for (var i = 0; i < entries.length; i++) {
                entries[i].sharpened /= expSum;
            }

            // Sort by sharpened weight descending
            entries.sort(function(a, b) { return b.sharpened - a.sharpened; });

            // Dominant emotion hue
            hue = entries[0].hue;

            // Blend with 2nd emotion only if it has meaningful weight (>0.15)
            if (entries.length > 1 && entries[1].sharpened > 0.15) {
                var blend = entries[1].sharpened / (entries[0].sharpened + entries[1].sharpened);
                // Lerp hue on the shorter arc
                var h1 = entries[0].hue;
                var h2 = entries[1].hue;
                var diff = h2 - h1;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                hue = h1 + diff * blend;
                if (hue < 0) hue += 360;
                if (hue >= 360) hue -= 360;
            }
        }

        var S = this._lerp(hslMap.saturation.min, hslMap.saturation.max, this.vad.A);
        var L = this._lerp(hslMap.lightness.min, hslMap.lightness.max, this.vad.V);

        var rgb = this._hslToRgb(hue / 360, S, L);
        this.emotionColor.r = rgb[0];
        this.emotionColor.g = rgb[1];
        this.emotionColor.b = rgb[2];
    }

    _computeParameterTargets() {
        var mapping = this.config.parameterMapping;

        for (var param in mapping) {
            var map = mapping[param];
            if (map.threshold !== undefined) {
                var val = this.vad[map.dimension];
                this.targets[param] = map.below ? val < map.threshold : val >= map.threshold;
            } else {
                var v = this.vad[map.dimension];
                if (map.invert) v = 1 - v;
                var result = this._lerp(map.min, map.max, v);

                // ValenceScale: further scale down by valence (negative emotion = weaker)
                if (map.valenceScale) {
                    result *= this._lerp(0.3, 1.0, this.vad.V);
                }

                this.targets[param] = result;
            }
        }
    }

    applyToSimulation(options) {
        for (var param in this.targets) {
            var target = this.targets[param];
            if (typeof target === "boolean") {
                options[param] = target;
            } else {
                if (this.currentParams[param] === undefined) {
                    this.currentParams[param] = options[param] || target;
                }
                this.currentParams[param] += (target - this.currentParams[param]) * this.smoothing;
                options[param] = this.currentParams[param];
            }
        }
    }

    _lerp(a, b, t) {
        return a + (b - a) * Math.max(0, Math.min(1, t));
    }

    _hslToRgb(h, s, l) {
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            var hue2rgb = function(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [r, g, b];
    }
}
