(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;
    var logElement = null;

    // Окно логгера (чтобы вы видели, работает ли плагин на 2-й серии)
    function screenLog(context, message, obj) {
        if (!logElement) {
            logElement = $('<div id="lampa-tracks-logger" style="position:fixed; bottom:10px; left:10px; width:450px; max-height:300px; background:rgba(0,0,0,0.9); color:#00ff00; font-size:12px; font-family:monospace; z-index:99999; overflow-y:auto; padding:10px; border:1px solid #00ff00; pointer-events:none;">[Лог Трэков Tizen]</div>');
            $('body').append(logElement);
        }
        var text = '[' + context + '] ' + message;
        if (obj) {
            try { text += ' => ' + JSON.stringify(obj); } catch(e) {}
        }
        logElement.append('<div>' + text + '</div>');
        logElement.scrollTop(logElement[0].scrollHeight);
    }

    function reguest(params, callback) {
      screenLog('WS_REQ', 'Запрос для ID=' + params.id);
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
        socket.addEventListener('error', function() {
          screenLog('WS_ERR', 'Ошибка WebSocket');
        });
      }
    }

    function startPluginLogic(playerData) {
      var inited = true;
      var inited_parse = false;
      var webos_replace = {};

      screenLog('INIT', 'Логика плагина запущена для серии!');

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

      function listenDestroy() {
        inited = false;
        if (logElement) { logElement.remove(); logElement = null; }
        Lampa.Player.listener.remove('destroy', listenDestroy);
        Lampa.PlayerVideo.listener.remove('tracks', listenTracks);
        Lampa.PlayerVideo.listener.remove('subs', listenSubs);
        Lampa.PlayerVideo.listener.remove('canplay', canPlay);
      }

      Lampa.Player.listener.follow('destroy', listenDestroy);
      Lampa.PlayerVideo.listener.follow('tracks', listenTracks);
      Lampa.PlayerVideo.listener.follow('subs', listenSubs);
      Lampa.PlayerVideo.listener.follow('canplay', canPlay);

      // Запрашиваем данные
      reguest(playerData, function (result) {
          inited_parse = result;
          if (inited) {
              setTracks();
              setSubs();
          }
        });
    }

    // БАСЕЙН ПРОВЕРКИ: Каждые 500мс проверяем, открылся ли плеер и работает ли плагин
    var checkTimer = setInterval(function() {
        // Проверяем, есть ли в фоне активный торрент-хэш в плеере Lampa
        var data = Lampa.Player && Lampa.Player.data ? Lampa.Player.data() : null;
        
        if (data && data.torrent_hash) {
            // Если логгера на экране еще нет — значит это либо первый запуск, либо Tizen пересоздал плеер на 2-й серии!
            if (!logElement) {
                screenLog('CHECKER', 'Обнаружен активный плеер без логгера. Переинициализация...');
                
                var playlist = Lampa.Player.playlist ? Lampa.Player.playlist() : null;
                var pIndex = Lampa.Player.index ? Lampa.Player.index() : 0;
                var currentItem = playlist ? playlist[pIndex] : null;

                var freshData = {
                    torrent_hash: data.torrent_hash,
                    id: currentItem ? (currentItem.id || pIndex) : pIndex,
                    path: currentItem ? (currentItem.path || '') : ''
                };

                startPluginLogic(freshData);
            }
        }
    }, 600);

    Lampa.Listener.follow('torrent_file', function (data) {
      if (data.type == 'list_open') list_opened = true;
      if (data.type == 'list_close') list_opened = false;
    });

})();
