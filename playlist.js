/**
 * Lampa plugin: Playlist Auto-Select Fix
 * 
 * Проблема: при просмотре через торрент URL текущей серии при повторном
 * входе часто пересобирается (меняются служебные параметры), из-за чего
 * встроенное сравнение url === current в Lampa.Player.playlist() перестаёт
 * находить совпадение — плейлист не подсвечивает реально играющую серию,
 * пока не переключить её вручную.
 *
 * Решение: перехватываем Playlist.url() и Playlist.set(), сравниваем ссылки
 * "нормализованно" (без изменчивых параметров, либо по идентификатору
 * файла торрента link/hash+index), и если находим совпадение — подставляем
 * точную ссылку элемента плейлиста, чтобы штатная логика Lampa снова
 * сработала верно.
 *
 * Версия: 2.1
 * Автор: AI Assistant
 */

(function () {
    'use strict';

    // Предотвращаем двойную инициализацию
    if (window.__lampa_playlist_autoselect_fix__) return;
    window.__lampa_playlist_autoselect_fix__ = true;

    // ========== КОНФИГУРАЦИЯ ==========
    var CONFIG = {
        // Параметры, которые часто меняются между запусками одного и того же
        // файла и не влияют на то, какой это файл
        VOLATILE_PARAMS: [
            'preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_',
            'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid',
            'rand', 'random', 'cb', 'callback', 'nocache', 'v'
        ],
        
        // Параметры, которые надёжнее всего идентифицируют конкретный файл
        // внутри торрента у большинства балансеров/TorrServer-based ссылок
        IDENTITY_PARAMS: ['link', 'hash', 'info_hash', 'index', 'file_index', 'fi', 'id'],
        
        // Включать отладку в консоли
        DEBUG: true
    };

    // ========== УТИЛИТЫ ==========
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

    // Идентификатор файла в торренте
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

    // Нормализованная ссылка без изменчивых параметров
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

    // ========== ПОИСК СОВПАДЕНИЯ В ПЛЕЙЛИСТЕ ==========
    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) {
            log('❌ Нет данных для поиска');
            return null;
        }

        log('🔍 Ищем совпадение для:', rawUrl);
        log('📋 Всего элементов в плейлисте:', items.length);

        // 1) Точное совпадение — тогда и патчить нечего
        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) {
            log('✅ Найдено точное совпадение');
            return exact;
        }

        // 2) Совпадение по идентификатору файла торрента (самое надёжное)
        var rawId = identityKey(rawUrl);
        if (rawId) {
            log('🔑 Идентификатор файла:', rawId);
            var byId = items.filter(function (it) { 
                var id = identityKey(it.url);
                return id === rawId;
            })[0];
            if (byId) {
                log('✅ Найдено совпадение по ID файла');
                return byId;
            }
        }

        // 3) Совпадение по нормализованной ссылке
        var rawNorm = normalizedKey(rawUrl);
        log('📎 Нормализованная ссылка:', rawNorm);
        var byNorm = items.filter(function (it) { 
            return normalizedKey(it.url) === rawNorm;
        })[0];
        if (byNorm) {
            log('✅ Найдено совпадение по нормализованной ссылке');
            return byNorm;
        }

        // 4) Дополнительная проверка: сравниваем пути без параметров
        var rawPath = pathOf(rawUrl);
        log('📁 Путь без параметров:', rawPath);
        var byPath = items.filter(function (it) {
            return pathOf(it.url) === rawPath;
        })[0];
        if (byPath) {
            log('✅ Найдено совпадение по пути');
            return byPath;
        }

        log('❌ Совпадений не найдено');
        return null;
    }

    // ========== ПАТЧИНГ ==========
    var lastRawUrl = null;
    var lastPlaylist = null;
    var patchAttempts = 0;
    var MAX_ATTEMPTS = 20;

    function patch() {
        patchAttempts++;
        
        // Проверяем наличие Lampa
        if (!window.Lampa) {
            if (patchAttempts < MAX_ATTEMPTS) {
                log('⏳ Ожидание загрузки Lampa... попытка ' + patchAttempts);
                setTimeout(patch, 500);
            } else {
                logError('❌ Lampa не загрузилась после ' + MAX_ATTEMPTS + ' попыток');
            }
            return;
        }

        // Проверяем наличие Player и playlist
        if (!Lampa.Player || typeof Lampa.Player.playlist !== 'function') {
            if (patchAttempts < MAX_ATTEMPTS) {
                log('⏳ Ожидание инициализации Player... попытка ' + patchAttempts);
                setTimeout(patch, 500);
            } else {
                logError('❌ Lampa.Player не инициализирован');
            }
            return;
        }

        var pl = Lampa.Player.playlist();
        if (!pl) {
            if (patchAttempts < MAX_ATTEMPTS) {
                log('⏳ Ожидание создания playlist... попытка ' + patchAttempts);
                setTimeout(patch, 500);
            }
            return;
        }

        // Предотвращаем повторный патч
        if (pl.__autoselect_patched__) {
            log('ℹ️ Плейлист уже пропатчен');
            return;
        }

        log('🔧 Начинаем патчинг плейлиста...');

        var origUrl = pl.url;
        var origSet = pl.set;
        var origGet = pl.get;

        // Сохраняем оригинальные методы
        pl.__orig_url = origUrl;
        pl.__orig_set = origSet;
        pl.__orig_get = origGet;

        // Патчим метод url()
        pl.url = function (u) {
            if (u) {
                lastRawUrl = u;
                log('📥 Вызван pl.url() с:', u);
                
                try {
                    var items = this.get ? this.get() : (pl.get ? pl.get() : []);
                    if (items && items.length) {
                        var match = findMatch(u, items);
                        if (match) {
                            log('🔄 Подменяем ссылку:', u, '→', match.url);
                            u = match.url;
                            lastPlaylist = items;
                        }
                    }
                } catch (e) {
                    logError('Ошибка в pl.url():', e);
                }
            }
            return origUrl.call(this, u);
        };

        // Патчим метод set()
        pl.set = function (p) {
            log('📋 Вызван pl.set() с плейлистом из', p ? p.length : 0, 'элементов');
            
            try {
                // Если есть сохраненный URL, пытаемся найти соответствие
                if (lastRawUrl && p && p.length) {
                    var match = findMatch(lastRawUrl, p);
                    if (match) {
                        log('🔄 Корректируем current через pl.set()');
                        // Сохраняем текущий URL
                        var currentUrl = origUrl.call(this);
                        if (currentUrl !== match.url) {
                            // Принудительно устанавливаем правильную ссылку
                            origUrl.call(this, match.url);
                        }
                        lastPlaylist = p;
                    }
                }
            } catch (e) {
                logError('Ошибка в pl.set():', e);
            }
            
            return origSet.call(this, p);
        };

        // Патчим метод get() для мониторинга
        pl.get = function () {
            var result = origGet.call(this);
            // Сохраняем последний плейлист
            if (result && result.length) {
                lastPlaylist = result;
            }
            return result;
        };

        pl.__autoselect_patched__ = true;
        log('✅ Плейлист успешно пропатчен!');
        log('📊 Версия плагина: 2.1');

        // Дополнительная проверка: инициализируем текущую серию
        try {
            var current = Lampa.Player.current();
            if (current) {
                var url = current.url ? current.url() : null;
                if (url) {
                    log('🎬 Текущее воспроизведение:', url);
                    // Пытаемся найти и активировать серию в плейлисте
                    var items = pl.get ? pl.get() : [];
                    if (items && items.length) {
                        var match = findMatch(url, items);
                        if (match) {
                            log('✅ Найдена активная серия в плейлисте');
                            // Обновляем current
                            if (Lampa.Player.current) {
                                var curr = Lampa.Player.current();
                                if (curr && curr.set) {
                                    curr.set({ url: match.url });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Игнорируем ошибки при инициализации
        }
    }

    // ========== ЗАПУСК ==========
    log('🚀 Запуск Playlist Auto-Select Fix v2.1');

    // Способ 1: через событие Lampa.Listener
    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                log('📢 Получено событие app:ready');
                patch();
            }
        });
    }

    // Способ 2: через MutationObserver (на случай, если Lampa грузится динамически)
    var observer = new MutationObserver(function () {
        if (window.Lampa && window.Lampa.Player) {
            log('👀 Обнаружена загрузка Lampa через MutationObserver');
            patch();
            observer.disconnect();
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Способ 3: пробуем сразу (если Lampa уже загружена)
    setTimeout(patch, 100);

    // ========== ДОПОЛНИТЕЛЬНЫЙ ХУК ДЛЯ ОБНОВЛЕНИЯ ПЛЕЙЛИСТА ==========
    // Перехватываем обновления плейлиста через компоненты Lampa
    if (window.Lampa && Lampa.Component) {
        var origComponentInit = Lampa.Component.init;
        if (origComponentInit) {
            Lampa.Component.init = function () {
                var result = origComponentInit.apply(this, arguments);
                // Если это компонент плейлиста, пробуем перепатчить
                if (this && this.name && this.name === 'playlist') {
                    setTimeout(patch, 100);
                }
                return result;
            };
        }
    }

    // Экспортируем API для ручного управления
    window.PlaylistFix = {
        version: '2.1',
        patch: patch,
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
                lastRawUrl: lastRawUrl,
                lastPlaylistLength: lastPlaylist ? lastPlaylist.length : 0,
                hasLampa: !!window.Lampa,
                hasPlayer: !!(window.Lampa && Lampa.Player)
            };
        }
    };

    log('💡 Для отладки используйте PlaylistFix.status()');
})();
