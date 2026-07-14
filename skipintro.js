!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    const CONFIG = {
        INTRO_MAX_START: 180, // Максимальное время начала первой реплики (в сек)
        MIN_SUBTITLES: 3,     // Минимальное кол-во субтитров для анализа
        NOTIFICATION_DURATION: 3000
    };

    // ===== ВИЗУАЛЬНАЯ РАЗМЕТКА ТАЙМЛАЙНА =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markerElement: null,

        init() {
            const selectors = [
                '.player-progress', '.video-progress', '.progress-bar', 
                '.seek-bar', '.timeline', '.player-timeline', '.player-js-progress'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    this._container = el;
                    break;
                }
            }

            if (!this._container) return false;

            this._container.style.position = 'relative';
            
            let mc = this._container.querySelector('.skip-intro-markers');
            if (!mc) {
                mc = document.createElement('div');
                mc.className = 'skip-intro-markers';
                mc.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:99;';
                this._container.appendChild(mc);
            }
            this._markersContainer = mc;
            this._injectStyles();
            return true;
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-styles')) return;
            const style = document.createElement('style');
            style.id = 'skip-intro-styles';
            style.textContent = `
                .skip-intro-marker {
                    position: absolute; top: 0; left: 0; height: 100%;
                    border-radius: 2px; min-width: 4px; opacity: 0.7; transition: all 0.3s ease;
                    background: rgba(76, 175, 80, 0.7); border-right: 2px solid #4CAF50;
                }
                .skip-intro-marker.active { opacity: 0.95; background: rgba(76, 175, 80, 0.9); box-shadow: 0 0 8px #4CAF50; }
                
                .skip-intro-notification {
                    position: fixed; top: 40px; left: 50%; transform: translateX(-50%) translateY(-20px);
                    background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    color: #fff; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: 500;
                    z-index: 99999; opacity: 0; pointer-events: none; transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 5px 20px rgba(0,0,0,0.5);
                }
                .skip-intro-notification.show { opacity: 1; transform: translateX(-50%) translateY(0); }
            `;
            document.head.appendChild(style);
        },

        draw(endSec, duration) {
            this.clear();
            this.init();
            
            if (!this._markersContainer || !duration || !endSec) return;

            const widthPct = (endSec / duration) * 100;
            if (widthPct > 100 || widthPct <= 0) return;

            const marker = document.createElement('div');
            marker.className = 'skip-intro-marker active';
            marker.style.width = `${Math.min(widthPct, 100)}%`;
            
            this._markersContainer.appendChild(marker);
            this._markerElement = marker;
        },

        highlight(isActive) {
            if (this._markerElement) {
                if (isActive) {
                    this._markerElement.classList.add('active');
                } else {
                    this._markerElement.classList.remove('active');
                }
            }
        },

        clear() {
            if (this._markersContainer) this._markersContainer.innerHTML = '';
            this._markerElement = null;
            this._container = null;
            this._markersContainer = null;
        }
    };

    // ===== УВЕДОМЛЕНИЯ =====
    const Notification = {
        _el: null,
        _timer: null,

        show(text, badge) {
            this.hide();
            const el = document.createElement('div');
            el.className = 'skip-intro-notification';
            el.innerHTML = `⏭ <b>${text}</b> <span style="opacity:0.6;font-size:12px;margin-left:8px;">${badge}</span>`;
            document.body.appendChild(el);
            this._el = el;

            requestAnimationFrame(() => el.classList.add('show'));
            this._timer = setTimeout(() => this.hide(), CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) clearTimeout(this._timer);
            if (this._el) {
                const temp = this._el;
                temp.classList.remove('show');
                setTimeout(() => temp.parentNode && temp.parentNode.removeChild(temp), 300);
                this._el = null;
            }
        }
    };

    // ===== ДЕТЕКТОР СУБТИТРОВ =====
    const SubtitleDetector = {
        analyze(video) {
            try {
                if (video.textTracks && video.textTracks.length) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        const track = video.textTracks[i];
                        if (track.cues && track.cues.length > CONFIG.MIN_SUBTITLES) {
                            const firstCueStart = track.cues[0].startTime;
                            if (firstCueStart >= 10 && firstCueStart <= CONFIG.INTRO_MAX_START) {
                                return Math.round(firstCueStart);
                            }
                        }
                    }
                }
            } catch(e) {}
            return null;
        }
    };

    // ===== ЯДРО ПЛАГИНА =====
    const SkipIntroPlugin = {
        _introEnd: null,
        _isSkipped: false,
        _currentData: null,
        _initialized: false,
        _scanTimer: null,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._cleanup());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', (data) => this._onTimeUpdate(data));
            }
        },

        _onStart(data) {
            this._cleanup();
            this._currentData = data;
            this._scanSubtitles();
        },

        _scanSubtitles() {
            const check = () => {
                if (this._isSkipped || !this._currentData) return;
                
                let video = null;
                try { video = Lampa.PlayerVideo.video(); } catch(e) {}
                
                if (video) {
                    const detectTime = SubtitleDetector.analyze(video);
                    if (detectTime) {
                        this._introEnd = detectTime;
                        console.log(`[SkipIntro] Intro detected: 0-${detectTime}s`);
                        
                        if (this._scanTimer) clearInterval(this._scanTimer);

                        // Рисуем маркер на полосе
                        if (video.duration) {
                            ProgressMarker.draw(this._introEnd, video.duration);
                        } else {
                            setTimeout(() => {
                                if (video.duration) ProgressMarker.draw(this._introEnd, video.duration);
                            }, 1000);
                        }
                        return;
                    }
                }
            };

            // Проверяем каждые 2 секунды фоном, пока не найдем субтитры
            this._scanTimer = setInterval(check, 2000);
            check(); 
        },

        _onTimeUpdate(data) {
            if (!this._introEnd) return;

            let current = data.current;
            try {
                const nativeVideo = Lampa.PlayerVideo.video();
                if (nativeVideo && typeof nativeVideo.currentTime === 'number') {
                    current = nativeVideo.currentTime;
                }
            } catch(e) {}

            const inZone = (current >= 0 && current < this._introEnd);
            ProgressMarker.highlight(inZone);

            if (inZone && !this._isSkipped) {
                this._doSkip(this._introEnd);
            }
        },

        _doSkip(toTime) {
            this._isSkipped = true;
            Notification.show('Начало серии пропущено', `${toTime}с ⚡`);

            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    video.currentTime = toTime;
                }
            } catch(e) {}
        },

        _cleanup() {
            if (this._scanTimer) {
                clearInterval(this._scanTimer);
                this._scanTimer = null;
            }
            this._introEnd = null;
            this._isSkipped = false;
            this._currentData = null;
            Notification.hide();
            ProgressMarker.clear();
        }
    };

    // ===== ЗАПУСК ПЛАГИНА =====
    function initPlugin() {
        if (window.Lampa && Lampa.Player) {
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
