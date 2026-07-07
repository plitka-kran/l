(function () {
    'use strict';

    var connect_host = '{localhost}';
    var list_opened = false;
    var currentPlayerId = null;
    var lastData = null;
    var DEBUG = true;
    var streamCache = {}; // Кэш для потоков
    
    // Создаем систему логов
    var LogSystem = {
        logs: [],
        maxLogs: 100,
        container: null,
        isVisible: true,
        initialized: false,

        init: function() {
            if (this.initialized) return;
            
            this.container = $('<div id="tracks-debug-log" style="position:fixed;bottom:100px;right:10px;width:500px;max-height:400px;background:rgba(0,0,0,0.95);color:#0f0;font-family:monospace;font-size:11px;padding:10px;border-radius:8px;z-index:99999;overflow:hidden;border:2px solid #0f0;box-shadow:0 0 30px rgba(0,255,0,0.2);"></div>');
            
            var header = $('<div style="display:flex;justify-content:space-between;margin-bottom:5px;cursor:move;user-select:none;border-bottom:2px solid #0f0;padding-bottom:5px;">' +
                '<span style="color:#0f0;font-weight:bold;font-size:13px;">🔍 TRACKS DEBUG 3</span>' +
                '<div>' +
                '<button id="debug-clear" style="background:none;border:none;color:#0f0;cursor:pointer;margin-right:10px;font-size:14px;" title="Очистить логи">🗑️</button>' +
                '<button id="debug-toggle" style="background:none;border:none;color:#0f0;cursor:pointer;margin-right:10px;font-size:14px;" title="Свернуть/развернуть">⬇️</button>' +
                '<button id="debug-close" style="background:none;border:none;color:#f00;cursor:pointer;font-size:14px;" title="Закрыть окно">✕</button>' +
                '</div>' +
                '</div>');
            
            var messages = $('<div id="debug-messages" style="overflow-y:auto;max-height:320px;padding-right:5px;"></div>');
            
            this.container.append(header);
            this.container.append(messages);
            $('body').append(this.container);
            
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
                if (dataStr.length > 300) {
                    dataStr = dataStr.substring(0, 300) + '...';
                }
                var dataElement = $('<pre style="margin:2px 0 2px 50px;color:#ff0;font-size:10px;background:rgba(255,255,255,0.05);padding:2px 5px;border-radius:3px;max-height:80px;overflow:auto;white-space:pre-wrap;">' + dataStr + '</pre>');
                msgElement.append(dataElement);
            }
            
            var container = $('#debug-messages');
            container.append(msgElement);
            container.scrollTop(container[0].scrollHeight);
            
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

    // Функция для извлечения хэша из URL
    function extractHashFromUrl(url) {
        if (!url) return null;
        
        log('🔍', 'Extracting hash from URL:', url);
        
        // Ищем hash в параметрах link
        var linkMatch = url.match(/[?&]link=([a-f0-9]{40})/i);
        if (linkMatch) {
            log('🔍', 'Found hash in link parameter:', linkMatch[1]);
            return linkMatch[1];
        }
        
        // Ищем hash в параметрах hash
        var hashMatch = url.match(/[?&]hash=([a-f0-9]{40})/i);
        if (hashMatch) {
            log('🔍', 'Found hash in hash parameter:', hashMatch[1]);
            return hashMatch[1];
        }
        
        // Ищем hash в пути
        var pathMatch = url.match(/\/([a-f0-9]{40})\./i);
        if (pathMatch) {
            log('🔍', 'Found hash in path:', pathMatch[1]);
            return pathMatch[1];
        }
        
        // Ищем hash как 40 символов hex
        var hexMatch = url.match(/([a-f0-9]{40})/i);
        if (hexMatch) {
            log('🔍', 'Found hex hash:', hexMatch[1]);
            return hexMatch[1];
        }
        
        log('🔍', 'No hash found in URL');
        return null;
    }

    // Функция для создания фейковых данных о потоках
    function generateFakeStreams(video) {
        log('🔧', 'Generating fake streams for video');
        
        var streams = [];
        var audioTracks = video.audioTracks || [];
        var textTracks = video.textTracks || [];
        
        // Создаем фейковые аудио потоки
        audioTracks.forEach(function(track, index) {
            var stream = {
                index: index + 1,
                codec_type: 'audio',
                codec_name: track.label || 'unknown',
                tags: {
                    language: track.language || 'und',
                    title: track.label || 'Audio Track ' + (index + 1),
                    handler_name: track.label || 'Audio Track ' + (index + 1)
                }
            };
            streams.push(stream);
        });
        
        // Создаем фейковые субтитры
        textTracks.forEach(function(track, index) {
            var stream = {
                index: audioTracks.length + index + 1,
                codec_type: 'subtitle',
                codec_name: 'subrip',
                tags: {
                    language: track.language || 'und',
                    title: track.label || 'Subtitle ' + (index + 1),
                    handler_name: track.label || 'Subtitle ' + (index + 1)
                }
            };
            streams.push(stream);
        });
        
        log('🔧', 'Generated fake streams:', streams.length);
        return streams;
    }

    function reguest(params, callback) {
      log('📡', 'Request started:', params);
      
      // Если нет torrent_hash, но есть URL, пробуем извлечь хэш
      if (!params.torrent_hash && params.url) {
        var extractedHash = extractHashFromUrl(params.url);
        if (extractedHash) {
          log('📡', 'Extracted hash from URL:', extractedHash);
          params.torrent_hash = extractedHash;
        }
      }
      
      // Если все еще нет torrent_hash, пробуем использовать ffprobe
      if (!params.torrent_hash && params.ffprobe) {
        log('📡', 'Using ffprobe data without hash');
        setTimeout(function () {
          callback({
            streams: params.ffprobe
          });
        }, 200);
        return;
      }
      
      // Проверяем кэш
      if (params.torrent_hash && streamCache[params.torrent_hash]) {
        log('📡', 'Using cached streams for hash:', params.torrent_hash);
        callback({ streams: streamCache[params.torrent_hash] });
        return;
      }
      
      if (params.ffprobe && params.path && params.path.split('.').pop() !== 'mp4') {
        log('📡', 'Using ffprobe data');
        setTimeout(function () {
          callback({
            streams: params.ffprobe
          });
        }, 200);
      } else if (params.torrent_hash) {
        if (connect_host == '{localhost}') connect_host = '185.204.0.61';
        var wsUrl = 'ws://' + connect_host + ':8080/?' + params.torrent_hash + '&index=' + (params.id || 0);
        log('📡', 'WebSocket URL:', wsUrl);
        
        var socket = new WebSocket(wsUrl);
        var timeout = setTimeout(function() {
          log('📡', 'WebSocket timeout, using fallback');
          socket.close();
          // Используем ffprobe если есть, иначе генерируем фейк
          if (params.ffprobe) {
            callback({ streams: params.ffprobe });
          } else {
            // Пробуем получить данные из видео
            var video = Lampa.PlayerVideo.video();
            if (video) {
              var fakeStreams = generateFakeStreams(video);
              callback({ streams: fakeStreams });
            } else {
              callback({ streams: [] });
            }
          }
        }, 5000);
        
        socket.addEventListener('message', function (event) {
          clearTimeout(timeout);
          log('📡', 'WebSocket message received');
          socket.close();
          var json = {};

          try {
            json = JSON.parse(event.data);
            log('📡', 'Parsed JSON:', json);
          } catch (e) {
            errorLog('Failed to parse JSON:', e);
          }

          if (json.streams && json.streams.length > 0) {
            log('📡', 'Streams received:', json.streams.length);
            // Сохраняем в кэш
            if (params.torrent_hash) {
              streamCache[params.torrent_hash] = json.streams;
            }
            callback(json);
          } else {
            warnLog('No streams in response');
            // Пробуем использовать ffprobe если есть
            if (params.ffprobe) {
              log('📡', 'Falling back to ffprobe');
              callback({ streams: params.ffprobe });
            } else {
              // Генерируем фейк
              var video = Lampa.PlayerVideo.video();
              if (video) {
                var fakeStreams = generateFakeStreams(video);
                callback({ streams: fakeStreams });
              } else {
                callback({ streams: [] });
              }
            }
          }
        });
        
        socket.addEventListener('error', function(e) {
          clearTimeout(timeout);
          errorLog('WebSocket error:', e);
          // При ошибке пробуем использовать ffprobe
          if (params.ffprobe) {
            log('📡', 'Falling back to ffprobe after error');
            callback({ streams: params.ffprobe });
          } else {
            var video = Lampa.PlayerVideo.video();
            if (video) {
              var fakeStreams = generateFakeStreams(video);
              callback({ streams: fakeStreams });
            } else {
              callback({ streams: [] });
            }
          }
        });
        
        socket.addEventListener('open', function() {
          log('📡', 'WebSocket opened');
        });
      } else {
        warnLog('No torrent_hash or ffprobe available');
        // Пробуем найти hash в данных
        if (params.url) {
          var hash = extractHashFromUrl(params.url);
          if (hash) {
            log('📡', 'Retrying with extracted hash:', hash);
            params.torrent_hash = hash;
            reguest(params, callback);
            return;
          }
        }
        // Если ничего не помогло, генерируем фейк
        var video = Lampa.PlayerVideo.video();
        if (video) {
          var fakeStreams = generateFakeStreams(video);
          callback({ streams: fakeStreams });
        } else {
          callback({ streams: [] });
        }
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

      if (!data || !data.streams || data.streams.length === 0) {
        warnLog('No data or streams provided, generating fake');
        data = { streams: generateFakeStreams(video) };
      }

      var parse_tracks = data.streams.filter(function (a) {
        return a.codec_type == 'audio';
      });
      log('🔄', 'Parsed audio tracks:', parse_tracks.length);

      if (parse_tracks.length === 0) {
        warnLog('No parsed audio tracks found, generating fake');
        parse_tracks = video_tracks.map(function(track, index) {
          return {
            index: index + 1,
            codec_type: 'audio',
            codec_name: track.label || 'unknown',
            tags: {
              language: track.language || 'und',
              title: track.label || 'Audio Track ' + (index + 1),
              handler_name: track.label || 'Audio Track ' + (index + 1)
            }
          };
        });
        log('🔄', 'Generated fake audio tracks:', parse_tracks.length);
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
        var orig = video_tracks[track.index - minus] || video_tracks[index];
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

      if (!data || !data.streams || data.streams.length === 0) {
        warnLog('No data or streams provided for subs, generating fake');
        data = { streams: generateFakeStreams(video) };
      }

      var video_subs = video.textTracks || [];
      log('🔄', 'Video text tracks:', video_subs.length);

      var parse_subs = data.streams.filter(function (a) {
        return a.codec_type == 'subtitle';
      });
      log('🔄', 'Parsed subtitle tracks:', parse_subs.length);

      if (parse_subs.length === 0) {
        warnLog('No parsed subtitle tracks found, generating fake');
        parse_subs = video_subs.map(function(track, index) {
          return {
            index: index + 1,
            codec_type: 'subtitle',
            codec_name: 'subrip',
            tags: {
              language: track.language || 'und',
              title: track.label || 'Subtitle ' + (index + 1),
              handler_name: track.label || 'Subtitle ' + (index + 1)
            }
          };
        });
        log('🔄', 'Generated fake subtitle tracks:', parse_subs.length);
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
        var orig = video_subs[track.index - minus] || video_subs[index];
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
      
      // Создаем ID даже если нет torrent_hash
      var playerId = data.torrent_hash ? data.torrent_hash + '_' + (data.id || 0) : 'direct_' + Date.now();
      if (data.url) {
        var hashFromUrl = extractHashFromUrl(data.url);
        if (hashFromUrl) {
          playerId = hashFromUrl + '_' + (data.id || 0);
          data.torrent_hash = hashFromUrl;
        }
      }
      
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
        if (inited_parse && inited_parse.streams) {
          log('🎵', 'inited_parse exists');
          var new_tracks = [];
          var video_tracks = getTracks();
          var parse_tracks = inited_parse.streams.filter(function (a) {
            return a.codec_type == 'audio';
          });
          var minus = 1;
          
          log('🎵', 'Video tracks:', video_tracks.length);
          log('🎵', 'Parsed tracks:', parse_tracks.length);
          
          if (parse_tracks.length === 0) {
            log('🎵', 'No parsed tracks, generating from video');
            parse_tracks = video_tracks.map(function(track, index) {
              return {
                index: index + 1,
                codec_type: 'audio',
                codec_name: track.label || 'unknown',
                tags: {
                  language: track.language || 'und',
                  title: track.label || 'Audio Track ' + (index + 1),
                  handler_name: track.label || 'Audio Track ' + (index + 1)
                }
              };
            });
            log('🎵', 'Generated tracks:', parse_tracks.length);
          }
          
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
          
          parse_tracks.forEach(function (track, index) {
            var orig = video_tracks[track.index - minus] || video_tracks[index];
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
          // Пробуем получить данные из видео напрямую
          var video = Lampa.PlayerVideo.video();
          if (video) {
            log('🎵', 'Trying to generate tracks from video directly');
            var fakeData = { streams: generateFakeStreams(video) };
            inited_parse = fakeData;
            setTracks();
          }
        }
      }

      function setSubs() {
        log('📝', 'setSubs called');
        if (inited_parse && inited_parse.streams) {
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
          
          if (parse_subs.length === 0) {
            log('📝', 'No parsed subs, generating from video');
            parse_subs = video_subs.map(function(track, index) {
              return {
                index: index + 1,
                codec_type: 'subtitle',
                codec_name: 'subrip',
                tags: {
                  language: track.language || 'und',
                  title: track.label || 'Subtitle ' + (index + 1),
                  handler_name: track.label || 'Subtitle ' + (index + 1)
                }
              };
            });
            log('📝', 'Generated subs:', parse_subs.length);
          }
          
          parse_subs = parse_subs.filter(function (a) {
            return a.tags;
          });
          
          log('📝', 'Filtered subs:', parse_subs.length);
          
          parse_subs.forEach(function (track, index) {
            var orig = video_subs[track.index - minus] || video_subs[index];
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
        } else {
          warnLog('inited_parse is false or empty');
          var video = Lampa.PlayerVideo.video();
          if (video) {
            log('📝', 'Trying to generate subs from video directly');
            var fakeData = { streams: generateFakeStreams(video) };
            inited_parse = fakeData;
            setSubs();
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
            warnLog('No parsed data available, generating');
            var video = Lampa.PlayerVideo.video();
            if (video) {
              var fakeData = { streams: generateFakeStreams(video) };
              inited_parse = fakeData;
              forceUpdateTracks(fakeData);
              forceUpdateSubs(fakeData);
            }
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
        if (inited_parse && inited_parse.streams) {
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
        if (inited_parse && inited_parse.streams) {
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
          log('📡', 'Data received from
