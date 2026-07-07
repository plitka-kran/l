(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;
    var logElement = null;
    var global_inited = false;
    var current_torrent_hash = '';

    // Окно логгера теперь создается один раз глобально и не удаляется при смене серий
    function screenLog(context, message, obj) {
        if (!logElement) {
            logElement = $('<div id="lampa-tracks-logger" style="position:fixed; bottom:10px; left:10px; width:450px; max-height:400px; background:rgba(0,0,0,0.9); color:#00ff00; font-size:12px; font-family:monospace; z-index:99999; overflow-y:auto; padding:10px; border:1px solid #00ff00; pointer-events:none;">[Глобальный Лог Трэков]</div>');
            $('body').append(logElement);
        }
        var text = '[' + context + '] ' + message;
        if (obj) {
            try { text += ' => ' + JSON.stringify(obj); } catch(e) {}
        }
        logElement.append('<div>' + text + '</div>');
        logElement.scrollTop(logElement[0].scrollHeight);
        console.log('[Tracks]', context, message, obj || '');
    }

    function reguest(params, callback) {
      screenLog('WS_REQ', 'Запрос для ID=' + params.id + ', HASH=' + params.torrent_hash);
      if (params.ffprobe && params.path.split('.').pop() !== 'mp4') {
        setTimeout(function () {
          callback({ streams: params.ffprobe });
        }, 200);
      } else {
        if (connect_host == '{localhost}') connect_host = '185.204.0.61';
        var socket = new WebSocket('ws://' + connect_host + ':8080/?' + params.torrent_hash + '&index=' + params.id);
        
        socket.addEventListener('message', function (event) {
          socket.close();
          var json = {};
          try { json = JSON.parse(event.data); } catch (e) {}
          screenLog('WS_RES', 'Ответ получен. Стримов: ' + (json.streams ? json.streams.length : 0));
          if (json.streams) callback(json);
        });

        socket.addEventListener('error', function(err) {
            screenLog('WS_ERR', 'Ошибка WebSocket соединения');
        });
      }
    }

    // Глобальный контроллер, который работает ВСЕГДА, пока открыт плеер
    function initTracksManager(startData) {
        if (startData && startData.torrent_hash) {
            current_torrent_hash = startData.torrent_hash;
        }

        screenLog('MANAGER', 'Старт менеджера. Текущий hash: ' + current_torrent_hash);

        var inited_parse = false;
        var webos_replace = {};

        function getTracks() {
            var video = Lampa.PlayerVideo.video();
            return video ? (video.audioTracks || []) : [];
        }

        function getSubs() {
            var video = Lampa.PlayerVideo.video();
            return video ? (video.textTracks || []) : [];
        }

        function setTracks() {
            if (!inited_parse) return;
            var new_tracks = [];
            var video_tracks = getTracks();
            var parse_tracks = inited_parse.streams.filter(function (a) { return a.codec_type == 'audio'; });
            var minus = 1;

            screenLog('RENDER', 'Применяем аудио дорожки. В плеере сейчас: ' + video_tracks.length);

            if (parse_tracks.length !== video_tracks.length) {
                parse_tracks = parse_tracks.filter(function (a) { return a.codec_name !== 'dts'; });
            }
            parse_tracks = parse_tracks.filter(function (a) { return a.tags; });

            parse_tracks.forEach(function (track) {
                var orig = video_tracks[track.index - minus];
                var elem = {
                    index: track.index - minus,
                    language: track.tags.language,
                    label: track.tags.title || track.tags.handler_name,
                    ghost: orig ? false : true,
                    selected: orig ? orig.selected == true || orig.enabled == true : false
                };
                Object.defineProperty(elem, "enabled", {
                    set: function set(v) {
                        if (v) {
                            var aud = getTracks();
                            var trk = aud[elem.index];
                            for (var i = 0; i < aud.length; i++) { aud[i].enabled = false; aud[i].selected = false; }
                            if (trk) { trk.enabled = true; trk.selected = true; }
                        }
                    },
                    get: function get() {}
                });
                new_tracks.push(elem);
            });
            if (parse_tracks.length) Lampa.PlayerPanel.setTracks(new_tracks);
        }

        function setSubs() {
            if (!inited_parse) return;
            var new_subs = [];
            var video_subs = getSubs();
            var parse_subs = inited_parse.streams.filter(function (a) { return a.codec_type == 'subtitle'; });
            var minus = inited_parse.streams.filter(function (a) { return a.codec_type == 'audio'; }).length + 1;

            screenLog('RENDER', 'Применяем субтитры. В плеере сейчас: ' + video_subs.length);

            parse_subs = parse_subs.filter(function (a) { return a.tags; });
            parse_subs.forEach(function (track) {
                var orig = video_subs[track.index - minus];
                var elem = {
                    index: track.index - minus,
                    language: track.tags.language,
                    label: track.tags.title || track.tags.handler_name,
                    ghost: video_subs[track.index - minus] ? false : true,
                    selected: orig ? orig.selected == true || orig.mode == 'showing' : false
                };
                Object.defineProperty(elem, "mode", {
                    set: function set(v) {
                        if (v) {
                            var txt = getSubs();
                            var sub = txt[elem.index];
                            for (var i = 0; i < txt.length; i++) { txt[i].mode = 'disabled'; txt[i].selected = false; }
                            if (sub) { sub.mode = 'showing'; sub.selected = true; }
                        }
                    },
                    get: function get() {}
                });
                new_subs.push(elem);
            });
            if (parse_subs.length) Lampa.PlayerPanel.setSubs(new_subs);
        }

        function listenTracks() { setTracks(); }
        function listenSubs() { setSubs(); }
        function canPlay() { setTracks(); setSubs(); }

        // Запуск парсинга для текущей активной серии
        var playlist = Lampa.Player.playlist ? Lampa.Player.playlist() : null;
        var pIndex = Lampa.Player.index ? Lampa.Player.index() : 0;
        var currentItem = playlist ? playlist[pIndex] : null;

        var requestData = {
            torrent_hash: current_torrent_hash,
            id: currentItem ? (currentItem.id || pIndex) : pIndex,
            path: currentItem ? (currentItem.path || '') : ''
        };

        // Подписываемся на события текущего видео-элемента
        Lampa.PlayerVideo.listener.remove('tracks', listenTracks);
        Lampa.PlayerVideo.listener.remove('subs', listenSubs);
        Lampa.PlayerVideo.listener.remove('canplay', canPlay);
        
        Lampa.PlayerVideo.listener.follow('tracks', listenTracks);
        Lampa.PlayerVideo.listener.follow('subs', listenSubs);
        Lampa.PlayerVideo.listener.follow('canplay', canPlay);

        reguest(requestData, function (result) {
            inited_parse = result;
            setTracks();
            setSubs();
        });
    }

    // Глобальные слушатели Lampa (навешиваются ОДИН раз при старте приложения)
    if (!global_inited) {
        global_inited = true;

        // Следим за стартом медиа плеера
        Lampa.Player.listener.follow('start', function (data) {
            screenLog('GLOBAL', 'Поймали событие Player: start');
            if (data.torrent_hash) {
                initTracksManager(data);
            }
        });

        // Главное исправление: Следим за ПЕРЕКЛЮЧЕНИЕМ ИНДЕКСА серии на глобальном уровне
        Lampa.Player.listener.follow('playlist_index', function (e) {
            screenLog('GLOBAL', 'Поймали изменение серии (playlist_index) => ' + e.index);
            // Перезапускаем менеджер дорожек с задержкой, чтобы плеер успел обновиться
            setTimeout(function() {
                initTracksManager();
            }, 400);
        });

        // Если плеер полностью закрыли пользователем на главную страницу
        Lampa.Player.listener.follow('destroy', function () {
            screenLog('GLOBAL', 'Поймали Player: destroy (плеер полностью закрыт)');
            if (logElement) {
                logElement.remove();
                logElement = null;
            }
        });

        Lampa.Listener.follow('torrent_file', function (data) {
            if (data.type == 'list_open') list_opened = true;
            if (data.type == 'list_close') list_opened = false;
        });
    }

})();
