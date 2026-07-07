(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;
    var currentPlayerId = null;
    var lastData = null;
    var DEBUG = true;
    
    // Создаем систему логов
    var LogSystem = {
        logs: [],
        maxLogs: 100,
        container: null,
        isVisible: true,
        initialized: false,

        init: function() {
            if (this.initialized) return;
            
            // Создаем контейнер для логов
            this.container = $('<div id="tracks-debug-log" style="position:fixed;bottom:10px;right:10px;width:450px;max-height:350px;background:rgba(0,0,0,0.95);color:#0f0;font-family:monospace;font-size:11px;padding:10px;border-radius:8px;z-index:99999;overflow:hidden;border:2px solid #0f0;box-shadow:0 0 30px rgba(0,255,0,0.2);"></div>');
            
            // Заголовок с кнопками
            var header = $('<div style="display:flex;justify-content:space-between;margin-bottom:5px;cursor:move;user-select:none;border-bottom:2px solid #0f0;padding-bottom:5px;">' +
                '<span style="color:#0f0;font-weight:bold;font-size:13px;">🔍 TRACKS DEBUG</span>' +
                '<div>' +
                '<button id="debug-clear" style="background:none;border:none;color:#0f0;cursor:pointer;margin-right:10px;font-size:14px;" title="Очистить логи">🗑️</button>' +
                '<button id="debug-toggle" style="background:none;border:none;color:#0f0;cursor:pointer;margin-right:10px;font-size:14px;" title="Свернуть/развернуть">⬇️</button>' +
                '<button id="debug-close" style="background:none;border:none;color:#f00;cursor:pointer;font-size:14px;" title="Закрыть окно">✕</button>' +
                '</div>' +
                '</div>');
            
            // Контейнер для сообщений
            var messages = $('<div id="debug-messages" style="overflow-y:auto;max-height:270px;padding-right:5px;"></div>');
            
            this.container.append(header);
            this.container.append(messages);
            $('body').append(this.container);
            
            // Кнопки управления
            $('#debug-clear').on('click', function() {
                $('#debug-messages').empty();
                LogSystem.logs = [];
                LogSystem.log('🗑️', 'Logs cleared');
            });
            
            $('#debug-toggle').on('click', function() {
                var msgs = $('#debug-messages');
                if (msgs.is(':visible')) {
                    msgs.hide();
                    $(this).text('⬆️');
                } else {
                    msgs.show();
                    $(this).text('⬇️');
                }
            });
            
            $('#debug-close').on('click', function() {
                LogSystem.container.toggle();
                LogSystem.isVisible = !LogSystem.isVisible;
            });
            
            // Перетаскивание окна
            var isDragging = false;
            var offsetX, offsetY;
            
            header.on('mousedown', function(e) {
                isDragging = true;
                offsetX = e.clientX - LogSystem.container.offset().left;
                offsetY = e.clientY - LogSystem.container.offset().top;
                LogSystem.container.css('cursor', 'grabbing');
            });
            
            $(document).on('mousemove', function(e) {
                if (isDragging) {
                    var x = e.clientX - offsetX;
                    var y = e.clientY - offsetY;
                    LogSystem.container.css({
                        left: x + 'px',
                        right: 'auto',
                        bottom: 'auto',
                        top: y + 'px'
                    });
                }
            });
            
            $(document).on('mouseup', function() {
                isDragging = false;
                LogSystem.container.css('cursor', 'default');
            });
            
            this.initialized = true;
            this.log('🚀', 'Debug log system initialized');
        },

        log: function(icon, message, data) {
            if (!DEBUG) return;
            
            this.init();
            
            var timestamp = new Date().toLocaleTimeString();
            var msg = {
                icon: icon,
                message: message,
                data: data,
                timestamp: timestamp
            };
            
            this.logs.push(msg);
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
                $('#debug-messages div:first-child').remove();
            }
            
            var msgElement = $('<div style="padding:3px 0;border-bottom:1px solid rgba(0,255,0,0.08);word-wrap:break-word;display:flex;align-items:flex-start;">' +
                '<span style="color:#666;margin-right:5px;white-space:nowrap;font-size:10px;">[' + timestamp + ']</span>' +
                '<span style="margin-right:5px;flex-shrink:0;">' + icon + '</span>' +
                '<span style="flex:1;word-break:break-all;">' + message + '</span>' +
                '</div>');
            
            if (data) {
                var dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
                if (dataStr.length > 200) {
                    dataStr = dataStr.substring(0, 200) + '...';
                }
                var dataElement = $('<pre style="margin:2px 0 2px 50px;color:#ff0;font-size:10px;background:rgba(255,255,255,0.05);padding:2px 5px;border-radius:3px;max-height:80px;overflow:auto;white-space:pre-wrap;">' + dataStr + '</pre>');
                msgElement.append(dataElement);
            }
            
            var container = $('#debug-messages');
            container.append(msgElement);
            container.scrollTop(container[0].scrollHeight);
            
            // Также выводим в консоль
            console.log('🔍 [' + timestamp + ']', icon, message, data || '');
        },

        error: function(message, data) {
            this.log('❌', message, data);
        },

        warn: function(message, data) {
            this.log('⚠️', message, data);
        },

        info: function(message, data) {
            this.log('ℹ️', message, data);
        },

        success: function(message, data) {
            this.log('✅', message, data);
        },

        clear: function() {
            $('#debug-messages').empty();
            this.logs = [];
        }
    };

    // Заменяем старые функции логов на новые
    function log() {
        if (DEBUG) {
            var args = Array.prototype.slice.call(arguments);
            var icon = args.shift() || '🔍';
            var message = args.shift() || '';
            var data = args.length > 0 ? args[0] : null;
            LogSystem.log(icon, message, data);
        }
    }

    function errorLog() {
        if (DEBUG) {
            var args = Array.prototype.slice.call(arguments);
            var message = args.shift() || '';
            var data = args.length > 0 ? args[0] : null;
            LogSystem.error(message, data);
        }
    }

    function warnLog() {
        if (DEBUG) {
            var args = Array.prototype.slice.call(arguments);
            var message = args.shift() || '';
            var data = args.length > 0 ? args[0] : null;
            LogSystem.warn(message, data);
        }
    }

    function reguest(params, callback) {
      log('📡', 'Request started:', params);
      
      if (params.ffprobe && params.path.split('.').pop() !== 'mp4') {
        log('📡', 'Using ffprobe data');
        setTimeout(function () {
          callback({
            streams: params.ffprobe
          });
        }, 200);
      } else {
        if (connect_host == '{localhost}') connect_host = '185.204.0.61';
        var wsUrl = 'ws://' + connect_host + ':8080/?' + params.torrent_hash + '&index=' + params.id;
        log('📡', 'WebSocket URL:', wsUrl);
        
        var socket = new WebSocket(wsUrl);
        socket.addEventListener('message', function (event) {
          log('📡', 'WebSocket message received');
          socket.close();
          var json = {};

          try {
            json = JSON.parse(event.data);
            log('📡', 'Parsed JSON:', json);
          } catch (e) {
            errorLog('Failed to parse JSON:', e);
          }

          if (json.streams) {
            log('📡', 'Streams received:', json.streams.length);
            callback(json);
          } else {
            warnLog('No streams in response');
          }
        });
        
        socket.addEventListener('error', function(e) {
          errorLog('WebSocket error:', e);
        });
        
        socket.addEventListener('open', function() {
          log('📡', 'WebSocket opened');
        });
      }
    }

    function forceUpdateTracks(data) {
      log('🔄', 'Force update tracks called');
      
      var video = Lampa.PlayerVideo.video();
      if (!video) {
        warnLog('No video element found');
        return;
      }
      log('🔄', 'Video element found');

      var video_tracks = video.audioTracks || [];
      log('🔄', 'Video audio tracks:', video_tracks.length);

      if (!data || !data.streams) {
        warnLog('No data or streams provided');
        return;
      }

      var parse_tracks = data.streams.filter(function (a) {
        return a.codec_type == 'audio';
      });
      log('🔄', 'Parsed audio tracks:', parse_tracks.length);

      if (parse_tracks.length === 0) {
        warnLog('No parsed audio tracks found');
        return;
      }

      var minus = 1;
      var new_tracks = [];

      if (parse_tracks.length !== video_tracks.length) {
        log('🔄', 'Track count mismatch, filtering...');
        parse_tracks = parse_tracks.filter(function (a) {
          return a.codec_name !== 'dts';
        });
        log('🔄', 'After DTS filter:', parse_tracks.length);
      }

      parse_tracks = parse_tracks.filter(function (a) {
        return a.tags;
      });
      log('🔄', 'After tags filter:', parse_tracks.length);

      parse_tracks.forEach(function (track, index) {
        var orig = video_tracks[track.index - minus];
        log('🔄', 'Processing track:', {index: index, trackIndex: track.index, minus: minus});
        
        var elem = {
          index: track.index - minus,
          language: track.tags.language,
          label: track.tags.title || track.tags.handler_name,
          ghost: orig ? false : true,
          selected: orig ? orig.selected == true || orig.enabled == true : false
        };
        log('🔄', 'Created track element:', elem);

        Object.defineProperty(elem, "enabled", {
          set: function set(v) {
            if (v) {
              var aud = video.audioTracks || [];
              var trk = aud[elem.index];

              for (var i = 0; i < aud.length; i++) {
                aud[i].enabled = false;
                aud[i].selected = false;
              }

              if (trk) {
                trk.enabled = true;
                trk.selected = true;
              }
            }
          },
          get: function get() {}
        });
        new_tracks.push(elem);
      });

      if (parse_tracks.length) {
        log('🔄', 'Setting tracks:', new_tracks.length);
        Lampa.PlayerPanel.setTracks(new_tracks);
        LogSystem.success('Tracks updated successfully!');
      } else {
        warnLog('No tracks to set');
      }
    }

    function forceUpdateSubs(data) {
      log('🔄', 'Force update subs called');
      
      var video = Lampa.PlayerVideo.video();
      if (!video) {
        warnLog('No video element found for subs');
        return;
      }

      if (!data || !data.streams) {
        warnLog('No data or streams provided for subs');
        return;
      }

      var video_subs = video.textTracks || [];
      log('🔄', 'Video text tracks:', video_subs.length);

      var parse_subs = data.streams.filter(function (a) {
        return a.codec_type == 'subtitle';
      });
      log('🔄', 'Parsed subtitle tracks:', parse_subs.length);

      if (parse_subs.length === 0) {
        warnLog('No parsed subtitle tracks found');
        return;
      }

      var minus = data.streams.filter(function (a) {
        return a.codec_type == 'audio';
      }).length + 1;
      var new_subs = [];

      parse_subs = parse_subs.filter(function (a) {
        return a.tags;
      });
      log('🔄', 'After tags filter:', parse_subs.length);

      parse_subs.forEach(function (track, index) {
        var orig = video_subs[track.index - minus];
        log('🔄', 'Processing sub:', {index: index, trackIndex: track.index, minus: minus});
        
        var elem = {
          index: track.index - minus,
          language: track.tags.language,
          label: track.tags.title || track.tags.handler_name,
          ghost: video_subs[track.index - minus] ? false : true,
          selected: orig ? orig.selected == true || orig.mode == 'showing' : false
        };
        log('🔄', 'Created sub element:', elem);

        Object.defineProperty(elem, "mode", {
          set: function set(v) {
            if (v) {
              var txt = video.textTracks || [];
              var sub = txt[elem.index];

              for (var i = 0; i < txt.length; i++) {
                txt[i].mode = 'disabled';
                txt[i].selected = false;
              }

              if (sub) {
                sub.mode = 'showing';
                sub.selected = true;
              }
            }
          },
          get: function get() {}
        });
        new_subs.push(elem);
      });

      if (parse_subs.length) {
        log('🔄', 'Setting subs:', new_subs.length);
        Lampa.PlayerPanel.setSubs(new_subs);
        LogSystem.success('Subs updated successfully!');
      } else {
        warnLog('No subs to set');
      }
    }

    function subscribeTracks(data) {
      log('🎬', 'subscribeTracks called:', data);
      
      var inited = false;
      var inited_parse = false;
      var webos_replace = {};
      var playerId = data.torrent_hash + '_' + data.id;
      var isWebOS = navigator.userAgent.toLowerCase().includes('webos') || navigator.userAgent.toLowerCase().includes('tizen');

      log('🎬', 'Player ID:', playerId);
      log('🎬', 'Is WebOS:', isWebOS);

      lastData = data;

      function getTracks() {
        var video = Lampa.PlayerVideo.video();
        return video.audioTracks || [];
      }

      function getSubs() {
        var video = Lampa.PlayerVideo.video();
        return video.textTracks || [];
      }

      function setTracks() {
        log('🎵', 'setTracks called');
        if (inited_parse) {
          log('🎵', 'inited_parse exists');
          var new_tracks = [];
          var video_tracks = getTracks();
          var parse_tracks = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'audio';
          });
          var minus = 1;
          
          log('🎵', 'Video tracks:', video_tracks.length);
          log('🎵', 'Parsed tracks:', parse_tracks.length);
          
          if (parse_tracks.length !== video_tracks.length) {
            log('🎵', 'Track count mismatch, filtering DTS');
            parse_tracks = parse_tracks.filter(function (a) {
              return a.codec_name !== 'dts';
            });
          }
          
          parse_tracks = parse_tracks.filter(function (a) {
            return a.tags;
          });
          
          log('🎵', 'Filtered tracks:', parse_tracks.length);
          
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

                  for (var i = 0; i < aud.length; i++) {
                    aud[i].enabled = false;
                    aud[i].selected = false;
                  }

                  if (trk) {
                    trk.enabled = true;
                    trk.selected = true;
                  }
                }
              },
              get: function get() {}
            });
            new_tracks.push(elem);
          });
          
          if (parse_tracks.length) {
            log('🎵', 'Setting tracks:', new_tracks.length);
            Lampa.PlayerPanel.setTracks(new_tracks);
          } else {
            warnLog('No tracks to set');
          }
        } else {
          warnLog('inited_parse is false or empty');
        }
      }

      function setSubs() {
        log('📝', 'setSubs called');
        if (inited_parse) {
          var new_subs = [];
          var video_subs = getSubs();
          var parse_subs = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'subtitle';
          });
          var minus = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'audio';
          }).length + 1;
          
          log('📝', 'Video subs:', video_subs.length);
          log('📝', 'Parsed subs:', parse_subs.length);
          
          parse_subs = parse_subs.filter(function (a) {
            return a.tags;
          });
          
          log('📝', 'Filtered subs:', parse_subs.length);
          
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

                  for (var i = 0; i < txt.length; i++) {
                    txt[i].mode = 'disabled';
                    txt[i].selected = false;
                  }

                  if (sub) {
                    sub.mode = 'showing';
                    sub.selected = true;
                  }
                }
              },
              get: function get() {}
            });
            new_subs.push(elem);
          });
          
          if (parse_subs.length) {
            log('📝', 'Setting subs:', new_subs.length);
            Lampa.PlayerPanel.setSubs(new_subs);
          } else {
            warnLog('No subs to set');
          }
        }
      }

      function listenTimeUpdate() {
        var video = Lampa.PlayerVideo.video();
        if (video && video.currentTime < 0.5) {
          log('⏱️', 'Time near 0, checking for series change');
          if (inited_parse) {
            log('⏱️', 'Force updating tracks and subs');
            setTimeout(function() {
              forceUpdateTracks(inited_parse);
              forceUpdateSubs(inited_parse);
            }, 200);
          } else {
            warnLog('No parsed data available');
          }
        }
      }

      function listenTracks() {
        log('🎵', 'tracks video event triggered');
        setTracks();
        Lampa.PlayerVideo.listener.remove('tracks', listenTracks);
      }

      function listenSubs() {
        log('📝', 'subs video event triggered');
        setSubs();
        Lampa.PlayerVideo.listener.remove('subs', listenSubs);
      }

      function canPlay() {
        log('▶️', 'canplay video event triggered for', playerId);
        
        setTimeout(function() {
          log('▶️', 'Processing after canplay');
          if (webos_replace.tracks) {
            log('▶️', 'Using WebOS tracks');
            setWebosTracks(webos_replace.tracks);
          } else {
            log('▶️', 'Using standard tracks');
            setTracks();
          }
          
          if (webos_replace.subs) {
            log('▶️', 'Using WebOS subs');
            setWebosSubs(webos_replace.subs);
          } else {
            log('▶️', 'Using standard subs');
            setSubs();
          }
        }, 150);
        
        Lampa.PlayerVideo.listener.remove('canplay', canPlay);
      }

      function setWebosTracks(video_tracks) {
        log('🌐', 'WebOS set tracks called');
        if (inited_parse) {
          var parse_tracks = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'audio';
          });
          
          if (parse_tracks.length !== video_tracks.length) {
            parse_tracks = parse_tracks.filter(function (a) {
              return a.codec_name !== 'truehd';
            });

            if (parse_tracks.length !== video_tracks.length) {
              parse_tracks = parse_tracks.filter(function (a) {
                return a.codec_name !== 'dts';
              });
            }
          }

          parse_tracks = parse_tracks.filter(function (a) {
            return a.tags;
          });
          
          parse_tracks.forEach(function (track, i) {
            if (video_tracks[i]) {
              video_tracks[i].language = track.tags.language;
              video_tracks[i].label = track.tags.title || track.tags.handler_name;
            }
          });
        }
      }

      function setWebosSubs(video_subs) {
        log('🌐', 'WebOS set subs called');
        if (inited_parse) {
          var parse_subs = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'subtitle';
          });
          
          if (parse_subs.length !== video_subs.length - 1) {
            parse_subs = parse_subs.filter(function (a) {
              return a.codec_name !== 'hdmv_pgs_subtitle';
            });
          }
          
          parse_subs = parse_subs.filter(function (a) {
            return a.tags;
          });
          
          parse_subs.forEach(function (track, a) {
            var i = a + 1;

            if (video_subs[i]) {
              video_subs[i].language = track.tags.language;
              video_subs[i].label = track.tags.title || track.tags.handler_name;
            }
          });
        }
      }

      function listenWebosSubs(_data) {
        log('🌐', 'WebOS subs event received');
        webos_replace.subs = _data.subs;
        if (inited_parse) setWebosSubs(_data.subs);
      }

      function listenWebosTracks(_data) {
        log('🌐', 'WebOS tracks event received');
        webos_replace.tracks = _data.tracks;
        if (inited_parse) setWebosTracks(_data.tracks);
      }

      function listenStart() {
        log('▶️', 'listenStart called');
        inited = true;
        
        if (currentPlayerId && currentPlayerId !== playerId) {
          log('🔄', 'Player changed from', currentPlayerId, 'to', playerId);
          setTimeout(function() {
            if (inited_parse) {
              log('🔄', 'Force updating on player change');
              forceUpdateTracks(inited_parse);
              forceUpdateSubs(inited_parse);
            }
          }, 300);
        }
        currentPlayerId = playerId;

        log('📡', 'Requesting data from server...');
        reguest(data, function (result) {
          log('📡', 'Data received from server');
          inited_parse = result;
          log('📡', 'Parsed streams:', result.streams.length);

          if (inited) {
            log('📡', 'Processing received data');
            setTimeout(function() {
              if (webos_replace.subs) {
                log('📡', 'Setting WebOS subs');
                setWebosSubs(webos_replace.subs);
              } else {
                log('📡', 'Setting standard subs');
                setSubs();
              }
              if (webos_replace.tracks) {
                log('📡', 'Setting WebOS tracks');
                setWebosTracks(webos_replace.tracks);
              } else {
                log('📡', 'Setting standard tracks');
                setTracks();
              }
            }, 150);
          }
        });
      }

      function listenDestroy() {
        log('💀', 'Destroy event for', playerId);
        inited = false;
        currentPlayerId = null;
        Lampa.Player.listener.remove('destroy', listenDestroy);
        Lampa.PlayerVideo.listener.remove('tracks', listenTracks);
        Lampa.PlayerVideo.listener.remove('subs', listenSubs);
        Lampa.PlayerVideo.listener.remove('webos_subs', listenWebosSubs);
        Lampa.PlayerVideo.listener.remove('webos_tracks', listenWebosTracks);
        Lampa.PlayerVideo.listener.remove('canplay', canPlay);
        Lampa.PlayerVideo.listener.remove('timeupdate', listenTimeUpdate);
        log('💀', 'Cleanup complete');
      }

      log('🎬', 'Setting up listeners');
      Lampa.Player.listener.follow('destroy', listenDestroy);
      Lampa.PlayerVideo.listener.follow('tracks', listenTracks);
      Lampa.PlayerVideo.listener.follow('subs', listenSubs);
      Lampa.PlayerVideo.listener.follow('webos_subs', listenWebosSubs);
      Lampa.PlayerVideo.listener.follow('webos_tracks', listenWebosTracks);
      Lampa.PlayerVideo.listener.follow('canplay', canPlay);
      Lampa.PlayerVideo.listener.follow('timeupdate', listenTimeUpdate);
      
      listenStart();
    }

    // Глобальные функции для отладки
    window.forceUpdateTracks = function() {
      log('🌍', 'Global forceUpdateTracks called');
      if (lastData) {
        log('🌍', 'Last data exists, requesting fresh data');
        reguest(lastData, function(result) {
          log('🌍', 'Fresh data received, updating');
          forceUpdateTracks(result);
          forceUpdateSubs(result);
        });
      } else {
        warnLog('No last data available');
      }
    };

    window.toggleDebug = function() {
      DEBUG = !DEBUG;
      LogSystem.log('🔧', 'Debug mode:', DEBUG ? 'ON' : 'OFF');
      if (!DEBUG) {
        $('#tracks-debug-log').hide();
      } else {
        $('#tracks-debug-log').show();
      }
    };

    window.debugTracks = {
      getState: function() {
        var video = Lampa.PlayerVideo.video();
        var state = {
          hasVideo: !!video,
          audioTracks: video ? video.audioTracks : null,
          textTracks: video ? video.textTracks : null,
          currentPlayerId: currentPlayerId,
          lastData: lastData,
          list_opened: list_opened,
          debugMode: DEBUG
        };
        LogSystem.log('📊', 'Current state:', state);
        return state;
      },
      forceUpdate: function() {
        window.forceUpdateTracks();
      },
      logData: function() {
        var data = {
          currentPlayerId: currentPlayerId,
          lastData: lastData,
          list_opened: list_opened
        };
        LogSystem.log('📊', 'Debug data:', data);
        return data;
      },
      toggle: function() {
        window.toggleDebug();
      },
      clear: function() {
        LogSystem.clear();
      }
    };

    // parseMetainfo
    function parseMetainfo(data) {
      log('📊', 'parseMetainfo called');
      var loading = Lampa.Template.get('tracks_loading');
      data.item.after(loading);
      reguest(data.element, function (result) {
        if (list_opened) {
          log('📊', 'Processing metainfo');
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
          var codec_video = result.streams.filter(function (a) {
            return a.codec_type == 'video';
          });
          var codec_audio = result.streams.filter(function (a) {
            return a.codec_type == 'audio';
          });
          var codec_subs = result.streams.filter(function (a) {
            return a.codec_type == 'subtitle';
          });
          
          log('📊', 'Video streams:', codec_video.length);
          log('📊', 'Audio streams:', codec_audio.length);
          log('📊', 'Subtitle streams:', codec_subs.length);
          
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
            var line = {
              num: i + 1
            };

            if (a.tags) {
              line.lang = (a.tags.language || '').toUpperCase();
            }

            line.name = a.tags ? a.tags.title || a.tags.handler_name : '';
            if (a.codec_name) line.codec = a.codec_name.toUpperCase();
            if (a.channel_layout) line.channels = a.channel_layout.replace('(side)', '').replace('stereo', '2.0').replace('8 channels (FL+FR+FC+LFE+SL+SR+TFL+TFR)', '7.1');
            var bit = a.bit_rate ? a.bit_rate : a.tags && (a.tags.BPS || a.tags["BPS-eng"]) ? a.tags.BPS || a.tags["BPS-eng"] : '--';
            line.rate = bit == '--' ? bit : Math.round(bit / 1000) + ' ' + Lampa.Lang.translate('speed_kb');
            if (Lampa.Arrays.getKeys(line).length) audio.push(line);
          });
          
          codec_subs.forEach(function (a, i) {
            var line = {
              num: i + 1
            };

            if (a.tags) {
              line.lang = (a.tags.language || '').toUpperCase();
            }

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
            log('📊', 'Metainfo displayed');
          }

          if (Lampa.Controller.enabled().name == 'modal') Lampa.Controller.toggle('modal');
        }
      });
    }

    // Слушатели событий
    Lampa.Listener.follow('series_change', function(data) {
      log('📺', 'Series change detected:', data);
      if (window.forceUpdateTracks) {
        setTimeout(function() {
          log('📺', 'Forcing update after series change');
          window.forceUpdateTracks();
        }, 500);
      }
    });

    Lampa.Listener.follow('torrent_file', function(data) {
      log('📁', 'Torrent file event:', data.type);
      
      if (data.type == 'render' && data.items && data.items.length > 0) {
        log('📁', 'Render event with items:', data.items.length);
        setTimeout(function() {
          var items = $('.series-list .series-item, .torrent-item');
          log('📁', 'Found items:', items.length);
          
          items.off('click.series').on('click.series', function() {
            log('🖱️', 'Series item clicked');
            setTimeout(function() {
              if (window.forceUpdateTracks) {
                log('🖱️', 'Forcing update on click');
                window.forceUpdateTracks();
              }
            }, 600);
          });
        }, 100);
      }

      if (data.type == 'list_open') {
        log('📁', 'List opened');
        list_opened = true;
      }
      if (data.type == 'list_close') {
        log('📁', 'List closed');
        list_opened = false;
      }

      if (data.type == 'render' && data.items.length == 1 && list_opened) {
        log('📁', 'Rendering single item');
        parseMetainfo(data);
      }
    });

    Lampa.Player.listener.follow('start', function (data) {
      log('🎬', 'Player start event:', data);
      if (data.torrent_hash) {
        subscribeTracks(data);
      } else {
        warnLog('No torrent_hash in player start');
      }
    });

    // Добавляем шаблоны
    Lampa.Template.add('tracks_loading', "\n    <div class=\"tracks-loading\">\n        <span>#{loading}...</span>\n    </div>\n");
    Lampa.Template.add('tracks_metainfo', "\n    <div class=\"tracks-metainfo\"></div>\n");
    Lampa.Template.add('tracks_metainfo_block', "\n    <div class=\"tracks-metainfo__line\">\n        <div class=\"tracks-metainfo__label\"></div>\n        <div class=\"tracks-metainfo__info\"></div>\n    </div>\n");
    Lampa.Template.add('tracks_css', "\n    <style>\n    .tracks-loading{margin-top:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;-moz-box-align:start;-ms-flex-align:start;align-items:flex-start}.tracks-loading:before{content:'';display:inline-block;width:1.3em;height:1.3em;background:url('./img/loader.svg') no-repeat 50% 50%;-webkit-background-size:contain;-moz-background-size:contain;-o-background-size:contain;background-size:contain;margin-right:.4em}.tracks-loading>span{font-size:1.1em;line-height:1.1}.tracks-metainfo{margin-top:1em}.tracks-metainfo__line+.tracks-metainfo__line{margin-top:2em}.tracks-metainfo__label{opacity:.5;font-weight:600}.tracks-metainfo__info{padding-top:1em;line-height:1.2}.tracks-metainfo__info>div{background-color:rgba(0,0,0,0.22);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-border-radius:.3em;-moz-border-radius:.3em;border-radius:.3em;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.tracks-metainfo__info>div.focus{background-color:rgba(255,255,255,0.06)}.tracks-metainfo__info>div>div{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.tracks-metainfo__info>div>div:not(:last-child){padding-right:1.5em}.tracks-metainfo__info>div+div{margin-top:1em}.tracks-metainfo__column--video,.tracks-metainfo__column--name{margin-right:auto}.tracks-metainfo__column--num{min-width:3em;padding-right:0}.tracks-metainfo__column--rate{min-width:7em;text-align:right}.tracks-metainfo__column--channels{min-width:5em;text-align:right}\n    </style>\n");
    
    $('body').append(Lampa.Template.get('tracks_css', {}, true));

    // Инициализация
    LogSystem.init();
    LogSystem.success('🚀 Tracks script loaded successfully!');
    LogSystem.info('💡 Commands:');
    LogSystem.info('  • debugTracks.forceUpdate() - Force update tracks');
    LogSystem.info('  • debugTracks.getState() - Show current state');
    LogSystem.info('  • debugTracks.toggle() - Toggle debug window');
    LogSystem.info('  • debugTracks.clear() - Clear logs');
    LogSystem.info('  • toggleDebug() - Toggle debug mode');

    console.log('%c🔍 TRACKS DEBUG SCRIPT LOADED', 'font-size:16px;font-weight:bold;color:#0f0;');
    console.log('%cUse debugTracks.forceUpdate() to manually update tracks', 'color:#ff0;');
    console.log('%cUse debugTracks.getState() to check current state', 'color:#ff0;');

})();
