(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;

    // --- БЛОК ЭКРАННОГО ЛОГИРОВАНИЯ ---
    var logElement = null;
    function screenLog(context, message, obj) {
        if (!logElement) {
            logElement = $('<div id="lampa-tracks-logger" style="position:fixed; top:10px; left:10px; width:450px; max-height:400px; background:rgba(0,0,0,0.85); color:#00ff00; font-size:12px; font-family:monospace; z-index:99999; overflow-y:auto; padding:10px; border:1px solid #00ff00; pointer-events:none;">[Tracks Log Start]</div>');
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
    // ---------------------------------

    function reguest(params, callback) {
      screenLog('WS_REQ', 'Отправка запроса для index=' + params.id + ', hash=' + params.torrent_hash);
      if (params.ffprobe && params.path.split('.').pop() !== 'mp4') {
        setTimeout(function () {
          callback({ streams: params.ffprobe });
        }, 200);
      } else {
        if (connect_host == '{localhost}') connect_host = '185.204.0.61';
        var socket = new WebSocket('ws://' + connect_host + ':8080/?' + params.torrent_hash + '&index=' + params.id);
        
        socket.addEventListener('open', function() {
            screenLog('WS_REQ', 'Соединение установлено');
        });

        socket.addEventListener('message', function (event) {
          socket.close();
          var json = {};
          try { json = JSON.parse(event.data); } catch (e) {}
          screenLog('WS_RES', 'Получен ответ от сервера. Стримов: ' + (json.streams ? json.streams.length : 0));
          if (json.streams) callback(json);
        });

        socket.addEventListener('error', function(err) {
            screenLog('WS_ERR', 'Ошибка вебсокета', err);
        });
      }
    }

    function subscribeTracks(data) {
      var inited = false;
      var inited_parse = false;
      var webos_replace = {};

      screenLog('CORE', 'Плагин инициализирован (subscribeTracks) для первой серии', data);

      function getTracks() {
        var video = Lampa.PlayerVideo.video();
        return video ? (video.audioTracks || []) : [];
      }

      function getSubs() {
        var video = Lampa.PlayerVideo.video();
        return video ? (video.textTracks || []) : [];
      }

      function setTracks() {
        if (inited_parse) {
          var new_tracks = [];
          var video_tracks = getTracks();
          var parse_tracks = inited_parse.streams.filter(function (a) { return a.codec_type == 'audio'; });
          var minus = 1;
          
          screenLog('RENDER', 'Применение звуковых дорожек. В видео-теге сейчас: ' + video_tracks.length);

          if (parse_tracks.length !== video_tracks.length) parse_tracks = parse_tracks.filter(function (a) { return a.codec_name !== 'dts'; });
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
      }

      function setSubs() {
        if (inited_parse) {
          var new_subs = [];
          var video_subs = getSubs();
          var parse_subs = inited_parse.streams.filter(function (a) { return a.codec_type == 'subtitle'; });
          var minus = inited_parse.streams.filter(function (a) { return a.codec_type == 'audio'; }).length + 1;
          
          screenLog('RENDER', 'Применение субтитров. В видео-теге сейчас: ' + video_subs.length);

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
      }

      function listenTracks() {
        screenLog('EVENT', 'Сработало событие плеера Lampa: tracks');
        setTracks();
      }

      function listenSubs() {
        screenLog('EVENT', 'Сработало событие плеера Lampa: subs');
        setSubs();
      }

      function canPlay() {
        screenLog('EVENT', 'Сработало событие плеера Lampa: canplay');
        if (webos_replace.tracks) setWebosTracks(webos_replace.tracks);else setTracks();
        if (webos_replace.subs) setWebosSubs(webos_replace.subs);else setSubs();
      }

      function listenStart(activeData) {
        var targetData = activeData || data;
        inited = true;
        inited_parse = false; 
        
        reguest(targetData, function (result) {
          inited_parse = result;
          if (inited) {
            setTracks();
            setSubs();
          }
        });
      }

      function listenDestroy() {
        screenLog('CORE', 'Игрок уничтожен. Очистка.');
        inited = false;
        if (logElement) { logElement.remove(); logElement = null; }
        
        // Убираем глобальные подписки плеера Lampa
        Lampa.Player.listener.remove('destroy', listenDestroy);
        if (Lampa.Player.listener.remove) {
            Lampa.Player.listener.remove('change_file', listenChangeFile);
            Lampa.Player.listener.remove('playlist_index', listenPlaylistIndex);
        }
        Lampa.PlayerVideo.listener.remove('tracks', listenTracks);
        Lampa.PlayerVideo.listener.remove('subs', listenSubs);
        Lampa.PlayerVideo.listener.remove('canplay', canPlay);
      }

      // ТЕСТОВЫЕ ПЕРЕХВАТЧИКИ ВСЕХ ВОЗМОЖНЫХ СОБЫТИЙ ПЕРЕКЛЮЧЕНИЯ
      function listenChangeFile(e) {
        screenLog('LAMPA_EVENT', 'Поймали change_file', e ? e.data : 'no data');
        if (e && e.data) listenStart(e.data);
      }

      function listenPlaylistIndex(e) {
        screenLog('LAMPA_EVENT', 'Поймали playlist_index', e);
        var playlist = Lampa.Player.playlist ? Lampa.Player.playlist() : null;
        var current_item = playlist ? playlist[e.index] : null;
        if (current_item) {
            var freshData = {
                torrent_hash: data.torrent_hash,
                id: current_item.id || e.index,
                path: current_item.path || ''
            };
            screenLog('LAMPA_EVENT', 'Сборка freshData для playlist_index', freshData);
            listenStart(freshData);
        }
      }

      Lampa.Player.listener.follow('destroy', listenDestroy);
      
      // Пробуем подписаться на оба события с логированием
      try {
          Lampa.Player.listener.follow('change_file', listenChangeFile);
          screenLog('INIT', 'Успешная подписка на change_file');
      } catch(e) { screenLog('INIT_ERR', 'Не удалось подписаться на change_file', e); }

      try {
          Lampa.Player.listener.follow('playlist_index', listenPlaylistIndex);
          screenLog('INIT', 'Успешная подписка на playlist_index');
      } catch(e) { screenLog('INIT_ERR', 'Не удалось подписаться на playlist_index', e); }

      Lampa.PlayerVideo.listener.follow('tracks', listenTracks);
      Lampa.PlayerVideo.listener.follow('subs', listenSubs);
      Lampa.PlayerVideo.listener.follow('canplay', canPlay);
      
      // Следим за изменениями нативного тега <video>
      try {
          var vTag = Lampa.PlayerVideo.video();
          if (vTag) {
              vTag.addEventListener('loadstart', function() {
                  screenLog('HTML5_EVENT', 'Тег video вызвал loadstart. Текущий src: ' + vTag.src);
              });
              vTag.addEventListener('emptied', function() {
                  screenLog('HTML5_EVENT', 'Тег video вызвал emptied (смена файла)');
              });
          }
      } catch(err) { screenLog('INIT_ERR', 'Ошибка вешания на HTML5 тег', err); }

      listenStart();
    }

    Lampa.Player.listener.follow('start', function (data) {
      if (data.torrent_hash) subscribeTracks(data);
    });

    Lampa.Listener.follow('torrent_file', function (data) {
      if (data.type == 'list_open') list_opened = true;
      if (data.type == 'list_close') list_opened = false;
    });

})();
