(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;
    var last_loaded_id = null; // Запоминаем ID последней успешно обработанной серии

    function reguest(params, callback) {
      if (params.ffprobe && params.path.split('.').pop() !== 'mp4') {
        setTimeout(function () {
          callback({
            streams: params.ffprobe
          });
        }, 200);
      } else {
        if (connect_host == '{localhost}') connect_host = '185.204.0.61';
        var socket = new WebSocket('ws://' + connect_host + ':8080/?' + params.torrent_hash + '&index=' + params.id);
        socket.addEventListener('message', function (event) {
          socket.close();
          var json = {};

          try {
            json = JSON.parse(event.data);
          } catch (e) {}

          if (json.streams) callback(json);
        });
      }
    }

    // Вынесли функции парсинга и рендера в глобальную область видимости плагина
    function forceUpdateTracks(torrent_hash, episode_id, episode_path) {
      var video_data = {
        torrent_hash: torrent_hash,
        id: episode_id,
        path: episode_path || ''
      };

      reguest(video_data, function (result) {
        var video = Lampa.PlayerVideo.video();
        if (!video) return;

        var video_tracks = video.audioTracks || [];
        var video_subs = video.textTracks || [];

        // 1. ПАРСИМ И СТАВИМ ДОРОЖКИ
        var parse_tracks = result.streams.filter(function (a) { return a.codec_type == 'audio'; });
        var minus_track = 1;
        if (parse_tracks.length !== video_tracks.length) {
          parse_tracks = parse_tracks.filter(function (a) { return a.codec_name !== 'dts'; });
        }
        parse_tracks = parse_tracks.filter(function (a) { return a.tags; });

        var new_tracks = [];
        parse_tracks.forEach(function (track) {
          var orig = video_tracks[track.index - minus_track];
          var elem = {
            index: track.index - minus_track,
            language: track.tags.language,
            label: track.tags.title || track.tags.handler_name,
            ghost: orig ? false : true,
            selected: orig ? orig.selected == true || orig.enabled == true : false
          };
          Object.defineProperty(elem, "enabled", {
            set: function set(v) {
              if (v) {
                var aud = video.audioTracks || [];
                var trk = aud[elem.index];
                for (var i = 0; i < aud.length; i++) { aud[i].enabled = false; aud[i].selected = false; }
                if (trk) { trk.enabled = true; trk.selected = true; }
              }
            },
            get: function get() {}
          });
          new_tracks.push(elem);
        });
        if (new_tracks.length) Lampa.PlayerPanel.setTracks(new_tracks);

        // 2. ПАРСИМ И СТАВИМ СУБТИТРЫ
        var parse_subs = result.streams.filter(function (a) { return a.codec_type == 'subtitle'; });
        var minus_sub = parse_tracks.length + 1;
        parse_subs = parse_subs.filter(function (a) { return a.tags; });

        var new_subs = [];
        parse_subs.forEach(function (track) {
          var orig = video_subs[track.index - minus_sub];
          var elem = {
            index: track.index - minus_sub,
            language: track.tags.language,
            label: track.tags.title || track.tags.handler_name,
            ghost: orig ? false : true,
            selected: orig ? orig.selected == true || orig.mode == 'showing' : false
          };
          Object.defineProperty(elem, "mode", {
            set: function set(v) {
              if (v) {
                var txt = video.textTracks || [];
                var sub = txt[elem.index];
                for (var i = 0; i < txt.length; i++) { txt[i].mode = 'disabled'; txt[i].selected = false; }
                if (sub) { sub.mode = 'showing'; sub.selected = true; }
              }
            },
            get: function get() {}
          });
          new_subs.push(elem);
        });
        if (new_subs.length) Lampa.PlayerPanel.setSubs(new_subs);
      });
    }

    // ХУК НА ОТКРЫТИЕ И ПЕРЕКЛЮЧЕНИЕ ПЛЕЕРА
    // Каждый раз, когда Tizen запускает видео или переключает серию, Lampa обновляет панель управления.
    var base_panel_init = Lampa.PlayerPanel.init;
    Lampa.PlayerPanel.init = function () {
        // Вызываем родной метод Lampa, чтобы не сломать интерфейс
        base_panel_init.apply(this, arguments);

        // Проверяем, играет ли сейчас торрент
        var current_player_data = Lampa.Player && Lampa.Player.data ? Lampa.Player.data() : null;
        if (current_player_data && current_player_data.torrent_hash) {
            
            var playlist = Lampa.Player.playlist ? Lampa.Player.playlist() : null;
            var current_index = Lampa.Player.index ? Lampa.Player.index() : 0;
            var current_item = playlist ? playlist[current_index] : null;
            
            var real_id = current_item ? (current_item.id || current_index) : current_index;

            // Если этот ID серии мы еще не обрабатывали в этой сессии плеера — делаем запрос!
            if (last_loaded_id !== real_id) {
                last_loaded_id = real_id;
                
                // Даем Tizen 400мс на загрузку дорожек видеопотока, затем накатываем переводы
                setTimeout(function() {
                    forceUpdateTracks(
                        current_player_data.torrent_hash, 
                        real_id, 
                        current_item ? current_item.path : ''
                    );
                }, 400);
            }
        }
    };

    // Обнуляем кэш ID при полном выходе из плеера
    Lampa.Player.listener.follow('destroy', function() {
        last_loaded_id = null;
    });

    // --- Логика для вкладки "Инфо" в списке файлов торрента (осталась без изменений) ---
    function parseMetainfo(data) {
      var loading = Lampa.Template.get('tracks_loading');
      data.item.after(loading);
      reguest(data.element, function (result) {
        if (list_opened) {
          var append = function append(name, fields) {
            if (fields.length) {
              var block = Lampa.Template.get('tracks_metainfo_block', {});
              block.find('.tracks-metainfo__label').text(Lampa.Lang.translate(name == 'video' ? 'extensions_hpu_video' : name == 'audio' ? 'player_tracks' : 'player_' + name));
              fields.forEach(function (data) {
                var item = $('<div class="tracks-metainfo__item tracks-metainfo__item--' + name + ' selector"></div>');
                item.on('hover:focus', function (e) {
                  Lampa.Modal.scroll().update(item);
                });

                for (var i in data) {
                  var div = $('<div class="tracks-metainfo__column--' + i + '"></div>');
                  div.text(data[i]);
                  item.append(div);
                }

                block.find('.tracks-metainfo__info').append(item);
              });
              html.append(block);
            }
          };

          var video = [];
          var audio = [];
          var subs = [];
          var codec_video = result.streams.filter(function (a) { return a.codec_type == 'video'; });
          var codec_audio = result.streams.filter(function (a) { return a.codec_type == 'audio'; });
          var codec_subs = result.streams.filter(function (a) { return a.codec_type == 'subtitle'; });
          
          codec_video.slice(0, 1).forEach(function (v) {
            var line = {};
            if (v.width && v.height) line.video = v.width + 'х' + v.height;
            if (v.duration) {
              line.duration = new Date(v.duration * 1000).toISOString().slice(11, 19);
            } else if (v.tags) {
              if (v.tags.DURATION) {
                line.duration = v.tags.DURATION ? v.tags.DURATION.split(".") : '';
                line.duration.pop();
              } else if (v.tags["DURATION-eng"]) {
                line.duration = v.tags["DURATION-eng"] ? v.tags["DURATION-eng"].split(".") : '';
                line.duration.pop();
              }
            }
            if (v.codec_name) line.codec = v.codec_name.toUpperCase();
            if (Boolean(v.is_avc)) line.avc = 'AVC';
            var bit = v.bit_rate ? v.bit_rate : v.tags && (v.tags.BPS || v.tags["BPS-eng"]) ? v.tags.BPS || v.tags["BPS-eng"] : '--';
            line.rate = bit == '--' ? bit : Math.round(bit / 1000000) + ' ' + Lampa.Lang.translate('speed_mb');
            if (Lampa.Arrays.getKeys(line).length) video.push(line);
          });
          
          codec_audio.forEach(function (a, i) {
            var line = { num: i + 1 };
            if (a.tags) { line.lang = (a.tags.language || '').toUpperCase(); }
            line.name = a.tags ? a.tags.title || a.tags.handler_name : '';
            if (a.codec_name) line.codec = a.codec_name.toUpperCase();
            if (a.channel_layout) line.channels = a.channel_layout.replace('(side)', '').replace('stereo', '2.0').replace('8 channels (FL+FR+FC+LFE+SL+SR+TFL+TFR)', '7.1');
            var bit = a.bit_rate ? a.bit_rate : a.tags && (a.tags.BPS || a.tags["BPS-eng"]) ? a.tags.BPS || a.tags["BPS-eng"] : '--';
            line.rate = bit == '--' ? bit : Math.round(bit / 1000) + ' ' + Lampa.Lang.translate('speed_kb');
            if (Lampa.Arrays.getKeys(line).length) audio.push(line);
          });

          codec_subs.forEach(function (a, i) {
            var line = { num: i + 1 };
            if (a.tags) { line.lang = (a.tags.language || '').toUpperCase(); }
            line.name = a.tags ? a.tags.title || a.tags.handler_name : '';
            if (a.codec_name) line.codec = a.codec_name.toUpperCase().replace('SUBRIP', 'SRT').replace('HDMV_PGS_SUBTITLE', 'HDMV PGS').replace('MOV_TEXT', 'MOV TEXT');
            if (Lampa.Arrays.getKeys(line).length) subs.push(line);
          });

          var html = Lampa.Template.get('tracks_metainfo', {});
          append('video', video);
          append('audio', audio);
          append('subs', subs);
          loading.remove();

          if (video.length || audio.length || subs.length) {
            data.item.after(html);
          }
          if (Lampa.Controller.enabled().name == 'modal') Lampa.Controller.toggle('modal');
        }
      });
    }

    Lampa.Listener.follow('torrent_file', function (data) {
      if (data.type == 'list_open') list_opened = true;
      if (data.type == 'list_close') list_opened = false;
      if (data.type == 'render' && data.items.length == 1 && list_opened) {
        parseMetainfo(data);
      }
    });

    Lampa.Template.add('tracks_loading', "\n    <div class=\"tracks-loading\">\n        <span>#{loading}...</span>\n    </div>\n");
    Lampa.Template.add('tracks_metainfo', "\n    <div class=\"tracks-metainfo\"></div>\n");
    Lampa.Template.add('tracks_metainfo_block', "\n    <div class=\"tracks-metainfo__line\">\n        <div class=\"tracks-metainfo__label\"></div>\n        <div class=\"tracks-metainfo__info\"></div>\n    </div>\n");
    Lampa.Template.add('tracks_css', "\n    <style>\n    .tracks-loading{margin-top:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;-moz-box-align:start;-ms-flex-align:start;align-items:flex-start}.tracks-loading:before{content:'';display:inline-block;width:1.3em;height:1.3em;background:url('./img/loader.svg') no-repeat 50% 50%;-webkit-background-size:contain;-moz-background-size:contain;-o-background-size:contain;background-size:contain;margin-right:.4em}.tracks-loading>span{font-size:1.1em;line-height:1.1}.tracks-metainfo{margin-top:1em}.tracks-metainfo__line+.tracks-metainfo__line{margin-top:2em}.tracks-metainfo__label{opacity:.5;font-weight:600}.tracks-metainfo__info{padding-top:1em;line-height:1.2}.tracks-metainfo__info>div{background-color:rgba(0,0,0,0.22);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-border-radius:.3em;-moz-border-radius:.3em;border-radius:.3em;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.tracks-metainfo__info>div.focus{background-color:rgba(255,255,255,0.06)}.tracks-metainfo__info>div>div{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.tracks-metainfo__info>div>div:not(:last-child){padding-right:1.5em}.tracks-metainfo__info>div+div{margin-top:1em}.tracks-metainfo__column--video,.tracks-metainfo__column--name{margin-right:auto}.tracks-metainfo__column--num{min-width:3em;padding-right:0}.tracks-metainfo__column--rate{min-width:7em;text-align:right}.tracks-metainfo__column--channels{min-width:5em;text-align:right}\n    </style>\n");
    $('body').append(Lampa.Template.get('tracks_css', {}, true));

})();
