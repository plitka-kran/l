!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
        API_URL: 'https://api.introdb.app',
        THEINTRODB_URL: 'https://api.theintrodb.org/v2/media',
        CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
        DETECTION_TIMEOUT: 5000,
        INTRO_MAX_START: 150,
        INTRO_MAX_END: 300,
        CREDITS_MIN_GAP: 30,
        MIN_SUBTITLES: 5,
        AUTO_SKIP_DELAY: 4000,
        AUDIO_SAMPLE_INTERVAL: 500,
        AUDIO_MAX_TIME: 420,
        AUDIO_MIN_SAMPLES: 20,
        ENERGY_THRESHOLD_MULTIPLIER: 1.3,
        ENERGY_MIN_THRESHOLD: 0.8,
        MIN_ENERGY_PEAK_DURATION: 15,
        MAX_ENERGY_PEAK_DURATION: 150,
        MIN_ENERGY_SAMPLES: 10,
        NOTIFICATION_DURATION: 3000
    };

    // ===== УТИЛИТЫ =====
    const Utils = {
        _storageCache: {},
        
        getStorage(key, def) {
            try {
                if (this._storageCache[key] !== undefined) {
                    return this._storageCache[key];
                }
                const val = Lampa.Storage.get(key, def);
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        const parsed = JSON.parse(val);
                        this._storageCache[key] = parsed;
                        return parsed;
                    } catch(e) {}
                }
                this._storageCache[key] = val;
                return val;
            } catch(e) {
                return def;
            }
        },

        setStorage(key, val) {
            try {
                this._storageCache[key] = val;
                Lampa.Storage.set(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch(e) {}
        },

        throttle(fn, delay) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    fn.apply(this, args);
                }
            };
        },

        isNumeric(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        },

        findSegment(segments, time) {
            for (let i = 0, len = segments.length; i < len; i++) {
                const seg = segments[i];
                if (time >= seg.start && time < seg.end) return seg;
                if (seg.start > time) break;
            }
            return null;
        },

        parseSeasonEpisode(text) {
            if (!text || typeof text !== 'string') return null;

            let match = text.match(/[Ss](\d+)\s*[Ee](\d+)/);
            if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };

            match = text.match(/(\d+)\s*[xX]\s*(\d+)/);
            if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };

            match = text.match(/(?:сезон)?\s*(\d+)\s*(?:сезон\w*|серии\w*)?\s*(?:серия|эпизод)?\s*(\d+)\s*(?:сери\w*|эпизод\w*)?/i);
            if (match && match[1] && match[2]) {
                return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
            }

            match = text.match(/(?:ep|episode|серия|эпизод)\s*(\d+)/i);
            if (match) return { season: 1, episode: parseInt(match[1], 10) };

            return null;
        }
    };

    // ===== УПРАВЛЕНИЕ ПЛАГИНОМ =====
    const PluginSettings = {
        isEnabled() {
            return Utils.getStorage('skip_intro_enabled', true) !== false;
        },

        isAutoSkip() {
            return Utils.getStorage('skip_intro_auto', true) !== false;
        },

        isDetectEnabled() {
            return Utils.getStorage('skip_intro_detect', true) !== false;
        },

        isTypeEnabled(type) {
            return Utils.getStorage(`skip_intro_type_${type}`, true) !== false;
        },

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            const params = [
                { name: 'skip_intro_enabled', type: 'trigger', default: true, label: 'Включить плагин', desc: 'Показывать уведомления о пропуске' },
                { name: 'skip_intro_auto', type: 'trigger', default: true, label: 'Автопропуск', desc: 'Автоматически пропускать заставки' },
                { name: 'skip_intro_detect', type: 'trigger', default: true, label: 'Умное обнаружение', desc: 'Определять по субтитрам и звуку' },
                { name: 'skip_intro_type_intro', type: 'trigger', default: true, label: 'Пропускать заставку (intro)' },
                { name: 'skip_intro_type_recap', type: 'trigger', default: true, label: 'Пропускать рекап (recap)' },
                { name: 'skip_intro_type_credits', type: 'trigger', default: true, label: 'Пропускать титры (credits)' },
                { name: 'skip_intro_type_preview', type: 'trigger', default: false, label: 'Пропускать превью (preview)' }
            ];

            params.forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.name, type: p.type, default: p.default },
                    field: { name: p.label, description: p.desc || '' }
                });
            });
        }
    };

    // ===== КЭШИРОВАНИЕ =====
    const Cache = {
        _storageKey: 'skip_intro_cache',
        _data: null,

        _load() {
            if (this._data) return this._data;
            try {
                const raw = Lampa.Storage.get(this._storageKey, '{}');
                this._data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return this._data || {};
            } catch(e) {
                this._data = {};
                return this._data;
            }
        },

        _save() {
            try {
                Lampa.Storage.set(this._storageKey, JSON.stringify(this._data || {}));
            } catch(e) {}
        },

        get(tmdbId, season, episode) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            const entry = data[key];
            if (entry && entry._ts && Date.now() - entry._ts < CONFIG.CACHE_TTL) {
                return entry.segments || null;
            }
            if (entry) {
                delete data[key];
                this._save();
            }
            return null;
        },

        set(tmdbId, season, episode, segments) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            data[key] = {
                segments: segments,
                _ts: Date.now()
            };
            this._save();
        },

        clear() {
            this._data = {};
            this._save();
        }
    };

    // ===== ВИЗУАЛЬНАЯ РАЗМЕТКА ПРОГРЕСС-БАРА =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markers: [],

        init() {
            this._findProgressBar();
        },

        _findProgressBar() {
            const selectors = [
                '.player-progress', '.video-progress', '.progress-bar', '.progress', 
                '.seek-bar', '.timeline', '.player-timeline', '[class*="progress"]', '[class*="timeline"]'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    this._container = el;
                    break;
                }
            }

            if (!this._container) {
                try {
                    const player = document.querySelector('.player');
                    if (player) {
                        const progress = player.querySelector('[class*="progress"]') || 
                                       player.querySelector('[class*="timeline"]');
                        if (progress) this._container = progress;
                    }
                } catch(e) {}
            }

            if (!this._container) return;

            let markersContainer = this._container.querySelector('.skip-intro-markers');
            if (!markersContainer) {
                markersContainer = document.createElement('div');
                markersContainer.className = 'skip-intro-markers';
                markersContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 10;
                    overflow: visible;
                `;
                this._container.style.position = 'relative';
                this._container.appendChild(markersContainer);
            }
            this._markersContainer = markersContainer;
            
            this._injectStyles();
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-marker-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-marker-styles';
            style.textContent = `
                .skip-intro-marker {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 70%;
                    border-radius: 3px;
                    transition: all 0.3s ease;
                    pointer-events: none;
                    min-width: 4px;
                    opacity: 0.6;
                    z-index: 5;
                }
                .skip-intro-marker-intro {
                    background: linear-gradient(180deg, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.3));
                    border: 1px solid rgba(76, 175, 80, 0.5);
                }
                .skip-intro-marker-recap {
                    background: linear-gradient(180deg, rgba(255, 152, 0, 0.8), rgba(255, 152, 0, 0.3));
                    border: 1px solid rgba(255, 152, 0, 0.5);
                }
                .skip-intro-marker-credits {
                    background: linear-gradient(180deg, rgba(33, 150, 243, 0.8), rgba(33, 150, 243, 0.3));
                    border: 1px solid rgba(33, 150, 243, 0.5);
                }
                .skip-intro-marker-preview {
                    background: linear-gradient(180deg, rgba(156, 39, 176, 0.8), rgba(156, 39, 176, 0.3));
                    border: 1px solid rgba(156, 39, 176, 0.5);
                }
                .skip-intro-marker.active {
                    opacity: 0.9 !important;
                    height: 100% !important;
                    animation: skip-intro-pulse 1s ease-in-out infinite;
                    box-shadow: 0 0 20px rgba(255,255,255,0.2);
                }
                @keyframes skip-intro-pulse {
                    0%, 100% { opacity: 0.6; transform: translateY(-50%) scaleY(1); }
                    50% { opacity: 1; transform: translateY(-50%) scaleY(1.2); }
                }
            `;
            document.head.appendChild(style);
        },

        clear() {
            if (this._markersContainer) {
                this._markersContainer.innerHTML = '';
            }
            this._markers = [];
        },

        addMarker(start, end, type, duration) {
            if (!this._markersContainer || !duration || !this._container) return;
            
            const startPercent = (start / duration) * 100;
            const endPercent = (end / duration) * 100;
            const width = Math.max(endPercent - startPercent, 0.5);
            
            if (width <= 0 || startPercent > 100) return;
            
            const marker = document.createElement('div');
            marker.className = `skip-intro-marker skip-intro-marker-${type}`;
            marker.style.cssText = `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                left: ${Math.min(startPercent, 99)}%;
                width: ${Math.min(width, 100 - startPercent)}%;
                height: 70%;
                border-radius: 3px;
                transition: all 0.3s ease;
                pointer-events: none;
                min-width: 4px;
                opacity: 0.6;
                z-index: 5;
            `;
            
            this._markersContainer.appendChild(marker);
            this._markers.push({ start, end, type, element: marker });
        },

        updateMarkers(segments, duration) {
            this.clear();
            if (!segments || !segments.length || !duration) return;
            
            if (!this._container || !this._markersContainer) {
                this._findProgressBar();
                if (!this._markersContainer) return;
            }
            
            const sorted = [...segments].sort((a, b) => a.start - b.start);
            sorted.forEach(seg => {
                this.addMarker(seg.start, seg.end, seg.type, duration);
            });
        },

        highlightActive(segment) {
            if (!this._markersContainer) return;
            
            const markers = this._markersContainer.querySelectorAll('.skip-intro-marker');
            markers.forEach((marker) => {
                const data = this._markers.find(m => m.element === marker);
                if (data && segment && data.type === segment.type && 
                    Math.abs(data.start - segment.start) < 2 && Math.abs(data.end - segment.end) < 2) {
                    marker.classList.add('active');
                } else {
                    marker.classList.remove('active');
                }
            });
        },

        resetHighlights() {
            const markers = this._markersContainer?.querySelectorAll('.skip-intro-marker') || [];
            markers.forEach(m => m.classList.remove('active'));
        },

        destroy() {
            this.clear();
            this._container = null;
            this._markersContainer = null;
        }
    };

    // ===== УВЕДОМЛЕНИЕ ПО ЦЕНТРУ ВВЕРХУ =====
    const Notification = {
        _element: null,
        _timer: null,

        _injectStyles() {
            if (document.getElementById('skip-intro-notification-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-notification-styles';
            style.textContent = `
                .skip-intro-notification {
                    position: fixed;
                    top: 30px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-20px);
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: #fff;
                    padding: 16px 40px;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: 500;
                    z-index: 99999;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                    text-align: center;
                    min-width: 200px;
                    max-width: 80vw;
                    letter-spacing: 0.3px;
                }
                .skip-intro-notification.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                .skip-intro-notification .icon {
                    display: inline-block;
                    margin-right: 12px;
                    font-size: 22px;
                }
                .skip-intro-notification .label {
                    display: inline-block;
                }
                .skip-intro-notification .badge {
                    display: inline-block;
                    margin-left: 10px;
                    font-size: 13px;
                    opacity: 0.6;
                }
                @media (max-width: 720px) {
                    .skip-intro-notification {
                        top: 20px;
                        padding: 12px 24px;
                        font-size: 15px;
                        min-width: 150px;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        show(text, badge) {
            this._injectStyles();
            this.hide();

            const el = document.createElement('div');
            el.className = 'skip-intro-notification';
            
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = '⏭';
            el.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = text;
            el.appendChild(label);

            if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'badge';
                badgeEl.textContent = badge;
                el.appendChild(badgeEl);
            }

            document.body.appendChild(el);
            this._element = el;

            requestAnimationFrame(() => {
                el.classList.add('show');
            });

            this._timer = setTimeout(() => {
                this.hide();
            }, CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = null;
            }
            if (this._element) {
                this._element.classList.remove('show');
                setTimeout(() => {
                    if (this._element && this._element.parentNode) {
                        this._element.parentNode.removeChild(this._element);
                    }
                    this._element = null;
                }, 400);
            }
        },

        destroy() {
            this.hide();
        }
    };

    // ===== ДЕТЕКЦИЯ ПО СУБТИТРАМ =====
    const SubtitleDetector = {
        detect(video, duration) {
            return new Promise((resolve) => {
                try {
                    if (video.textTracks && video.textTracks.length) {
                        for (let i = 0; i < video.textTracks.length; i++) {
                            const track = video.textTracks[i];
                            if (track.cues && track.cues.length > CONFIG.MIN_SUBTITLES) {
                                const segments = this._analyzeCues(track.cues, duration);
                                if (segments.length) {
                                    resolve(segments);
                                    return;
                                }
                            }
                        }
                    }

                    const subs = Lampa.PlayerVideo && Lampa.PlayerVideo.subtitles ? 
                        Lampa.PlayerVideo.subtitles() : null;
                    if (subs && subs.length) {
                        for (let i = 0; i < subs.length; i++) {
                            if (subs[i].url) {
                                this._fetchSubtitle(subs[i].url, duration)
                                    .then(segments => resolve(segments))
                                    .catch(() => resolve([]));
                                return;
                            }
                        }
                    }
                    resolve([]);
                } catch(e) {
                    resolve([]);
                }
            });
        },

        _fetchSubtitle(url, duration) {
            return new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = CONFIG.DETECTION_TIMEOUT;
                xhr.ontimeout = () => resolve([]);
                xhr.onerror = () => resolve([]);
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                        const segments = this._parseSrt(xhr.responseText, duration);
                        resolve(segments);
                    } else {
                        resolve([]);
                    }
                };
                xhr.send();
            });
        },

        _parseSrt(text, duration) {
            const cues = [];
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const timeMatch = line.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
                if (timeMatch) {
                    const start = this._parseTime(timeMatch[1]);
                    const end = this._parseTime(timeMatch[2]);
                    if (end > start) {
                        cues.push({ start, end });
                    }
                }
            }

            return this._analyzeCues(cues, duration);
        },

        _parseTime(str) {
            const parts = str.match(/(\d+):(\d{2}):(\d{2})[.,](\d{3})/);
            if (!parts) return 0;
            return parseInt(parts[1]) * 3600 + 
                   parseInt(parts[2]) * 60 + 
                   parseInt(parts[3]) + 
                   parseInt(parts[4]) / 1000;
        },

        _analyzeCues(cues, duration) {
            if (cues.length < CONFIG.MIN_SUBTITLES) return [];

            cues.sort((a, b) => a.start - b.start);
            const segments = [];
            
            if (cues[0].start >= 15 && cues[0].start <= CONFIG.INTRO_MAX_START) {
                segments.push({
                    type: 'intro',
                    start: 0,
                    end: Math.round(cues[0].start),
                    _source: 'subs'
                });
            }

            let maxGap = 0;
            let introStart = 0;
            let introEnd = 0;
            
            for (let i = 0; i < cues.length - 1 && cues[i].end < CONFIG.INTRO_MAX_END; i++) {
                const gap = cues[i + 1].start - cues[i].end;
                if (gap >= 15 && gap <= CONFIG.INTRO_MAX_END && gap > maxGap) {
                    maxGap = gap;
                    introStart = Math.round(cues[i].end);
                    introEnd = Math.round(cues[i + 1].start);
                }
            }

            if (introStart && introEnd) {
                segments.push({
                    type: 'intro',
                    start: introStart,
                    end: introEnd,
                    _source: 'subs'
                });
            }

            if (duration > 600 && cues.length > 0) {
                const lastCue = cues[cues.length - 1];
                const gap = duration - lastCue.end;
                
                if (gap >= CONFIG.CREDITS_MIN_GAP) {
                    segments.push({
                        type: 'credits',
                        start: Math.round(lastCue.end),
                        end: Math.round(duration),
                        _source: 'subs'
                    });
                }
            }

            return segments;
        }
    };

    // ===== ДЕТЕКЦИЯ ПО ЗВУКУ =====
    const AudioDetector = {
        _context: null,
        _analyser: null,
        _source: null,
        _connected: false,
        _timer: null,
        _timeout: null,

        detect(video) {
            return new Promise((resolve) => {
                this._cleanup();

                try {
                    if (!window.AudioContext && !window.webkitAudioContext) {
                        resolve(null);
                        return;
                    }

                    if (!this._context || this._context.state === 'closed') {
                        this._context = new (window.AudioContext || window.webkitAudioContext)();
                    }

                    if (!this._connected || !this._analyser) {
                        this._source = this._context.createMediaElementSource(video);
                        this._analyser = this._context.createAnalyser();
                        this._analyser.fftSize = 1024;
                        this._source.connect(this._analyser);
                        this._analyser.connect(this._context.destination);
                        this._connected = true;
                    }

                    if (!this._analyser) {
                        resolve(null);
                        return;
                    }

                    const samples = [];
                    const data = new Uint8Array(this._analyser.frequencyBinCount);
                    const startTime = video.currentTime;

                    this._timer = setInterval(() => {
                        try {
                            const currentTime = video.currentTime;
                            if (currentTime - startTime > CONFIG.AUDIO_MAX_TIME) {
                                this._cleanup();
                                resolve(this._analyze(samples));
                                return;
                            }

                            this._analyser.getByteFrequencyData(data);
                            let sum = 0;
                            for (let i = 0; i < data.length; i++) {
                                sum += data[i];
                            }
                            samples.push({
                                time: currentTime,
                                energy: sum / data.length
                            });
                        } catch(e) {
                            this._cleanup();
                            resolve(null);
                        }
                    }, CONFIG.AUDIO_SAMPLE_INTERVAL);

                    this._timeout = setTimeout(() => {
                        this._cleanup();
                        resolve(this._analyze(samples));
                    }, CONFIG.AUDIO_MAX_TIME * 1000);

                } catch(e) {
                    this._cleanup();
                    resolve(null);
                }
            });
        },

        _analyze(samples) {
            if (samples.length < CONFIG.AUDIO_MIN_SAMPLES) return null;

            const smoothed = [];
            for (let i = 2; i < samples.length - 2; i++) {
                const avg = (samples[i-2].energy + samples[i-1].energy + samples[i].energy + 
                            samples[i+1].energy + samples[i+2].energy) / 5;
                smoothed.push({
                    time: samples[i].time,
                    energy: avg
                });
            }

            if (smoothed.length < CONFIG.MIN_ENERGY_SAMPLES) return null;

            const energies = smoothed.map(s => s.energy).sort((a, b) => a - b);
            const median = energies[Math.floor(energies.length / 2)];
            const threshold = median * CONFIG.ENERGY_THRESHOLD_MULTIPLIER;
            const minThreshold = median * CONFIG.ENERGY_MIN_THRESHOLD;

            let peakStart = null;
            let peakCount = 0;
            let peakEnd = null;

            for (let i = 0; i < smoothed.length; i++) {
                const sample = smoothed[i];
                if (sample.time > CONFIG.INTRO_MAX_END) break;

                if (sample.energy > threshold) {
                    if (!peakStart) {
                        peakStart = sample.time;
                        peakCount = 1;
                    } else {
                        peakCount++;
                    }
                } else if (peakStart && sample.energy < minThreshold) {
                    const duration = sample.time - peakStart;
                    if (duration >= CONFIG.MIN_ENERGY_PEAK_DURATION && 
                        duration <= CONFIG.MAX_ENERGY_PEAK_DURATION && 
                        peakCount >= CONFIG.MIN_ENERGY_SAMPLES) {
                        peakEnd = sample.time;
                        break;
                    }
                    peakStart = null;
                    peakCount = 0;
                }
            }

            if (peakStart && peakEnd) {
                return {
                    type: 'intro',
                    start: Math.round(peakStart),
                    end: Math.round(peakEnd),
                    _source: 'audio'
                };
            }

            return null;
        },

        _cleanup() {
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
            }
        },

        destroy() {
            this._cleanup();
            try {
                if (this._source) {
                    this._source.disconnect();
                    this._source = null;
                }
                if (this._analyser) {
                    this._analyser.disconnect();
                    this._analyser = null;
                }
                if (this._context && this._context.state !== 'closed') {
                    this._context.close();
                    this._context = null;
                }
                this._connected = false;
            } catch(e) {}
        }
    };

    // ===== API ЗАПРОСЫ =====
    const ApiClient = {
        _fetch(url, timeout) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                let completed = false;

                const timer = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        xhr.abort();
                        reject(new Error('timeout'));
                    }
                }, timeout || CONFIG.DETECTION_TIMEOUT);

                xhr.open('GET', url, true);
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (completed) return;
                        completed = true;
                        clearTimeout(timer);
                        
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch(e) {
                                reject(e);
                            }
                        } else if (xhr.status === 204 || xhr.status === 404) {
                            resolve(null);
                        } else {
                            reject(new Error(`HTTP ${xhr.status}`));
                        }
                    }
                };
                xhr.onerror = () => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timer);
                        reject(new Error('network'));
                    }
                };
                xhr.send();
            });
        },

        async load(tmdbId, imdbId, season, episode) {
            const cached = Cache.get(tmdbId, season, episode);
            if (cached) return cached;

            try {
                const url = `${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                const segments = this._parseTheIntroDB(data);
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    return segments;
                }
            } catch(e) {}

            try {
                const url1 = `${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const url2 = `${CONFIG.API_URL}/get_credits?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const [intro, credits] = await Promise.all([
                    this._fetch(url1).catch(() => null),
                    this._fetch(url2).catch(() => null)
                ]);
                
                const segments = [];
                if (intro && intro.start && intro.end) {
                    segments.push({
                        type: 'intro',
                        start: Math.round(intro.start),
                        end: Math.round(intro.end)
                    });
                }
                if (credits && credits.start && credits.end) {
                    segments.push({
                        type: 'credits',
                        start: Math.round(credits.start),
                        end: Math.round(credits.end)
                    });
                }
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    return segments;
                }
            } catch(e) {}

            if (imdbId) {
                try {
                    const url = `https://introhater.com/api/segments/${imdbId}:${season}:${episode}`;
                    const data = await this._fetch(url);
                    const segments = this._parseIntroHater(data);
                    if (segments.length) {
                        Cache.set(tmdbId, season, episode, segments);
                        return segments;
                    }
                } catch(e) {}
            }

            return [];
        },

        _parseTheIntroDB(data) {
            const segments = [];
            if (!data) return segments;
            
            const types = ['intro', 'recap', 'credits', 'preview'];
            types.forEach(type => {
                const items = data[type];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const start = item.start_ms ? item.start_ms / 1000 : (item.start || 0);
                        const end = item.end_ms ? item.end_ms / 1000 : (item.end || 0);
                        if (end > start) {
                            segments.push({ type, start, end });
                        }
                    });
                }
            });
            return segments;
        },

        _parseIntroHater(data) {
            const segments = [];
            if (!Array.isArray(data)) return segments;
            
            data.forEach(item => {
                if (item.start != null && item.end != null && item.end > item.start) {
                    let type = 'intro';
                    const label = (item.label || '').toLowerCase();
                    if (label.includes('credit') || label === 'ed') type = 'credits';
                    else if (label.includes('recap')) type = 'recap';
                    else if (label.includes('preview')) type = 'preview';
                    
                    segments.push({
                        type,
                        start: Math.round(item.start),
                        end: Math.round(item.end)
                    });
                }
            });
            return segments;
        }
    };

    // ===== ОСНОВНОЙ КЛАСС =====
    const SkipIntroPlugin = {
        _segments: [],
        _rawSegments: [], // Храним чистые сегменты из API до калибровки под онлайн-поток
        _activeSegment: null,
        _lastSkipped: null,
        _currentData: null,
        _currentTmdb: null,
        _detecting: false,
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            PluginSettings.initSettings();
            ProgressMarker.init();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', 
                    Utils.throttle((data) => this._onTimeUpdate(data), 250)
                );
            }

            console.log('[SkipIntro] Plugin initialized globally with calibration');
        },

        _onStart(data) {
            this._cleanup();

            if (!PluginSettings.isEnabled()) return;

            const meta = this._extractMeta(data);
            
            console.log('[SkipIntro] Extracted meta:', meta);
            
            if (!meta.tmdb_id || !meta.is_series || meta.season == null || meta.episode == null) {
                console.log('[SkipIntro] Not a series or missing metadata');
                return;
            }

            this._currentData = data;
            this._currentTmdb = meta.tmdb_id;
            
            let apiDone = false;
            let detectDone = false;
            let apiSegments = [];
            let detectSegments = [];

            const mergeAndCalibrate = () => {
                if (!apiDone || !detectDone) return;
                if (this._currentData !== data) return;

                const merged = [...apiSegments];
                detectSegments.forEach(detSeg => {
                    let exists = false;
                    for (let i = 0; i < merged.length; i++) {
                        if (merged[i].type === detSeg.type) {
                            if (detSeg.start < merged[i].start) {
                                merged[i] = detSeg;
                            }
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) merged.push(detSeg);
                });

                this._rawSegments = merged;
                
                // Запускаем калибровку времени под конкретный онлайн-поток
                this._calibrateSegments();
            };

            ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._currentData === data) {
                        apiSegments = segments || [];
                        apiDone = true;
                        mergeAndCalibrate();
                    }
                })
                .catch(() => {
                    apiDone = true;
                    mergeAndCalibrate();
                });

            if (PluginSettings.isDetectEnabled()) {
                this._runDetection(data, meta, (segments) => {
                    if (this._currentData === data) {
                        detectSegments = segments || [];
                        detectDone = true;
                        mergeAndCalibrate();
                    }
                });
            } else {
                detectDone = true;
                mergeAndCalibrate();
            }
        },

        // Интеллектуальная калибровка таймингов под онлайн-плеер
        _calibrateSegments() {
            let video = null;
            try {
                video = Lampa.PlayerVideo.video();
            } catch(e) {}

            if (!video || !video.duration) {
                setTimeout(() => this._calibrateSegments(), 500);
                return;
            }

            const duration = video.duration;
            const calibrated = [];

            // Если у нас есть субтитры на странице, мы можем по ним найти точный сдвиг рекламы
            let timeOffset = 0;
            try {
                if (video.textTracks && video.textTracks.length) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        const track = video.textTracks[i];
                        if (track.cues && track.cues.length > 5) {
                            const firstCueStart = track.cues[0].startTime;
                            // Если первая реплика в сабах сдвинута больше чем на 5 секунд от старта
                            if (firstCueStart > 5 && firstCueStart < 180) {
                                timeOffset = firstCueStart; 
                            }
                            break;
                        }
                    }
                }
            } catch(e) {}

            this._rawSegments.forEach(seg => {
                let start = seg.start;
                let end = seg.end;

                // 1. Калибровка сдвига рекламы балансера (если обнаружен)
                if (timeOffset > 0 && seg.type === 'intro' && start === 0) {
                    end = end + timeOffset;
                } else if (timeOffset > 0) {
                    start = start + timeOffset;
                    end = end + timeOffset;
                }

                // 2. Мягкая коррекция пропорций (если онлайн-поток длиннее или короче из-за FPS)
                // Обычный хронометраж серии редко превышает 3600 сек (1 час)
                if (duration > 300 && Math.abs(duration - end) < 300 && seg.type === 'credits') {
                    // Сдвигаем титры ближе к реальному концу онлайн-файла
                    const diff = duration - end;
                    if (Math.abs(diff) > 5) {
                        start = Math.max(0, start + diff);
                        end = duration;
                    }
                }

                calibrated.push({
                    type: seg.type,
                    start: Math.round(start),
                    end: Math.round(end),
                    _original: seg
                });
            });

            this._segments = calibrated;
            this._updateProgressMarkers(calibrated);
            console.log('[SkipIntro] Segments calibrated:', calibrated);
        },

        _extractMeta(data) {
            const meta = {
                tmdb_id: null,
                imdb_id: null,
                season: null,
                episode: null,
                is_series: false
            };

            if (!data) return meta;

            if (data.tmdb_id) meta.tmdb_id = data.tmdb_id;
            if (data.imdb_id) meta.imdb_id = data.imdb_id;
            if (data.season != null) meta.season = parseInt(data.season, 10);
            if (data.episode != null) meta.episode = parseInt(data.episode, 10);

            let card = data.card || null;
            try {
                const activity = Lampa.Activity.active();
                if (activity) {
                    card = activity.card || activity.movie || null;
                }
            } catch(e) {}

            if (card) {
                if (!meta.tmdb_id) meta.tmdb_id = card.id || null;
                if (!meta.imdb_id) meta.imdb_id = card.imdb_id || null;
                if (card.name || card.title || card.number_of_seasons || card.first_air_date) {
                    meta.is_series = true;
                }
            }

            if (data.playlist && Array.isArray(data.playlist)) {
                const activeItem = data.playlist.find(item => item.active === true) || data.playlist[0];
                if (activeItem) {
                    const s = activeItem.season ?? activeItem.s ?? activeItem.season_num ?? activeItem.seasons;
                    const e = activeItem.episode ?? activeItem.e ?? activeItem.episode_num ?? activeItem.episodes;
                    
                    if (s != null && meta.season == null) meta.season = parseInt(s, 10);
                    if (e != null && meta.episode == null) meta.episode = parseInt(e, 10);

                    if ((meta.season == null || meta.episode == null) && activeItem.title) {
                        const parsed = Utils.parseSeasonEpisode(activeItem.title);
                        if (parsed) {
                            if (meta.season == null) meta.season = parsed.season;
                            if (meta.episode == null) meta.episode = parsed.episode;
                        }
                    }
                }
            }

            if (meta.season == null || meta.episode == null) {
                const fieldsToParse = [
                    data.title,
                    data.file ? data.file.title : null,
                    data.video ? data.video.title : null,
                    data.url
                ];

                for (const field of fieldsToParse) {
                    if (field) {
                        const parsed = Utils.parseSeasonEpisode(field);
                        if (parsed) {
                            if (meta.season == null) meta.season = parsed.season;
                            if (meta.episode == null) meta.episode = parsed.episode;
                            break;
                        }
                    }
                }
            }

            if (!meta.tmdb_id) {
                try {
                    const keys = ['online_view_id', 'current_movie_id', 'player_movie_id'];
                    for (const key of keys) {
                        const id = Lampa.Storage.get(key);
                        if (id) {
                            meta.tmdb_id = id;
                            break;
                        }
                    }
                    
                    const opened = Lampa.Storage.get('current', null);
                    if (opened && opened.id) {
                        meta.tmdb_id = opened.id;
                    }
                } catch(e) {}
            }

            if (meta.tmdb_id && meta.season != null && meta.episode != null) {
                meta.is_series = true;
            }

            return meta;
        },

        _runDetection(data, meta, callback) {
            if (this._detecting) return;
            this._detecting = true;

            const cached = Cache.get(meta.tmdb_id, meta.season, meta.episode);
            if (cached && cached.length) {
                this._detecting = false;
                callback(cached);
                return;
            }

            let video = null;
            try {
                video = Lampa.PlayerVideo.video();
            } catch(e) {}

            if (!video || !video.duration) {
                let attempts = 0;
                const checkVideo = () => {
                    attempts++;
                    try {
                        video = Lampa.PlayerVideo.video();
                    } catch(e) {}
                    
                    if (video && video.duration) {
                        this._runDetectionInternal(video, meta, callback);
                    } else if (attempts < 20) {
                        setTimeout(checkVideo, 500);
                    } else {
                        this._detecting = false;
                        callback([]);
                    }
                };
                checkVideo();
            } else {
                this._runDetectionInternal(video, meta, callback);
            }
        },

        _runDetectionInternal(video, meta, callback) {
            const duration = video.duration;
            
            SubtitleDetector.detect(video, duration)
                .then(subSegments => {
                    if (subSegments && subSegments.length) {
                        Cache.set(meta.tmdb_id, meta.season, meta.episode, subSegments);
                        this._detecting = false;
                        callback(subSegments);
                        return;
                    }

                    AudioDetector.detect(video)
                        .then(audioSegment => {
                            this._detecting = false;
                            if (audioSegment) {
                                const segments = [audioSegment];
                                Cache.set(meta.tmdb_id, meta.season, meta.episode, segments);
                                callback(segments);
                            } else {
                                callback([]);
                            }
                        })
                        .catch(() => {
                            this._detecting = false;
                            callback([]);
                        });
                })
                .catch(() => {
                    this._detecting = false;
                    callback([]);
                });
        },

        _updateProgressMarkers(segments) {
            let duration = 0;
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) duration = video.duration;
            } catch(e) {}
            
            if (duration > 0 && segments && segments.length) {
                ProgressMarker.updateMarkers(segments, duration);
                return;
            }
            
            if (!duration) {
                let attempts = 0;
                const checkDuration = () => {
                    attempts++;
                    try {
                        const video = Lampa.PlayerVideo.video();
                        if (video && video.duration) {
                            ProgressMarker.updateMarkers(segments, video.duration);
                        } else if (attempts < 20) {
                            setTimeout(checkDuration, 500);
                        }
                    } catch(e) {
                        if (attempts < 20) setTimeout(checkDuration, 500);
                    }
                };
                checkDuration();
            }
        },

        _onTimeUpdate(data) {
            if (!PluginSettings.isEnabled() || !this._segments.length) return;
            
            // Защита для HLS-балансеров: если Lampa шлет кривой timeupdate, берем время прямо из инстанса video
            let current = data.current;
            try {
                const nativeVideo = Lampa.PlayerVideo.video();
                if (nativeVideo && Utils.isNumeric(nativeVideo.currentTime)) {
                    current = nativeVideo.currentTime;
                }
            } catch(e) {}

            if (!Utils.isNumeric(current)) return;
            
            const segment = Utils.findSegment(this._segments, current);
            
            if (segment) {
                ProgressMarker.highlightActive(segment);
            } else {
                ProgressMarker.resetHighlights();
            }
            
            if (segment) {
                if (!PluginSettings.isTypeEnabled(segment.type)) {
                    if (this._activeSegment) this._hideNotification();
                    return;
                }
                
                if (this._lastSkipped === segment) return;
                
                if (this._activeSegment !== segment) {
                    this._activeSegment = segment;
                    
                    if (PluginSettings.isAutoSkip()) {
                        this._doSkip(segment, true);
                        return;
                    }
                }
            } else if (this._activeSegment) {
                this._hideNotification();
            }
        },

        _hideNotification() {
            this._activeSegment = null;
            Notification.hide();
        },

        _doSkip(segment, auto) {
            this._lastSkipped = segment;
            this._activeSegment = null;
            
            const labels = {
                intro: 'Заставка',
                recap: 'Рекап',
                credits: 'Титры',
                preview: 'Превью'
            };
            
            const label = labels[segment.type] || segment.type;
            const time = Math.round(segment.end - segment.start);
            
            Notification.show(
                `⏭ ${label} пропущена`,
                `${time}с${auto ? ' ⚡' : ''}`
            );
            
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    const target = Math.min(segment.end, video.duration || segment.end);
                    video.currentTime = target;
                    console.log(`[SkipIntro] Skipped ${segment.type} to ${target}s${auto ? ' (auto)' : ''}`);
                    
                    setTimeout(() => {
                        try {
                            if (video.paused) video.play();
                        } catch(e) {}
                    }, 100);
                }
            } catch(e) {
                console.log('[SkipIntro] Error seeking:', e);
            }
        },

        _cleanup() {
            this._segments = [];
            this._rawSegments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            this._currentTmdb = null;
            this._detecting = false;
            Notification.destroy();
            AudioDetector.destroy();
        },

        _onDestroy() {
            this._cleanup();
            ProgressMarker.destroy();
        }
    };

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function initPlugin() {
        if (window.Lampa && Lampa.SettingsApi && Lampa.Player && Lampa.Storage) {
            SkipIntroPlugin.init();
        } else {
            setTimeout(initPlugin, 500);
        }
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', (data) => {
            if (data.type === 'ready') initPlugin();
        });
    }

    setTimeout(initPlugin, 1000);

}();
