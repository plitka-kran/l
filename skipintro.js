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
        MIN_ENERGY_SAMPLES: 10
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
        }
    };

    // ===== УПРАВЛЕНИЕ ПЛАГИНОМ =====
    const PluginSettings = {
        isEnabled() {
            return Utils.getStorage('skip_intro_enabled', true) !== false;
        },

        isAutoSkip() {
            return Utils.getStorage('skip_intro_auto', false) === true;
        },

        isDetectEnabled() {
            return Utils.getStorage('skip_intro_detect', true) !== false;
        },

        isTypeEnabled(type) {
            return Utils.getStorage(`skip_intro_type_${type}`, true) !== false;
        },

        getSkipKeys() {
            const key = Utils.getStorage('skip_intro_key_skip', 'enter');
            const map = {
                enter: [13, 29443, 65385],
                space: [32],
                red: [403],
                green: [404],
                yellow: [405],
                blue: [406]
            };
            return map[key] || map.enter;
        },

        getCancelKeys() {
            const key = Utils.getStorage('skip_intro_key_cancel', 'back');
            const map = {
                back: [8, 27, 10009, 461, 4],
                red: [403],
                green: [404],
                yellow: [405],
                blue: [406]
            };
            return map[key] || map.back;
        },

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            const params = [
                { name: 'skip_intro_enabled', type: 'trigger', default: true, label: 'Включить плагин', desc: 'Показывать кнопку пропуска заставок и титров' },
                { name: 'skip_intro_auto', type: 'trigger', default: false, label: 'Всегда автопропуск', desc: 'Всегда перематывать без кнопки' },
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

            Lampa.SettingsApi.addParam({
                component: 'skip_intro',
                param: {
                    name: 'skip_intro_key_skip',
                    type: 'select',
                    values: { enter: 'Enter / OK', space: 'Пробел', red: 'Красная (403)', green: 'Зелёная (404)', yellow: 'Жёлтая (405)', blue: 'Синяя (406)' },
                    default: 'enter'
                },
                field: { name: 'Кнопка «Пропустить»' }
            });

            Lampa.SettingsApi.addParam({
                component: 'skip_intro',
                param: {
                    name: 'skip_intro_key_cancel',
                    type: 'select',
                    values: { back: 'Назад', red: 'Красная (403)', green: 'Зелёная (404)', yellow: 'Жёлтая (405)', blue: 'Синяя (406)' },
                    default: 'back'
                },
                field: { name: 'Кнопка «Отменить»' }
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
        },

        _smartKey: 'skip_intro_smart',
        hasSkipped(tmdbId, type) {
            try {
                const data = Lampa.Storage.get(this._smartKey, '{}');
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                return parsed[`${tmdbId}_${type}`] === true;
            } catch(e) {
                return false;
            }
        },

        rememberSkip(tmdbId, type) {
            try {
                let data = Lampa.Storage.get(this._smartKey, '{}');
                data = typeof data === 'string' ? JSON.parse(data) : data;
                data[`${tmdbId}_${type}`] = true;
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        },

        forgetSkip(tmdbId, type) {
            try {
                let data = Lampa.Storage.get(this._smartKey, '{}');
                data = typeof data === 'string' ? JSON.parse(data) : data;
                delete data[`${tmdbId}_${type}`];
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        }
    };

    // ===== ВИЗУАЛЬНАЯ РАЗМЕТКА ПРОГРЕСС-БАРА =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markers: [],
        _colors: {
            intro: '#4CAF50',
            recap: '#FF9800',
            credits: '#2196F3',
            preview: '#9C27B0'
        },
        _typeNames: {
            intro: 'Заставка',
            recap: 'Рекап',
            credits: 'Титры',
            preview: 'Превью'
        },

        init() {
            this._container = document.querySelector('.player-progress, .video-progress, .progress-bar, [class*="progress"]');
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
                    z-index: 5;
                    overflow: hidden;
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
                    top: 0;
                    height: 100%;
                    border-radius: 2px;
                    transition: all 0.3s ease;
                    pointer-events: auto;
                    min-width: 3px;
                    cursor: pointer;
                }
                .skip-intro-marker:hover {
                    opacity: 0.8 !important;
                    transform: scaleY(1.5) !important;
                    z-index: 10;
                }
                .skip-intro-marker-intro {
                    background: linear-gradient(90deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.6));
                    border: 1px solid rgba(76, 175, 80, 0.4);
                }
                .skip-intro-marker-recap {
                    background: linear-gradient(90deg, rgba(255, 152, 0, 0.3), rgba(255, 152, 0, 0.6));
                    border: 1px solid rgba(255, 152, 0, 0.4);
                }
                .skip-intro-marker-credits {
                    background: linear-gradient(90deg, rgba(33, 150, 243, 0.3), rgba(33, 150, 243, 0.6));
                    border: 1px solid rgba(33, 150, 243, 0.4);
                }
                .skip-intro-marker-preview {
                    background: linear-gradient(90deg, rgba(156, 39, 176, 0.3), rgba(156, 39, 176, 0.6));
                    border: 1px solid rgba(156, 39, 176, 0.4);
                }
                .skip-intro-marker-label {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.85);
                    color: #fff;
                    padding: 3px 10px;
                    border-radius: 4px;
                    font-size: 10px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    font-family: system-ui, sans-serif;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }
                .skip-intro-marker:hover .skip-intro-marker-label {
                    opacity: 1;
                }
                .skip-intro-marker.active {
                    opacity: 0.7 !important;
                    transform: scaleY(1.5) !important;
                    animation: skip-intro-pulse 1s ease-in-out infinite;
                    box-shadow: 0 0 20px rgba(255,255,255,0.3);
                }
                .skip-intro-marker.skipped {
                    opacity: 0.2 !important;
                    transform: scaleY(0.6) !important;
                }
                .skip-intro-marker.skipped::after {
                    content: '✓';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #fff;
                    font-size: 12px;
                    font-weight: bold;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8);
                }
                @keyframes skip-intro-pulse {
                    0%, 100% { opacity: 0.5; transform: scaleY(1.3); }
                    50% { opacity: 0.9; transform: scaleY(1.8); }
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
            if (!this._markersContainer || !duration) return;
            
            const color = this._colors[type] || '#FFFFFF';
            const startPercent = (start / duration) * 100;
            const endPercent = (end / duration) * 100;
            const width = Math.max(endPercent - startPercent, 0.3);
            
            if (width <= 0) return;
            
            const marker = document.createElement('div');
            marker.className = `skip-intro-marker skip-intro-marker-${type}`;
            marker.dataset.type = type;
            marker.dataset.start = start;
            marker.dataset.end = end;
            
            marker.style.cssText = `
                position: absolute;
                top: 0;
                left: ${startPercent}%;
                width: ${width}%;
                height: 100%;
                opacity: 0.35;
                border-radius: 2px;
                transition: all 0.3s ease;
                pointer-events: auto;
                min-width: 3px;
            `;
            
            const label = document.createElement('div');
            label.className = 'skip-intro-marker-label';
            label.textContent = this._typeNames[type] || type;
            marker.appendChild(label);
            
            // Клик для перемотки
            marker.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const video = Lampa.PlayerVideo.video();
                    if (video) {
                        video.currentTime = start;
                    }
                } catch(err) {}
            });
            
            this._markersContainer.appendChild(marker);
            this._markers.push({ start, end, type, element: marker });
            
            // Анимация появления
            requestAnimationFrame(() => {
                marker.style.transform = 'scaleY(0)';
                setTimeout(() => {
                    marker.style.transform = 'scaleY(1)';
                }, 50);
            });
        },

        updateMarkers(segments, duration) {
            this.clear();
            if (!segments || !segments.length || !duration) return;
            
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
                    data.start === segment.start && data.end === segment.end) {
                    marker.classList.add('active');
                } else {
                    marker.classList.remove('active');
                }
            });
        },

        markSkipped(segment) {
            const markers = this._markersContainer?.querySelectorAll('.skip-intro-marker') || [];
            markers.forEach(marker => {
                const data = this._markers.find(m => m.element === marker);
                if (data && segment && data.type === segment.type && 
                    data.start === segment.start && data.end === segment.end) {
                    marker.classList.add('skipped');
                    setTimeout(() => {
                        marker.classList.remove('skipped');
                        marker.style.opacity = '0.15';
                    }, 3000);
                }
            });
        },

        resetHighlights() {
            const markers = this._markersContainer?.querySelectorAll('.skip-intro-marker') || [];
            markers.forEach(m => {
                m.classList.remove('active', 'skipped');
                m.style.opacity = '';
            });
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

                const threshold = Math.max(0, duration - 600);
                let maxGap2 = 0;
                let creditsStart = 0;
                let creditsEnd = 0;

                for (let i = 0; i < cues.length - 1; i++) {
                    if (cues[i].end < threshold) continue;
                    const gap2 = cues[i + 1].start - cues[i].end;
                    if (gap2 >= CONFIG.CREDITS_MIN_GAP && gap2 > maxGap2) {
                        maxGap2 = gap2;
                        creditsStart = Math.round(cues[i].end);
                        creditsEnd = Math.round(cues[i + 1].start);
                    }
                }

                if (creditsStart && creditsEnd && maxGap2 > gap) {
                    segments.push({
                        type: 'credits',
                        start: creditsStart,
                        end: creditsEnd,
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

    // ===== UI КНОПКА =====
    const SkipButton = {
        _element: null,
        _progressBar: null,
        _visible: false,
        _timer: null,
        _skipCallback: null,
        _cancelCallback: null,
        _lampaKeyHandler: null,
        _domKeyHandler: null,

        _injectCSS() {
            if (document.getElementById('skip-intro-css')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-css';
            style.textContent = `
                .skip-intro-btn {
                    position: absolute;
                    right: 30px;
                    bottom: 160px;
                    padding: 12px 24px;
                    background: rgba(0,0,0,0.75);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border: 2px solid rgba(255,255,255,0.15);
                    border-radius: 10px;
                    color: #fff;
                    font-size: 0.9em;
                    cursor: pointer;
                    z-index: 9999;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateX(15px);
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    font-family: system-ui, -apple-system, sans-serif;
                    line-height: 1.4;
                    display: flex;
                    flex-direction: column;
                    min-width: 160px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                }
                .skip-intro-btn.visible {
                    opacity: 1;
                    pointer-events: auto;
                    transform: translateX(0);
                }
                .skip-intro-btn:focus {
                    border-color: rgba(255,255,255,0.5);
                    outline: none;
                }
                .skip-intro-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 2px 0;
                }
                .skip-intro-icon {
                    width: 18px;
                    height: 18px;
                    flex-shrink: 0;
                    opacity: 0.8;
                }
                .skip-intro-progress {
                    width: 100%;
                    height: 2px;
                    background: rgba(255,255,255,0.15);
                    border-radius: 2px;
                    margin-top: 8px;
                    overflow: hidden;
                    position: relative;
                }
                .skip-intro-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(200,200,255,0.5));
                    width: 0%;
                    transition: width 0.1s linear;
                }
                .skip-intro-hint {
                    font-size: 0.65em;
                    opacity: 0.5;
                    margin-left: 6px;
                    font-weight: 300;
                }
                @media (max-width: 720px) {
                    .skip-intro-btn {
                        right: 20px;
                        bottom: 140px;
                        padding: 10px 18px;
                        font-size: 0.8em;
                        min-width: 120px;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        show(label, onSkip, onCancel, badge, isCountdown) {
            this._cleanup();
            this._injectCSS();

            if (this._element) {
                this._updateLabel(label, badge);
                if (isCountdown) {
                    this._element.classList.add('countdown');
                    this._element._withCancel = true;
                } else {
                    this._element.classList.remove('countdown');
                    this._element._withCancel = false;
                }
                this._skipCallback = onSkip;
                this._cancelCallback = onCancel || null;
                if (!this._visible) this._setVisible(true);
                if (isCountdown) this._startProgress();
                return;
            }

            this._createElement(label, onSkip, onCancel, badge, isCountdown);
            this._setVisible(true);
            if (isCountdown) this._startProgress();
        },

        _createElement(label, onSkip, onCancel, badge, isCountdown) {
            const btn = document.createElement('div');
            btn.className = 'skip-intro-btn' + (isCountdown ? ' countdown' : '');
            btn.setAttribute('tabindex', '1');
            btn._withCancel = !!onCancel;
            btn._skipCallback = onSkip;
            btn._cancelCallback = onCancel || null;

            const content = document.createElement('div');
            content.className = 'skip-intro-content';

            const textSpan = document.createElement('span');
            textSpan.className = 'skip-intro-label';
            textSpan.textContent = label;
            content.appendChild(textSpan);

            if (badge) {
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'skip-intro-hint';
                badgeSpan.textContent = badge;
                content.appendChild(badgeSpan);
            }

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'skip-intro-icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'currentColor');
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M5.5 18.5V5.5L14 12L5.5 18.5Z');
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M14 18.5V5.5L22.5 12L14 18.5Z');
            svg.appendChild(path1);
            svg.appendChild(path2);
            content.appendChild(svg);

            const hintSpan = document.createElement('span');
            hintSpan.className = 'skip-intro-hint';
            const hintText = isCountdown ? 
                this._getCancelHint() : 
                this._getSkipHint();
            hintSpan.textContent = hintText;
            content.appendChild(hintSpan);

            btn.appendChild(content);

            const progressContainer = document.createElement('div');
            progressContainer.className = 'skip-intro-progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'skip-intro-progress-bar';
            progressContainer.appendChild(progressBar);
            btn.appendChild(progressContainer);

            this._progressBar = progressBar;
            
            content.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (btn._skipCallback) btn._skipCallback();
            });

            this._lampaKeyHandler = (event) => {
                if (!btn.classList.contains('visible')) return;
                const code = event.code || event.keyCode;
                const skipKeys = PluginSettings.getSkipKeys();
                const cancelKeys = PluginSettings.getCancelKeys();
                const okKeys = [13, 29443, 65385];

                if (skipKeys.includes(code) && !okKeys.includes(code)) {
                    event.event && event.event.preventDefault();
                    if (btn._skipCallback) btn._skipCallback();
                    return;
                }

                if (btn._withCancel && cancelKeys.includes(code)) {
                    event.event && event.event.preventDefault();
                    if (btn._cancelCallback) btn._cancelCallback();
                }
            };

            this._domKeyHandler = (e) => {
                if (!btn.classList.contains('visible')) return;
                const code = e.keyCode;
                const skipKeys = PluginSettings.getSkipKeys();
                const cancelKeys = PluginSettings.getCancelKeys();

                if (skipKeys.includes(code)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btn._skipCallback) btn._skipCallback();
                    return;
                }

                if (btn._withCancel && cancelKeys.includes(code)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btn._cancelCallback) btn._cancelCallback();
                }
            };

            if (Lampa.Keypad && Lampa.Keypad.listener) {
                Lampa.Keypad.listener.follow('keydown', this._lampaKeyHandler);
            }
            document.addEventListener('keydown', this._domKeyHandler, true);

            const player = document.querySelector('.player');
            (player || document.body).appendChild(btn);
            this._element = btn;
            this._skipCallback = onSkip;
            this._cancelCallback = onCancel || null;
        },

        _updateLabel(label, badge) {
            if (!this._element) return;
            const labelEl = this._element.querySelector('.skip-intro-label');
            if (labelEl) labelEl.textContent = label;
            
            const badgeEl = this._element.querySelector('.skip-intro-hint');
            if (badgeEl && badge) {
                badgeEl.textContent = badge;
            }
        },

        _getSkipHint() {
            const keys = PluginSettings.getSkipKeys();
            const map = {
                13: 'OK', 29443: 'OK', 65385: 'OK',
                32: 'Пробел', 403: 'Красная', 404: 'Зелёная',
                405: 'Жёлтая', 406: 'Синяя'
            };
            const label = keys.find(k => map[k]) || 'OK';
            return `нажмите ${map[label] || label}`;
        },

        _getCancelHint() {
            const keys = PluginSettings.getCancelKeys();
            const map = {
                8: 'Назад', 27: 'Назад', 10009: 'Назад', 461: 'Назад', 4: 'Назад',
                403: 'Красная', 404: 'Зелёная', 405: 'Жёлтая', 406: 'Синяя'
            };
            const label = keys.find(k => map[k]) || 'Назад';
            return `нажмите ${map[label] || label} для отмены`;
        },

        _startProgress() {
            const start = Date.now();
            const duration = CONFIG.AUTO_SKIP_DELAY;
            
            this._timer = setInterval(() => {
                if (!this._progressBar) {
                    this._cleanup();
                    return;
                }
                const elapsed = Date.now() - start;
                const progress = Math.min(elapsed / duration, 1);
                this._progressBar.style.width = `${progress * 100}%`;
                
                if (progress >= 1) {
                    this._cleanup();
                    if (this._skipCallback) this._skipCallback();
                }
            }, 50);
        },

        _cleanup() {
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
        },

        hide() {
            this._cleanup();
            if (this._element) {
                this._setVisible(false);
                if (this._lampaKeyHandler && Lampa.Keypad && Lampa.Keypad.listener) {
                    Lampa.Keypad.listener.remove('keydown', this._lampaKeyHandler);
                }
                if (this._domKeyHandler) {
                    document.removeEventListener('keydown', this._domKeyHandler, true);
                }
                
                setTimeout(() => {
                    if (this._element && this._element.parentNode) {
                        this._element.parentNode.removeChild(this._element);
                    }
                    this._element = null;
                    this._progressBar = null;
                    this._skipCallback = null;
                    this._cancelCallback = null;
                    this._lampaKeyHandler = null;
                    this._domKeyHandler = null;
                }, 350);
            }
            this._visible = false;
        },

        destroy() {
            this._cleanup();
            this.hide();
        },

        _setVisible(visible) {
            this._visible = visible;
            if (this._element) {
                if (visible) {
                    this._element.classList.add('visible');
                    setTimeout(() => this._element && this._element.focus(), 100);
                } else {
                    this._element.classList.remove('visible');
                }
            }
        },

        isVisible() {
            return this._visible;
        }
    };

    // ===== ОСНОВНОЙ КЛАСС =====
    const SkipIntroPlugin = {
        _segments: [],
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
                    Utils.throttle((data) => this._onTimeUpdate(data), 300)
                );
            }

            console.log('[SkipIntro] Plugin initialized for Tizen');
        },

        _onStart(data) {
            this._cleanup();

            if (!PluginSettings.isEnabled()) return;

            const meta = this._extractMeta(data);
            if (!meta.tmdb_id || !meta.is_series || meta.season == null || meta.episode == null) {
                return;
            }

            this._currentData = data;
            this._currentTmdb = meta.tmdb_id;
            
            console.log(`[SkipIntro] Loading segments for S${meta.season}E${meta.episode}`);
            
            let apiDone = false;
            let detectDone = false;
            let apiSegments = [];
            let detectSegments = [];

            const mergeSegments = () => {
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

                this._segments = merged;
                this._updateProgressMarkers(merged);
                console.log(`[SkipIntro] Loaded ${merged.length} segments`);
            };

            ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._currentData === data) {
                        apiSegments = segments || [];
                        apiDone = true;
                        if (apiSegments.length) {
                            this._segments = apiSegments;
                        }
                        mergeSegments();
                    }
                })
                .catch(() => {
                    apiDone = true;
                    mergeSegments();
                });

            if (PluginSettings.isDetectEnabled()) {
                this._runDetection(data, meta, (segments) => {
                    if (this._currentData === data && segments && segments.length) {
                        detectSegments = segments;
                        detectDone = true;
                        mergeSegments();
                    } else {
                        detectDone = true;
                        mergeSegments();
                    }
                });
            } else {
                detectDone = true;
                mergeSegments();
            }
        },

        _extractMeta(data) {
            const meta = {
                tmdb_id: null,
                imdb_id: null,
                season: null,
                episode: null,
                is_series: false
            };

            let card = data.card || null;
            if (!card) {
                try {
                    const activity = Lampa.Activity.active();
                    if (activity) {
                        card = activity.card || activity.movie || null;
                    }
                } catch(e) {}
            }

            if (card) {
                meta.tmdb_id = card.id || null;
                meta.imdb_id = card.imdb_id || null;
                if (card.name || card.number_of_seasons || card.first_air_date) {
                    meta.is_series = true;
                }
            }

            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);

            if ((meta.season == null || meta.episode == null) && data.title) {
                const match = data.title.match(/[Ss](\d+)[Ee](\d+)/);
                if (match) {
                    if (meta.season == null) meta.season = parseInt(match[1]);
                    if (meta.episode == null) meta.episode = parseInt(match[2]);
                }
            }

            if (data.playlist && Array.isArray(data.playlist)) {
                const url = data.url;
                for (let i = 0; i < data.playlist.length; i++) {
                    const item = data.playlist[i];
                    const itemUrl = typeof item.url === 'string' ? item.url : '';
                    if (itemUrl === url || i === 0) {
                        if (item.season != null && meta.season == null) {
                            meta.season = parseInt(item.season);
                        }
                        if (item.episode != null && meta.episode == null) {
                            meta.episode = parseInt(item.episode);
                        }
                        if (item.s != null && meta.season == null) {
                            meta.season = parseInt(item.s);
                        }
                        if (item.e != null && meta.episode == null) {
                            meta.episode = parseInt(item.e);
                        }
                    }
                    if (itemUrl === url) break;
                }
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
            
            const current = data.current;
            if (!Utils.isNumeric(current)) return;
            
            const segment = Utils.findSegment(this._segments, current);
            
            if (segment) {
                ProgressMarker.highlightActive(segment);
            } else {
                ProgressMarker.resetHighlights();
            }
            
            if (segment) {
                if (!PluginSettings.isTypeEnabled(segment.type)) {
                    if (this._activeSegment) this._hideButton();
                    return;
                }
                
                if (this._lastSkipped === segment) return;
                
                if (PluginSettings.isAutoSkip()) {
                    this._doSkip(segment, true);
                    return;
                }
                
                if (this._activeSegment !== segment) {
                    this._activeSegment = segment;
                    const label = {
                        intro: 'Пропустить заставку',
                        recap: 'Пропустить рекап',
                        credits: 'Пропустить титры',
                        preview: 'Пропустить превью'
                    }[segment.type] || 'Пропустить';
                    
                    const badge = segment._source === 'subs' ? '(субтитры)' :
                                 segment._source === 'audio' ? '(звук)' : null;
                    
                    const tmdb = this._currentTmdb;
                    const hasSkipped = tmdb && Cache.hasSkipped(tmdb, segment.type);
                    
                    if (hasSkipped) {
                        this._showCountdown(label, segment, badge);
                    } else {
                        this._showNormal(label, segment, badge);
                    }
                }
            } else if (this._activeSegment) {
                this._hideButton();
            }
        },

        _showNormal(label, segment, badge) {
            SkipButton.show(
                label,
                () => {
                    if (this._currentTmdb) {
                        Cache.rememberSkip(this._currentTmdb, segment.type);
                    }
                    this._doSkip(segment, false);
                },
                null,
                badge,
                false
            );
        },

        _showCountdown(label, segment, badge) {
            SkipButton.show(
                label,
                () => this._doSkip(segment, true),
                () => {
                    console.log('[SkipIntro] Auto-skip cancelled');
                    if (this._currentTmdb) {
                        Cache.forgetSkip(this._currentTmdb, segment.type);
                    }
                    this._lastSkipped = segment;
                    SkipButton.destroy();
                    this._activeSegment = null;
                },
                badge,
                true
            );
        },

        _hideButton() {
            this._activeSegment = null;
            SkipButton.hide();
        },

        _doSkip(segment, auto) {
            this._lastSkipped = segment;
            this._activeSegment = null;
            SkipButton.destroy();
            
            ProgressMarker.markSkipped(segment);
            
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
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            this._currentTmdb = null;
            this._detecting = false;
            SkipButton.destroy();
            AudioDetector.destroy();
            ProgressMarker.clear();
        },

        _onDestroy() {
            this._cleanup();
            ProgressMarker.clear();
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
