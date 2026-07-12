/**
 * Lampa plugin: Playlist Auto-Select Fix v3.0
 * Исправлена проблема с ожиданием создания playlist
 */

(function () {
    'use strict';

    if (window.__lampa_playlist_autoselect_fix__) return;
    window.__lampa_playlist_autoselect_fix__ = true;

    var CONFIG = {
        VOLATILE_PARAMS: [
            'preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_',
            'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid',
            'rand', 'random', 'cb', 'callback', 'nocache', 'v'
        ],
        IDENTITY_PARAMS: ['link', 'hash', 'info_hash', 'index', 'file_index', 'fi', 'id'],
        DEBUG: true,
        MAX_WAIT_ATTEMPTS: 50,
        CHECK_INTERVAL: 300
    };

    function log() {
        if (!CONFIG.DEBUG) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('🔧 [PlaylistFix]');
        console.log.apply(console, args);
    }

    function logError() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('❌ [PlaylistFix]');
        console.error.apply(console, args);
    }

    function safeDecode(s) {
        try { return decodeURIComponent(s); } catch (e) { return s; }
    }

    function parseQuery(url) {
        var q = {};
        var qIndex = url.indexOf('?');
        if (qIndex === -1) return q;
        var qs = url.slice(qIndex + 1).split('#')[0];
        qs.split('&').forEach(function (pair) {
            if (!pair) return;
            var idx = pair.indexOf('=');
            var k = idx === -1 ? pair : pair.slice(0, idx);
            var v = idx === -1 ? '' : pair.slice(idx + 1);
            q[safeDecode(k).toLowerCase()] = safeDecode(v);
        });
        return q;
    }

    function pathOf(url) {
        try {
            var noProto = url.replace(/^https?:\/\//i, '');
            var slashIndex = noProto.indexOf('/');
            var host = slashIndex === -1 ? noProto : noProto.slice(0, slashIndex);
            var path = slashIndex === -1 ? '' : noProto.slice(slashIndex);
            path = path.split('?')[0].split('#')[0];
            return host.toLowerCase() + path;
        } catch (e) {
            return url;
        }
    }

    function identityKey(url) {
        try {
            var q = parseQuery(url);
            var parts = [];
            CONFIG.IDENTITY_PARAMS.forEach(function (p) {
                if (q[p] !== undefined) parts.push(p + '=' + q[p]);
            });
            if (!parts.length) return null;
            return parts.join('&');
        } catch (e) {
            return null;
        }
    }

    function normalizedKey(url) {
        try {
            var q = parseQuery(url);
            var keys = Object.keys(q).filter(function (k) {
                return CONFIG.VOLATILE_PARAMS.indexOf(k) === -1;
            }).sort();
            var qs = keys.map(function (k) { return k + '=' + q[k]; }).join('&');
            return pathOf(url) + '?' + qs;
        } catch (e) {
            return url;
        }
    }

    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) return null;

        // 1) Точное совпадение
        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) return exact;

        // 2) По идентификатору файла
        var rawId = identityKey(rawUrl);
        if (rawId) {
            var byId = items.filter(function (it) { 
                return identityKey(it.url) === rawId;
            })[0];
            if (byId) return byId;
        }

        // 3) По нормализованной ссылке
        var rawNorm = normalizedKey(rawUrl);
        var byNorm = items.filter(function (it) { 
            return normalizedKey(it.url) === rawNorm;
        })[0];
        if (byNorm) return byNorm;

        // 4) По пути
        var rawPath = pathOf(rawUrl);
        var byPath = items.filter(function (it) {
            return pathOf(it.url) === rawPath;
        })[0];
        if (byPath) return byPath;

        return null;
    }

    // ========== ОСНОВНАЯ ЛОГИКА С УМНЫМ ОЖИДАНИЕМ ==========
    var lastRawUrl = null;
    var lastPlaylist = null;
    var isPatched = false;
    var waitAttempts = 0;
    var waitInterval = null;

    function tryPatch() {
        waitAttempts++;

        // Проверяем наличие Lampa
        if (!window.Lampa) {
            if (waitAttempts < CONFIG.MAX_WAIT_ATTEMPTS) {
                log('⏳ Ожидание Lampa... попытка ' + waitAttempts);
                return false;
            } else {
                logError('❌ Lampa не загружена');
                clearInterval(waitInterval);
                return false;
            }
        }

        // Проверяем Player
        if (!Lampa.Player) {
            if (waitAttempts < CONFIG.MAX_WAIT_ATTEMPTS) {
                log('⏳ Ожидание Lampa.Player... попытка ' + waitAttempts);
                return false;
            } else {
                logError('❌ Lampa.Player не найден');
                clearInterval(waitInterval);
                return false;
            }
        }

        // Пробуем получить playlist
        var pl = null;
        try {
            pl = Lampa.Player.playlist();
        } catch (e) {
            // Игнорируем ошибку
        }

        // Если playlist еще не создан, ждем
        if (!pl) {
            if (waitAttempts < CONFIG.MAX_WAIT_ATTEMPTS) {
                log('⏳ Ожидание создания playlist... попытка ' + waitAttempts);
                return false;
            } else {
                logError('❌ Playlist не создан после ' + CONFIG.MAX_WAIT_ATTEMPTS + ' попыток');
                clearInterval(waitInterval);
                
                // Последняя попытка: патчим через прототип
                tryPatchPrototype();
                return false;
            }
        }

        // Если уже пропатчен
        if (pl.__autoselect_patched__) {
            log('ℹ️ Плейлист уже пропатчен');
            clearInterval(waitInterval);
            isPatched = true;
            return true;
        }

        // Успешно получили playlist - патчим!
        log('✅ Получен playlist! Начинаем патчинг...');
        doPatch(pl);
        clearInterval(waitInterval);
        isPatched = true;
        return true;
    }

    // ========== ЗАПАСНОЙ ВАРИАНТ: ПАТЧИМ ПРОТОТИП ==========
    function tryPatchPrototype() {
        try {
            if (Lampa.Player && Lampa.Player.prototype) {
                var proto = Lampa.Player.prototype;
                var origPlaylist = proto.playlist;
                
                if (origPlaylist && !origPlaylist.__patched__) {
                    proto.playlist = function () {
                        var result = origPlaylist.call(this);
                        // Если playlist создался, пачуем его
                        if (result && !result.__autoselect_patched__) {
                            log('🔄 Патчим через прототип');
                            doPatch(result);
                        }
                        return result;
                    };
                    proto.playlist.__patched__ = true;
                    log('✅ Прототип пропатчен');
                }
            }
        } catch (e) {
            logError('Ошибка патча прототипа:', e);
        }
    }

    // ========== НЕПОСРЕДСТВЕННО ПАТЧИНГ ==========
    function doPatch(pl) {
        try {
            log('🔧 Патчинг playlist...');

            var origUrl = pl.url;
            var origSet = pl.set;
            var origGet = pl.get;

            pl.__orig_url = origUrl;
            pl.__orig_set = origSet;
            pl.__orig_get = origGet;

            // Патчим url()
            pl.url = function (u) {
                if (u) {
                    lastRawUrl = u;
                    try {
                        var items = this.get ? this.get() : (pl.get ? pl.get() : []);
                        if (items && items.length) {
                            var match = findMatch(u, items);
                            if (match) {
                                log('🔄 Подмена URL:', u, '→', match.url);
                                u = match.url;
                                lastPlaylist = items;
                            }
                        }
                    } catch (e) {
                        // Игнорируем
                    }
                }
                return origUrl.call(this, u);
            };

            // Патчим set()
            pl.set = function (p) {
                try {
                    if (lastRawUrl && p && p.length) {
                        var match = findMatch(lastRawUrl, p);
                        if (match) {
                            var currentUrl = origUrl.call(this);
                            if (currentUrl !== match.url) {
                                origUrl.call(this, match.url);
                            }
                            lastPlaylist = p;
                        }
                    }
                } catch (e) {}
                return origSet.call(this, p);
            };

            // Патчим get() для мониторинга
            pl.get = function () {
                var result = origGet.call(this);
                if (result && result.length) {
                    lastPlaylist = result;
                }
                return result;
            };

            pl.__autoselect_patched__ = true;
            log('✅ Плейлист успешно пропатчен!');

            // Пытаемся восстановить текущую серию
            tryRestoreCurrent();

        } catch (e) {
            logError('Ошибка патчинга:', e);
        }
    }

    // ========== ВОССТАНОВЛЕНИЕ ТЕКУЩЕЙ СЕРИИ ==========
    function tryRestoreCurrent() {
        try {
            var current = Lampa.Player.current();
            if (current) {
                var url = current.url ? current.url() : null;
                if (url) {
                    log('🎬 Текущее воспроизведение:', url);
                    var pl = Lampa.Player.playlist();
                    if (pl && pl.get) {
                        var items = pl.get();
                        var match = findMatch(url, items);
                        if (match) {
                            log('✅ Найдена активная серия в плейлисте');
                            // Обновляем current
                            if (current.set) {
                                current.set({ url: match.url });
                            }
                            // Перерисовываем плейлист
                            if (Lampa.Component && Lampa.Component.get) {
                                var playlistComp = Lampa.Component.get('playlist');
                                if (playlistComp && playlistComp.render) {
                                    playlistComp.render();
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Игнорируем
        }
    }

    // ========== ХУК ДЛЯ ОБНОВЛЕНИЯ ПЛЕЙЛИСТА ==========
    function setupPlaylistUpdateHook() {
        try {
            if (Lampa.Component) {
                var origAdd = Lampa.Component.add;
                if (origAdd && !origAdd.__hooked__) {
                    Lampa.Component.add = function (name, component) {
                        var result = origAdd.call(this, name, component);
                        if (name === 'playlist' || name === 'torrent-playlist') {
                            log('📦 Обнаружено создание компонента playlist');
                            setTimeout(function() {
                                // Пробуем перепатчить
                                var pl = Lampa.Player.playlist();
                                if (pl && !pl.__autoselect_patched__) {
                                    doPatch(pl);
                                }
                            }, 500);
                        }
                        return result;
                    };
                    Lampa.Component.add.__hooked__ = true;
                    log('✅ Хук на Component.add установлен');
                }
            }
        } catch (e) {
            // Игнорируем
        }
    }

    // ========== ЗАПУСК ==========
    log('🚀 Запуск Playlist Auto-Select Fix v3.0');

    // Событие app:ready
    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                log('📢 Получено событие app:ready');
                // Начинаем проверку с задержкой
                setTimeout(function() {
                    if (!isPatched) {
                        waitInterval = setInterval(tryPatch, CONFIG.CHECK_INTERVAL);
                    }
                }, 1000);
            }
        });
    }

    // MutationObserver на случай динамической загрузки
    var observer = new MutationObserver(function () {
        if (window.Lampa && window.Lampa.Player && !isPatched) {
            log('👀 Обнаружена загрузка Lampa через MutationObserver');
            if (!waitInterval) {
                waitInterval = setInterval(tryPatch, CONFIG.CHECK_INTERVAL);
            }
            // Отключаем observer после первого срабатывания
            observer.disconnect();
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Пробуем сразу
    setTimeout(function() {
        if (!isPatched && !waitInterval) {
            log('🔄 Начинаем проверку...');
            waitInterval = setInterval(tryPatch, CONFIG.CHECK_INTERVAL);
        }
    }, 500);

    // Устанавливаем хук для обновления плейлиста
    setTimeout(setupPlaylistUpdateHook, 1000);

    // Хук на изменение плейлиста через Lampa.Storage
    if (window.Lampa && Lampa.Storage) {
        var origSet = Lampa.Storage.set;
        if (origSet) {
            Lampa.Storage.set = function (key, value) {
                var result = origSet.call(this, key, value);
                if (key === 'playlist' && !isPatched) {
                    log('📦 Обнаружено изменение playlist в Storage');
                    setTimeout(function() {
                        var pl = Lampa.Player.playlist();
                        if (pl && !pl.__autoselect_patched__) {
                            doPatch(pl);
                        }
                    }, 100);
                }
                return result;
            };
        }
    }

    // API для ручного управления
    window.PlaylistFix = {
        version: '3.0',
        patch: function() {
            clearInterval(waitInterval);
            return tryPatch();
        },
        findMatch: findMatch,
        normalizedKey: normalizedKey,
        identityKey: identityKey,
        config: CONFIG,
        debug: function (enabled) {
            CONFIG.DEBUG = enabled;
            log('🐞 Отладка ' + (enabled ? 'включена' : 'выключена'));
        },
        status: function () {
            var pl = Lampa && Lampa.Player ? Lampa.Player.playlist() : null;
            return {
                patched: pl ? !!pl.__autoselect_patched__ : false,
                isPatched: isPatched,
                lastRawUrl: lastRawUrl,
                lastPlaylistLength: lastPlaylist ? lastPlaylist.length : 0,
                hasLampa: !!window.Lampa,
                hasPlayer: !!(window.Lampa && Lampa.Player),
                waitAttempts: waitAttempts
            };
        },
        forceRestore: tryRestoreCurrent
    };

    log('💡 Для отладки используйте PlaylistFix.status()');
    log('💡 Если плагин не сработал, выполните PlaylistFix.patch() вручную');
})();
