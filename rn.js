//27.09.2025 - Fix

(function () {
    'use strict';

    // --- 1. Удаляем трейлеры из карточек ---
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            e.object.activity.render().find('.view--trailer').remove();
        }
    });
    
    function startsWith(str, searchString) {
      return str.lastIndexOf(searchString, 0) === 0;
    }

    function endsWith(str, searchString) {
      var start = str.length - searchString.length;
      if (start < 0) return false;
      return str.indexOf(searchString, start) === start;
    }

    var myIp = '';

    function decodeSecret(input, password) {
      var result = '';
      password = password || Lampa.Storage.get('online_mod_secret_password', '') + '';

      if (input && password) {
        var hash = Lampa.Utils.hash(password);

        while (hash.length < input.length) {
          hash += hash;
        }

        var i = 0;

        while (i < input.length) {
          result += String.fromCharCode(input[i] ^ hash.charCodeAt(i));
          i++;
        }
      }

      return result;
    }

    function checkDebug() {
      var res = false;
      var origin = window.location.origin || '';
      decodeSecret([85, 77, 93, 87, 89, 71, 87, 30, 86, 89, 88, 88, 88, 81, 12, 70, 66, 80, 68, 89, 80, 24, 67, 68, 13, 92, 88, 90, 68, 88, 69, 92, 82, 24, 83, 90]).split(';').forEach(function (s) {
        res |= endsWith(origin, s);
      });
      return !res;
    }

    function isDebug() {
      return decodeSecret([83, 81, 83, 67, 83]) === 'debug' && checkDebug();
    }

    function isDebug2() {
      return decodeSecret([86, 81, 81, 71, 83]) === 'debug' || decodeSecret([92, 85, 91, 65, 84]) === 'debug';
    }

    function rezka2Mirror() {
      var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
      if (!url) return 'https://kvk.zone';
      if (url.indexOf('://') == -1) url = 'https://' + url;
      if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
      return url;
    }

    // Удалены функции: kinobaseMirror, setCurrentFanserialsHost, getCurrentFanserialsHost, fanserialsHost, fancdnHost, filmixHost$1, filmixAppHost, filmixToken, filmixUserAgent, vcdnToken

    function baseUserAgent() {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
    }

    function setMyIp(ip) {
      myIp = ip;
    }

    function getMyIp() {
      return myIp;
    }

    function checkMyIp$1(network, onComplite) {
      var ip = getMyIp();

      if (ip) {
        onComplite();
        return;
      }

      network.clear();
      network.timeout(10000);
      network.silent('https://api.ipify.org/?format=json', function (json) {
        if (json.ip) setMyIp(json.ip);
        onComplite();
      }, function (a, c) {
        network.clear();
        network.timeout(10000);
        network.silent(proxy('ip') + 'jsonip', function (json) {
          if (json.ip) setMyIp(json.ip);
          onComplite();
        }, function (a, c) {
          onComplite();
        });
      });
    }

    function proxy(name) {
      var ip = getMyIp() || '';
      var param_ip = Lampa.Storage.field('online_mod_proxy_find_ip') === true ? 'ip' + ip + '/' : '';
      var proxy1 = new Date().getHours() % 2 ? 'https://cors.nb557.workers.dev:8443/' : 'https://cors.fx666.workers.dev:8443/';
      var proxy2 = (window.location.protocol === 'https:' ? 'https://' : 'http://') + 'iqslgbok.deploy.cx/';
      var proxy3 = 'https://cors557.deno.dev/';
      var proxy_apn = '';
      var proxy_secret = '';
      var proxy_secret_ip = '';

      if (isDebug()) {
        proxy_apn = (window.location.protocol === 'https:' ? 'https://' : 'http://') + decodeSecret([64, 90, 72, 90, 92, 91, 87, 87, 23, 83, 81, 65, 90, 91, 78, 24, 83, 65, 24]);
        proxy_secret = decodeSecret([95, 64, 69, 70, 71, 13, 25, 31, 88, 71, 90, 28, 91, 86, 2, 3, 6, 23, 92, 91, 72, 83, 86, 25, 87, 64, 73, 24]);
        proxy_secret_ip = proxy_secret + (param_ip || 'ip/');
      }

      var proxy_other = Lampa.Storage.field('online_mod_proxy_other') === true;
      var proxy_other_url = proxy_other ? Lampa.Storage.field('online_mod_proxy_other_url') + '' : '';
      var user_proxy1 = (proxy_other_url || proxy1) + param_ip;
      var user_proxy2 = (proxy_other_url || proxy2) + param_ip;
      var user_proxy3 = (proxy_other_url || proxy3) + param_ip;
      
      // Удалены: filmix_site, filmix_abuse, zetflix, allohacdn
      
      if (name === 'cookie') return user_proxy1;
      if (name === 'cookie2') return user_proxy2;
      if (name === 'cookie3') return user_proxy3;
      if (name === 'ip') return proxy2;

      if (Lampa.Storage.field('online_mod_proxy_' + name) === true) {
        if (name === 'rezka') return user_proxy2;
        if (name === 'rezka2') return user_proxy2;
        // Удалены: iframe, lumex, kinobase, collaps, cdnmovies, filmix, videodb, fancdn, fancdn2, fanserials, videoseed, vibix, redheadsound, anilibria, anilibria2, animelib, kodik, kinopub
      }

      return '';
    }

    function parseURL(link) {
      var url = {
        href: link,
        protocol: '',
        host: '',
        origin: '',
        pathname: '',
        search: '',
        hash: ''
      };
      var pos = link.indexOf('#');

      if (pos !== -1) {
        url.hash = link.substring(pos);
        link = link.substring(0, pos);
      }

      pos = link.indexOf('?');

      if (pos !== -1) {
        url.search = link.substring(pos);
        link = link.substring(0, pos);
      }

      pos = link.indexOf(':');
      var path_pos = link.indexOf('/');

      if (pos !== -1 && (path_pos === -1 || path_pos > pos)) {
        url.protocol = link.substring(0, pos + 1);
        link = link.substring(pos + 1);
      }

      if (startsWith(link, '//')) {
        pos = link.indexOf('/', 2);

        if (pos !== -1) {
          url.host = link.substring(2, pos);
          link = link.substring(pos);
        } else {
          url.host = link.substring(2);
          link = '/';
        }

        url.origin = url.protocol + '//' + url.host;
      }

      url.pathname = link;
      return url;
    }

    function fixLink(link, referrer) {
      if (link) {
        if (!referrer || link.indexOf('://') !== -1) return link;
        var url = parseURL(referrer);
        if (startsWith(link, '//')) return url.protocol + link;
        if (startsWith(link, '/')) return url.origin + link;
        if (startsWith(link, '?')) return url.origin + url.pathname + link;
        if (startsWith(link, '#')) return url.origin + url.pathname + url.search + link;
        var base = url.origin + url.pathname;
        base = base.substring(0, base.lastIndexOf('/') + 1);
        return base + link;
      }

      return link;
    }

    function fixLinkProtocol(link, prefer_http, replace_protocol) {
      if (link) {
        if (startsWith(link, '//')) {
          return (prefer_http ? 'http:' : 'https:') + link;
        } else if (prefer_http && replace_protocol) {
          return link.replace('https://', 'http://');
        } else if (!prefer_http && replace_protocol === 'full') {
          return link.replace('http://', 'https://');
        }
      }

      return link;
    }

    function proxyLink(link, proxy, proxy_enc, enc) {
      if (link && proxy) {
        if (proxy_enc == null) proxy_enc = '';
        if (enc == null) enc = 'enc';

        if (enc === 'enc') {
          var pos = link.indexOf('/');
          if (pos !== -1 && link.charAt(pos + 1) === '/') pos++;
          var part1 = pos !== -1 ? link.substring(0, pos + 1) : '';
          var part2 = pos !== -1 ? link.substring(pos + 1) : link;
          return proxy + 'enc/' + encodeURIComponent(btoa(proxy_enc + part1)) + '/' + part2;
        }

        if (enc === 'enc1') {
          var _pos = link.lastIndexOf('/');

          var _part = _pos !== -1 ? link.substring(0, _pos + 1) : '';

          var _part2 = _pos !== -1 ? link.substring(_pos + 1) : link;

          return proxy + 'enc1/' + encodeURIComponent(btoa(proxy_enc + _part)) + '/' + _part2;
        }

        if (enc === 'enc2') {
          var posEnd = link.lastIndexOf('?');
          var posStart = link.lastIndexOf('://');
          if (posEnd === -1 || posEnd <= posStart) posEnd = link.length;
          if (posStart === -1) posStart = -3;
          var name = link.substring(posStart + 3, posEnd);
          posStart = name.lastIndexOf('/');
          name = posStart !== -1 ? name.substring(posStart + 1) : '';
          return proxy + 'enc2/' + encodeURIComponent(btoa(proxy_enc + link)) + '/' + name;
        }

        return proxy + proxy_enc + link;
      }

      return link;
    }

    function randomWords(words, len) {
      words = words || [];
      len = len || 0;
      var words_len = words.length;
      if (!words_len) return '';
      var str = '';

      for (var i = 0; i < len; i++) {
        str += words[Math.floor(Math.random() * words_len)];
      }

      return str;
    }

    function randomChars(chars, len) {
      return randomWords((chars || '').split(''), len);
    }

    function randomHex(len) {
      return randomChars('0123456789abcdef', len);
    }

    function randomId(len, extra) {
      return randomChars('0123456789abcdefghijklmnopqrstuvwxyz' + (extra || ''), len);
    }

    function randomId2(len, extra) {
      return randomChars('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + (extra || ''), len);
    }

    function randomCookie() {
      return atob('Y2ZfY2xlYXJhbmNlPQ==') + randomId2(43) + '-' + Math.floor(Date.now() / 1000) + atob('LTEuMi4xLjEt') + randomId2(299, '_.');
    }

    function checkAndroidVersion(needVersion) {
      if (typeof AndroidJS !== 'undefined') {
        try {
          var current = AndroidJS.appVersion().split('-');
          var versionCode = current.pop();

          if (parseInt(versionCode, 10) >= needVersion) {
            return true;
          }
        } catch (e) {}
      }

      return false;
    }

    var Utils = {
      decodeSecret: decodeSecret,
      isDebug: isDebug,
      isDebug2: isDebug2,
      rezka2Mirror: rezka2Mirror,
      baseUserAgent: baseUserAgent,
      setMyIp: setMyIp,
      getMyIp: getMyIp,
      checkMyIp: checkMyIp$1,
      proxy: proxy,
      parseURL: parseURL,
      fixLink: fixLink,
      fixLinkProtocol: fixLinkProtocol,
      proxyLink: proxyLink,
      randomWords: randomWords,
      randomChars: randomChars,
      randomHex: randomHex,
      randomId: randomId,
      randomId2: randomId2,
      randomCookie: randomCookie,
      checkAndroidVersion: checkAndroidVersion
    };

    var network$1 = new Lampa.Reguest();
    var cache = {};
    var total_cnt = 0;
    var proxy_cnt = 0;
    var good_cnt = 0;
    var CACHE_SIZE = 100;
    var CACHE_TIME = 1000 * 60 * 60;

    function get(method, oncomplite, onerror) {
      var use_proxy = total_cnt >= 10 && good_cnt > total_cnt / 2;
      if (!use_proxy) total_cnt++;
      var kp_prox = 'https://cors.kp556.workers.dev:8443/';
      var url = 'https://kinopoiskapiunofficial.tech/';
      url += method;
      network$1.timeout(15000);
      network$1.silent((use_proxy ? kp_prox : '') + url, function (json) {
        oncomplite(json);
      }, function (a, c) {
        use_proxy = !use_proxy && (proxy_cnt < 10 || good_cnt > proxy_cnt / 2);

        if (use_proxy && (a.status == 429 || a.status == 0 && a.statusText !== 'timeout')) {
          proxy_cnt++;
          network$1.timeout(15000);
          network$1.silent(kp_prox + url, function (json) {
            good_cnt++;
            oncomplite(json);
          }, onerror, false, {
            headers: {
              'X-API-KEY': '2a4a0808-81a3-40ae-b0d3-e11335ede616'
            }
          });
        } else onerror(a, c);
      }, false, {
        headers: {
          'X-API-KEY': '2a4a0808-81a3-40ae-b0d3-e11335ede616'
        }
      });
    }

    function getComplite(method, oncomplite) {
      get(method, oncomplite, function () {
        oncomplite(null);
      });
    }

    function getCompliteIf(condition, method, oncomplite) {
      if (condition) getComplite(method, oncomplite);else {
        setTimeout(function () {
          oncomplite(null);
        }, 10);
      }
    }

    function getCache(key) {
      var res = cache[key];

      if (res) {
        var cache_timestamp = new Date().getTime() - CACHE_TIME;
        if (res.timestamp > cache_timestamp) return res.value;

        for (var ID in cache) {
          var node = cache[ID];
          if (!(node && node.timestamp > cache_timestamp)) delete cache[ID];
        }
      }

      return null;
    }

    function setCache(key, value) {
      var timestamp = new Date().getTime();
      var size = Object.keys(cache).length;

      if (size >= CACHE_SIZE) {
        var cache_timestamp = timestamp - CACHE_TIME;

        for (var ID in cache) {
          var node = cache[ID];
          if (!(node && node.timestamp > cache_timestamp)) delete cache[ID];
        }

        size = Object.keys(cache).length;

        if (size >= CACHE_SIZE) {
          var timestamps = [];

          for (var _ID in cache) {
            var _node = cache[_ID];
            timestamps.push(_node && _node.timestamp || 0);
          }

          timestamps.sort(function (a, b) {
            return a - b;
          });
          cache_timestamp = timestamps[Math.floor(timestamps.length / 2)];

          for (var _ID2 in cache) {
            var _node2 = cache[_ID2];
            if (!(_node2 && _node2.timestamp > cache_timestamp)) delete cache[_ID2];
          }
        }
      }

      cache[key] = {
        timestamp: timestamp,
        value: value
      };
    }

    function getFromCache(method, oncomplite, onerror) {
      var json = getCache(method);

      if (json) {
        setTimeout(function () {
          oncomplite(json, true);
        }, 10);
      } else get(method, oncomplite, onerror);
    }

    function clear() {
      network$1.clear();
    }

    var KP = {
      get: get,
      getComplite: getComplite,
      getCompliteIf: getCompliteIf,
      getCache: getCache,
      setCache: setCache,
      getFromCache: getFromCache,
      clear: clear
    };
    
    // START KEEP: rezka component implementation 
    
    function rezka(component, _object) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      extract.seasons = [];
      extract.media = [];
      var select_title = '';
      var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
      var prox = component.proxy('rezka');
      var host = 'https://voidboost.tv';
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var embed = host + '/embed/';
      var cookie = Lampa.Storage.get('online_mod_rezka_cookie', '');

      function getUrlWithParams(url, params) {
        var params_array = [];

        for (var key in params) {
          if (params[key] !== null) {
            params_array.push(key + '=' + params[key]);
          }
        }

        return url + '?' + params_array.join('&');
      }

      function rezka_search(api, callback, error) {
        var error_check = function error_check(a, c) {
          if (a.status == 404 || a.status == 0 && a.statusText !== 'timeout') {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        };

        var returnHeaders = true;
        var prox_enc_cookie = prox_enc;

        if (cookie) {
          if (prox) prox_enc_cookie += 'param/Cookie=' + encodeURIComponent(cookie) + '/';else headers['Cookie'] = cookie;
        }

        if (prox) returnHeaders = false;

        network.clear();
        network.timeout(20000);
        network["native"](component.proxyLink(api, prox, prox_enc_cookie), function (json) {
          var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

          if (cookieHeaders && cookieHeaders.forEach) {
            var values = {};
            cookieHeaders.forEach(function (param) {
              var parts = param.split(';')[0].split('=');

              if (parts[0]) {
                if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
              }
            });
            var cookies = [];

            for (var name in values) {
              cookies.push(name + '=' + values[name]);
            }

            var new_cookie = cookies.join('; ');
            if (new_cookie) Lampa.Storage.set('online_mod_rezka_cookie', new_cookie);
          }

          callback(json.body || json);
        }, error_check, false, {
          headers: headers,
          returnHeaders: returnHeaders
        });
      }

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;
        var error = component.empty.bind(component);
        var api = embed + (+kinopoisk_id ? 'kp/' : 'imdb/') + kinopoisk_id;
        rezka_search(api, function (str) {
          if (str) success(str);else if (!object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
            var api2 = embed + 'imdb/' + object.movie.imdb_id;
            rezka_search(api2, function (str) {
              if (str) success(str);else component.emptyForQuery(select_title);
            }, error);
          } else component.emptyForQuery(select_title);
        }, error);
      };

      this.extendChoice = function () {};

      this.reset = function () {
        component.reset();
        append(filtred());
      };

      this.filter = function () {};

      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function success(str) {
        component.loading(false);
        var data = Lampa.Arrays.decodeJson(str, {});

        if (data.url && data.url.indexOf('voidboost.tv') != -1) {
          var url = data.url;
          var ref = url;
          var parts = parseURL(url);
          var prox_enc2 = prox_enc;

          if (prox) {
            prox_enc2 += 'param/Origin=' + encodeURIComponent(parts.origin) + '/';
            prox_enc2 += 'param/Referer=' + encodeURIComponent(ref) + '/';
          }

          var headers2 = Lampa.Platform.is('android') ? {
            'Origin': parts.origin,
            'Referer': ref,
            'User-Agent': user_agent
          } : {};

          if (cookie) {
            if (prox) prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';else headers2['Cookie'] = cookie;
          }

          network.clear();
          network.timeout(20000);
          network.silent(component.proxyLink(url, prox, prox_enc2), function (str) {
            var data2 = Lampa.Arrays.decodeJson(str, {});

            if (data2.playlist && data2.playlist.length) {
              extract = {
                list: data2.playlist
              };
              append(filtred());
            } else component.emptyForQuery(select_title);
          }, function (a, c) {
            component.emptyForQuery(select_title);
          }, false, {
            headers: headers2
          });
        } else component.emptyForQuery(select_title);
      }

      function filtred() {
        var filtred = [];

        if (extract.list) {
          extract.list.forEach(function (elem) {
            filtred.push({
              title: elem.title || select_title,
              quality: '360p ~ 1080p',
              info: '',
              media: elem
            });
          });
        }

        return filtred;
      }

      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        items.forEach(function (element) {
          var hash = Lampa.Utils.hash(element.title);
          var view = Lampa.Timeline.view(hash);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var playlist = [];
            element.media.folder.forEach(function (elem) {
              playlist.push({
                url: elem.link,
                quality: component.renameQualityMap(elem.link),
                title: elem.title
              });
            });
            var first = playlist[0];

            if (playlist.length > 1) {
              first.playlist = playlist;
            }

            Lampa.Player.play(first);
            Lampa.Player.playlist(playlist);

            if (viewed.indexOf(hash_file) == -1) {
              viewed.push(hash_file);
              item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
              Lampa.Storage.set('online_view', viewed);
            }
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            file: function file(call) {
              var playlist = [];
              element.media.folder.forEach(function (elem) {
                playlist.push({
                  link: elem.link,
                  quality: component.renameQualityMap(elem.link),
                  title: elem.title
                });
              });
              call({
                file: playlist[0].link,
                quality: false
              });
            }
          });
        });
        component.start(true);
      }
    }

    function rezka2(component, _object) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      extract.seasons = [];
      extract.season_num = [];
      extract.voice = [];
      var select_title = '';
      var prox = component.proxy('rezka2');
      var host = Utils.rezka2Mirror();
      var ref = host + '/';
      var user_agent = Utils.baseUserAgent();
      var headers = Lampa.Platform.is('android') ? {
        'Origin': host,
        'Referer': ref,
        'User-Agent': user_agent
      } : {};
      var prox_enc = '';

      if (prox) {
        prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
        prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
        prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
      }

      var embed = host + '/serial/';
      var embed2 = host + '/films/';
      var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '');
      var filter_items = {};
      var choice = {
        season: 0,
        voice: 0
      };

      function getUrlWithParams(url, params) {
        var params_array = [];

        for (var key in params) {
          if (params[key] !== null) {
            params_array.push(key + '=' + params[key]);
          }
        }

        return url + '?' + params_array.join('&');
      }

      function rezka_search(api, callback, error) {
        var error_check = function error_check(a, c) {
          if (a.status == 404 || a.status == 0 && a.statusText !== 'timeout') {
            if (callback) callback('');
          } else if (error) error(network.errorDecode(a, c));
        };

        var returnHeaders = true;
        var prox_enc_cookie = prox_enc;

        if (cookie) {
          if (prox) prox_enc_cookie += 'param/Cookie=' + encodeURIComponent(cookie) + '/';else headers['Cookie'] = cookie;
        }

        if (prox) returnHeaders = false;

        network.clear();
        network.timeout(20000);
        network["native"](component.proxyLink(api, prox, prox_enc_cookie), function (json) {
          var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

          if (cookieHeaders && cookieHeaders.forEach) {
            var values = {};
            cookieHeaders.forEach(function (param) {
              var parts = param.split(';')[0].split('=');

              if (parts[0]) {
                if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
              }
            });
            var cookies = [];

            for (var name in values) {
              cookies.push(name + '=' + values[name]);
            }

            var new_cookie = cookies.join('; ');
            if (new_cookie) Lampa.Storage.set('online_mod_rezka2_cookie', new_cookie);
          }

          callback(json.body || json);
        }, error_check, false, {
          headers: headers,
          returnHeaders: returnHeaders
        });
      }

      this.search = function (_object, kinopoisk_id) {
        object = _object;
        select_title = object.search || object.movie.title;
        var url = object.movie.number_of_seasons ? embed : embed2;
        url += (+kinopoisk_id ? 'kp/' : 'imdb/') + kinopoisk_id;
        var error = component.empty.bind(component);
        rezka_search(url, function (str) {
          if (str) success(str);else if (!object.clarification && object.movie.imdb_id && kinopoisk_id != object.movie.imdb_id) {
            var url2 = object.movie.number_of_seasons ? embed : embed2;
            url2 += 'imdb/' + object.movie.imdb_id;
            rezka_search(url2, function (str) {
              if (str) success(str);else component.emptyForQuery(select_title);
            }, error);
          } else component.emptyForQuery(select_title);
        }, error);
      };

      this.extendChoice = function (saved) {
        Lampa.Arrays.extend(choice, saved, true);
      };

      this.reset = function () {
        component.reset();
        choice = {
          season: 0,
          voice: 0
        };
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.filter = function (type, a, b) {
        choice[a.stype] = b.index;
        component.reset();
        filter();
        append(filtred());
        component.saveChoice(choice);
      };

      this.destroy = function () {
        network.clear();
        extract = null;
      };

      function success(str) {
        component.loading(false);
        var data = Lampa.Arrays.decodeJson(str, {});

        if (data.url && data.url.indexOf(Utils.rezka2Mirror()) != -1) {
          var url = data.url;
          var ref = url;
          var parts = parseURL(url);
          var prox_enc2 = prox_enc;

          if (prox) {
            prox_enc2 += 'param/Origin=' + encodeURIComponent(parts.origin) + '/';
            prox_enc2 += 'param/Referer=' + encodeURIComponent(ref) + '/';
          }

          var headers2 = Lampa.Platform.is('android') ? {
            'Origin': parts.origin,
            'Referer': ref,
            'User-Agent': user_agent
          } : {};

          if (cookie) {
            if (prox) prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';else headers2['Cookie'] = cookie;
          }

          network.clear();
          network.timeout(20000);
          network.silent(component.proxyLink(url, prox, prox_enc2), function (str) {
            var data2 = Lampa.Arrays.decodeJson(str, {});

            if (data2.playlist && data2.playlist.length) {
              extract = {
                list: data2.playlist
              };
              filter();
              append(filtred());
            } else component.emptyForQuery(select_title);
          }, function (a, c) {
            component.emptyForQuery(select_title);
          }, false, {
            headers: headers2
          });
        } else component.emptyForQuery(select_title);
      }

      function filter() {
        filter_items = {
          season: [],
          voice: []
        };

        if (extract.list) {
          extract.list.forEach(function (data) {
            if (data.folder && data.folder.length) {
              data.folder.forEach(function (elem) {
                if (elem.title) {
                  var season = elem.title.match(/(\d+)\sсезон/i);
                  var voice = elem.title.match(/(?:\s\()(.*)(?:\))/);

                  if (season && season[1]) {
                    var s_num = parseInt(season[1]);

                    if (filter_items.season.indexOf(s_num) == -1) {
                      filter_items.season.push(s_num);
                    }
                  }

                  if (voice && voice[1]) {
                    if (filter_items.voice.indexOf(voice[1]) == -1) {
                      filter_items.voice.push(voice[1]);
                    }
                  }
                }
              });
            }
          });
        }

        if (object.movie.number_of_seasons && !filter_items.season.length) {
          for (var i = 1; i <= object.movie.number_of_seasons; i++) {
            filter_items.season.push(i);
          }
        }

        filter_items.season.sort(function (a, b) {
          return a - b;
        });

        if (!filter_items.season[choice.season]) {
          if (filter_items.season.length) {
            choice.season = filter_items.season.length - 1;
          } else {
            choice.season = 0;
          }
        }

        filter_items.season = filter_items.season.map(function (s) {
          return Lampa.Lang.translate('torrent_serial_season') + ' ' + s;
        });
        filter_items.voice.sort();
        if (!filter_items.voice[choice.voice]) choice.voice = 0;
        component.filter(filter_items, choice);
      }

      function filtred() {
        var filtred = [];

        if (extract.list) {
          var season_num = filter_items.season.length ? filter_items.season[choice.season].split(' ').pop() : 0;
          var voice_name = filter_items.voice[choice.voice];
          extract.list.forEach(function (elem) {
            if (elem.folder && elem.folder.length) {
              elem.folder.forEach(function (data) {
                var season = data.title.match(/(\d+)\sсезон/i);
                var voice = data.title.match(/(?:\s\()(.*)(?:\))/);
                var s_match = !season_num || season && season[1] == season_num;
                var v_match = !voice_name || voice && voice[1] == voice_name;

                if (s_match && v_match) {
                  var s_num = season && season[1] || '';
                  var voice_title = voice && voice[1] || '';
                  data.folder.forEach(function (file) {
                    var episode = file.title.match(/(\d+)\sсерия/i);
                    var e_num = episode && episode[1] || '';
                    filtred.push({
                      title: component.formatEpisodeTitle(s_num, e_num),
                      quality: '360p ~ 1080p',
                      info: ' / ' + voice_title,
                      season: s_num,
                      episode: e_num,
                      media: file
                    });
                  });
                }
              });
            } else {
              var voice = elem.title.match(/(?:\s\()(.*)(?:\))/);
              var voice_title = voice && voice[1] || '';

              if (!voice_name || voice_name == voice_title) {
                elem.folder.forEach(function (file) {
                  filtred.push({
                    title: file.title || select_title,
                    quality: '360p ~ 1080p',
                    info: '',
                    media: file
                  });
                });
              }
            }
          });
        }

        return filtred;
      }

      function append(items) {
        component.reset();
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var last_episode = component.getLastEpisode(items);
        items.forEach(function (element) {
          if (element.season) {
            element.translate_episode_end = last_episode;
            element.translate_voice = filter_items.voice[choice.voice];
          }

          var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var view = Lampa.Timeline.view(hash);
          var item = Lampa.Template.get('online_mod', element);
          var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
          element.timeline = view;
          item.append(Lampa.Timeline.render(view));

          if (Lampa.Timeline.details) {
            item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
          }

          if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
          item.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            var playlist = [];
            element.media.folder.forEach(function (elem) {
              playlist.push({
                url: elem.link,
                quality: component.renameQualityMap(elem.link),
                title: elem.title
              });
            });
            var first = playlist[0];

            if (playlist.length > 1) {
              first.playlist = playlist;
            }

            Lampa.Player.play(first);
            Lampa.Player.playlist(playlist);

            if (viewed.indexOf(hash_file) == -1) {
              viewed.push(hash_file);
              item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
              Lampa.Storage.set('online_view', viewed);
            }
          });
          component.append(item);
          component.contextmenu({
            item: item,
            view: view,
            viewed: viewed,
            hash_file: hash_file,
            element: element,
            file: function file(call) {
              var playlist = [];
              element.media.folder.forEach(function (elem) {
                playlist.push({
                  link: elem.link,
                  quality: component.renameQualityMap(elem.link),
                  title: elem.title
                });
              });
              call({
                file: playlist[0].link,
                quality: false
              });
            }
          });
        });
        component.start(true);
      }
    }
    
    // END KEEP: rezka/rezka2 components

    // KEEP: rezka2FillCookie
    
    function rezka2FillCookie(onComplite, onError) {
        var network = new Lampa.Reguest();
        var host = Utils.rezka2Mirror();
        var ref = host + '/';
        var prox = Lampa.Storage.field('online_mod_proxy_rezka2') === true ? component.proxy('rezka2') : '';
        var user_agent = Utils.baseUserAgent();
        var headers = Lampa.Platform.is('android') ? {
            'Origin': host,
            'Referer': ref,
            'User-Agent': user_agent
        } : {};
        var prox_enc = '';

        if (prox) {
            prox_enc += 'param/Origin=' + encodeURIComponent(host) + '/';
            prox_enc += 'param/Referer=' + encodeURIComponent(ref) + '/';
            prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
        }

        var url = host + '/';
        var returnHeaders = true;
        var prox_enc_cookie = prox_enc;

        if (prox) {
            prox_enc_cookie += 'cookie_plus/param/Cookie=/';
            returnHeaders = false;
        }

        network.clear();
        network.timeout(8000);
        network['native'](Utils.proxyLink(url, prox, prox_enc_cookie), function (str) {
            var cookie = '';
            var values = {};
            var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
            var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

            if (cookieHeaders && cookieHeaders.forEach) {
                cookieHeaders.forEach(function (param) {
                    var parts = param.split(';')[0].split('=');

                    if (parts[0]) {
                        if (parts[1] === 'deleted') delete values[parts[0]];else values[parts[0]] = parts[1] || '';
                    }
                });
                var cookies = [];

                for (var name in values) {
                    cookies.push(name + '=' + values[name]);
                }

                cookie = cookies.join('; ');
            }

            if (cookie) {
                Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                if (onComplite) onComplite();
            } else {
                if (onError) onError();
            }
        }, function (a, c) {
            if (onError) onError();
        }, false, {
            dataType: 'text',
            headers: headers,
            returnHeaders: returnHeaders
        });
    }

    // Удалены fancdnFillCookie и другие fillCookie функции
    
    var proxyInitialized = {};
    var proxyWindow = {};
    var proxyCalls = {};
    var default_balanser = 'rezka2'; // Изменено
    
    function component(object) {
      var network = new Lampa.Reguest();
      var scroll = new Lampa.Scroll({
        mask: true,
        over: true
      });
      var files = new Lampa.Explorer(object);
      var filter = new Lampa.Filter(object);
      var balanser = Lampa.Storage.get('online_mod_balanser', default_balanser) + '';
      var last_bls = Lampa.Storage.field('online_mod_last_balanser') === true;
      var last = false;
      var contextmenu_all = [];
      var extended = false;
      var selected_id = false;
      var all_sources = [
        {
          name: 'rezka2',
          title: 'HDrezka (Mirror)',
          type: 'json',
          object: rezka2
        }, {
          name: 'rezka',
          title: 'HDrezka',
          type: 'json',
          object: rezka
        }
      ];
      
      var sources = {
        rezka2: new rezka2(this, object),
        rezka: new rezka(this, object)
      };

      if (Lampa.Storage.field('online_mod_balanser_source') === true) {
        all_sources = all_sources.filter(function (s) {
          return s.name === 'rezka' || s.name === 'rezka2';
        });
      }

      var default_source = all_sources.find(function (s) {
        return s.name === balanser;
      });

      if (!default_source) {
        balanser = default_balanser;
      }

      if (last_bls) {
        Lampa.Storage.set('online_mod_balanser', balanser);
      }

      this.activity = Lampa.Activity.active();
      this.selected_id = selected_id;

      this.search = function (find_id, selected_bls) {
        if (selected_bls) balanser = selected_bls;
        selected_id = find_id;
        this.loading(true);
        this.render();
        Utils.checkMyIp(network, function () {
          sources[balanser].search(object, find_id);
          var source_obj = all_sources.find(function (s) {
            return s.name === balanser;
          });
          filter.chosen('filter', all_sources.indexOf(source_obj));
          filter.chosen('sort', [source_obj ? source_obj.title : balanser]);
        });
      };

      this.loading = function (status) {
        files.loading(status);
      };

      this.formatEpisodeTitle = function (season, episode) {
        if (season) {
          return Lampa.Lang.translate('torrent_serial_season') + ' ' + season + ' | ' + Lampa.Lang.translate('torrent_serial_episode') + ' ' + episode;
        }

        return Lampa.Lang.translate('torrent_file_movie');
      };

      this.proxy = function (name) {
        return Utils.proxy(name);
      };

      this.proxyLink = function (link, proxy, prox_enc, enc) {
        return Utils.proxyLink(link, proxy, prox_enc, enc);
      };

      this.fixLink = function (link, referrer) {
        return Utils.fixLink(link, referrer);
      };

      this.fixLinkProtocol = function (link, prefer_http, replace_protocol) {
        return Utils.fixLinkProtocol(link, prefer_http, replace_protocol);
      };

      this.parseM3U = function (str) {
        return Lampa.Utils.parseM3U(str);
      };

      this.getDefaultQuality = function (qualitys, file) {
        if (qualitys) {
          var names = Lampa.Arrays.getKeys(qualitys);

          if (names.indexOf(Lampa.Storage.field('online_mod_quality')) != -1) {
            return qualitys[Lampa.Storage.field('online_mod_quality')];
          }
        }

        return file;
      };

      this.renameQualityMap = function (qualitys) {
        if (qualitys) {
          var names = Lampa.Arrays.getKeys(qualitys);
          var new_names = [];
          names.forEach(function (name) {
            var rename = Lampa.Storage.field('online_mod_rename_quality') || {};
            new_names.push(rename[name] || name);
          });
          return new_names.join(', ');
        }

        return false;
      };

      this.addQuality = function (url, qualitys, rename) {
        if (url) {
          if (qualitys) {
            var names = Lampa.Arrays.getKeys(qualitys);
            var quality = rename ? Lampa.Storage.field('online_mod_rename_quality') : false;
            names.forEach(function (name) {
              if (quality) {
                url = Lampa.Utils.addUrlComponent(url, quality[name] || name, qualitys[name]);
              } else {
                url = Lampa.Utils.addUrlComponent(url, name, qualitys[name]);
              }
            });
          }
        }

        return url;
      };

      this.saveChoice = function (choice) {
        var data = Lampa.Storage.cache('online_mod_choice_' + balanser, 500, {});
        data[selected_id || object.movie.id] = choice;
        Lampa.Storage.set('online_mod_choice_' + balanser, data);
      };

      this.getChoice = function () {
        return Lampa.Storage.cache('online_mod_choice_' + balanser, 500, {})[selected_id || object.movie.id] || {};
      };

      this.reset = function () {
        contextmenu_all = [];
        scroll.reset();
        scroll.render().empty();
        filter.reset();
      };

      this.changeBalanser = function (type, a, b) {
        balanser = b.name;
        Lampa.Storage.set('online_mod_balanser', balanser);
        sources[balanser].extendChoice(this.getChoice());
        this.search(selected_id, balanser);
        var source_obj = all_sources.filter(function (s) {
          return s.name === balanser;
        })[0];
        filter.chosen('filter', all_sources.indexOf(source_obj));
        filter.chosen('sort', [source_obj ? source_obj.title : balanser]);
      };

      this.proxyCall = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = 'https://cors.apn.monster/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.proxyUrlCall = function (proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_host = Utils.parseURL(proxy_url).host;

        if (!proxyInitialized[proxy_host]) {
          proxyInitialized[proxy_host] = true;
          proxyWindow[proxy_host] = window.open(proxy_url);
          proxyCalls[proxy_host] = [];

          proxyWindow[proxy_host].onload = function () {
            proxyCalls[proxy_host].forEach(function (data) {
              proxyWindow[proxy_host].contentWindow.postMessage(data, '*');
            });
            proxyCalls[proxy_host] = [];
          };
        }

        var call_data = {
          method: method,
          url: url,
          timeout: timeout,
          post_data: post_data,
          withCredentials: withCredentials,
          uid: Lampa.Utils.generateUID(16)
        };
        var onmessage = function onmessage(event) {
          if (event.source !== proxyWindow[proxy_host].contentWindow) return;
          var data = event.data;
          if (data.uid !== call_data.uid) return;
          window.removeEventListener('message', onmessage);

          if (data.success) {
            call_success(data.data);
          } else {
            call_fail(data.data);
          }
        };

        window.addEventListener('message', onmessage);

        if (proxyWindow[proxy_host].contentWindow) {
          proxyWindow[proxy_host].contentWindow.postMessage(call_data, '*');
        } else {
          proxyCalls[proxy_host].push(call_data);
        }
      };

      this.proxyCall2 = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = (window.location.protocol === 'https:' ? 'https://' : 'http://') + 'lampa.stream/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.proxyCall3 = function (method, url, timeout, post_data, call_success, call_fail, withCredentials) {
        var proxy_url = 'https://nb557.github.io/plugins/proxy.html';
        this.proxyUrlCall(proxy_url, method, url, timeout, post_data, call_success, call_fail, withCredentials);
      };

      this.extendChoice = function () {
        var data = Lampa.Storage.cache('online_mod_choice_' + balanser, 500, {});
        var save = data[selected_id || object.movie.id] || {};
        extended = true;
        sources[balanser].extendChoice(save);
        var source_obj = all_sources.filter(function (s) {
          return s.name === balanser;
        })[0];
        filter.chosen('filter', all_sources.indexOf(source_obj));
        filter.chosen('sort', [source_obj ? source_obj.title : balanser]);
      };

      this.append = function (item) {
        item.on('hover:focus', function (e) {
          last = e.target;
          scroll.update($(e.target), true);
        });
        scroll.append(item);
      };

      this.contextmenu = function (params) {
        contextmenu_all.push(params);
        params.item.on('hover:long', function () {
          function selectQuality(title, callback) {
            return function (extra) {
              if (extra.quality) {
                var qual = [];

                for (var i in extra.quality) {
                  qual.push({
                    title: i,
                    file: extra.quality[i]
                  });
                }

                Lampa.Select.show({
                  title: title,
                  items: qual,
                  onBack: function onBack() {
                    Lampa.Controller.toggle(enabled);
                  },
                  onSelect: callback
                });
              } else callback(null, extra);
            };
          }

          var enabled = Lampa.Controller.enabled().name;
          var menu = [{
            title: Lampa.Lang.translate('torrent_parser_label_title'),
            mark: true
          }, {
            title: Lampa.Lang.translate('torrent_parser_label_cancel_title'),
            clearmark: true
          }, {
            title: Lampa.Lang.translate('online_mod_clearmark_all'),
            clearmark_all: true
          }, {
            title: Lampa.Lang.translate('time_reset'),
            timeclear: true
          }, {
            title: Lampa.Lang.translate('online_mod_timeclear_all'),
            timeclear_all: true
          }];

          if (Lampa.Platform.is('webos')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Webos',
              player: 'webos'
            });
          }

          if (Lampa.Platform.is('android')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Android',
              player: 'android'
            });
          }

          menu.push({
            title: Lampa.Lang.translate('player_lauch') + ' - Lampa',
            player: 'lampa'
          });

          if (params.file) {
            menu.push({
              title: Lampa.Lang.translate('copy_link'),
              copylink: true
            });
          }

          if (Lampa.Account.working() && params.element && typeof params.element.season !== 'undefined' && Lampa.Account.subscribeToTranslation) {
            menu.push({
              title: Lampa.Lang.translate('online_mod_voice_subscribe'),
              subscribe: true
            });
          }

          Lampa.Select.show({
            title: Lampa.Lang.translate('title_action'),
            items: menu,
            onBack: function onBack() {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function onSelect(a) {
              if (a.clearmark) {
                Lampa.Arrays.remove(params.viewed, params.hash_file);
                Lampa.Storage.set('online_view', params.viewed);
                params.item.find('.torrent-item__viewed').remove();
              }

              if (a.clearmark_all) {
                contextmenu_all.forEach(function (params) {
                  Lampa.Arrays.remove(params.viewed, params.hash_file);
                  Lampa.Storage.set('online_view', params.viewed);
                  params.item.find('.torrent-item__viewed').remove();
                });
              }

              if (a.mark) {
                if (params.viewed.indexOf(params.hash_file) == -1) {
                  params.viewed.push(params.hash_file);
                  params.item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                  Lampa.Storage.set('online_view', params.viewed);
                }
              }

              if (a.timeclear) {
                params.view.percent = 0;
                params.view.time = 0;
                params.view.duration = 0;
                Lampa.Timeline.update(params.view);
              }

              if (a.timeclear_all) {
                contextmenu_all.forEach(function (params) {
                  params.view.percent = 0;
                  params.view.time = 0;
                  params.view.duration = 0;
                  Lampa.Timeline.update(params.view);
                });
              }

              Lampa.Controller.toggle(enabled);

              if (a.player) {
                Lampa.Player.runas(a.player);
                params.item.trigger('hover:enter', {
                  runas: a.player
                });
              }

              if (a.copylink) {
                params.file(selectQuality('Ссылки', function (b, extra) {
                  Lampa.Utils.copyTextToClipboard(b && b.file || extra && extra.file, function () {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                  }, function () {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                  });
                }));
              }

              if (a.subscribe) {
                Lampa.Account.subscribeToTranslation({
                  card: object.movie,
                  season: params.element.season,
                  episode: params.element.translate_episode_end,
                  voice: params.element.translate_voice
                }, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_voice_success'));
                }, function () {
                  Lampa.Noty.show(Lampa.Lang.translate('online_mod_voice_error'));
                });
              }
            }
          });
        }).on('hover:focus', function () {
          if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('online_mod_file_helper'), params.item);
        });
      };

      this.empty = function (msg) {
        var empty = Lampa.Template.get('list_empty');
        if (msg) empty.find('.empty__descr').text(msg);
        scroll.append(empty);
        this.loading(false);
      };

      this.emptyForQuery = function (query) {
        this.empty(Lampa.Lang.translate('online_mod_query_start') + ' (' + query + ') ' + Lampa.Lang.translate('online_mod_query_end'));
      };

      this.getLastEpisode = function (items) {
        var last_episode = 0;
        items.forEach(function (e) {
          if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
        });
        return last_episode;
      };

      this.start = function (first_select) {
        if (Lampa.Activity.active().activity !== this.activity) return; //обязательно, иначе наблюдается баг, активность создается но не стартует, в то время как компонент загружается и стартует самого себя.

        if (first_select) {
          var last_views = scroll.render().find('.selector.online').find('.torrent-item__viewed').parent().last();
          if (object.movie.number_of_seasons && last_views.length) last = last_views.eq(0)[0];else last = scroll.render().find('.selector').eq(0)[0];
        }

        Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
        Lampa.Controller.add('content', {
          toggle: function toggle() {
            Lampa.Controller.collectionSet(scroll.render(), files.render());
            Lampa.Controller.collectionFocus(last || false, scroll.render());
          },
          up: function up() {
            if (Navigator.canmove('up')) {
              Navigator.move('up');
            } else Lampa.Controller.toggle('head');
          },
          down: function down() {
            Navigator.move('down');
          },
          right: function right() {
            if (Navigator.canmove('right')) Navigator.move('right');else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
          },
          left: function left() {
            if (Navigator.canmove('left')) Navigator.move('left');else Lampa.Controller.toggle('menu');
          },
          back: this.back
        });
        if (this.inActivity()) Lampa.Controller.toggle('content');
      };

      this.render = function () {
        return files.render();
      };

      this.back = function () {
        Lampa.Activity.backward();
      };

      this.pause = function () {};

      this.stop = function () {};

      this.destroy = function () {
        network.clear();
        files.destroy();
        scroll.destroy();
        network = null;
        all_sources.forEach(function (s) {
          sources[s.name].destroy(); 
        });
        // Удаляем источники из sources
        for (var name in sources) {
            delete sources[name];
        }
      };
    }

    var mod_version = '27.09.2025';
    console.log('App', 'start address:', window.location.href);
    var isMSX = !!(window.TVXHost || window.TVXManager);
    var isTizen = navigator.userAgent.toLowerCase().indexOf('tizen') !== -1;
    var isIFrame = window.parent !== window;
    var isLocal = !startsWith(window.location.protocol, 'http');
    var androidHeaders = Lampa.Platform.is('android') && Utils.checkAndroidVersion(339);
    console.log('App', 'is MSX:', isMSX);
    console.log('App', 'is Tizen:', isTizen);
    console.log('App', 'is iframe:', isIFrame);
    console.log('App', 'is local:', isLocal);
    console.log('App', 'supports headers:', androidHeaders);

    // Очистка настроек прокси при инициализации
    if (!Utils.isDebug()) {
      Lampa.Storage.set('online_mod_proxy_rezka2', 'false');
      // Удалены: kinobase, collaps, cdnmovies, fancdn, fancdn2, fanserials, animelib
    } else if (!Lampa.Platform.is('android')) {
      // Настройки для Android удалены, так как касались удаленных провайдеров
    }

    // Удалены все индивидуальные настройки прокси для других провайдеров

    Lampa.Settings.listener.follow('online', function (e) {
      var rezka2_link = e.body.find('[data-name="online_mod_rezka2_mirror"]');

      rezka2_link.unbind('hover:enter').on('hover:enter', function () {
        Lampa.Input.edit({
          title: Lampa.Lang.translate('online_mod_rezka2_mirror'),
          value: Lampa.Storage.get('online_mod_rezka2_mirror', ''),
          free: true
        }, function (new_value) {
          Lampa.Storage.set('online_mod_rezka2_mirror', new_value);
          Lampa.Params.update(rezka2_link, new_value, e.body);
        });
      });

      var rezka2_fill_cookie = e.body.find('[data-name="online_mod_rezka2_fill_cookie"]');

      rezka2_fill_cookie.unbind('hover:enter').on('hover:enter', function () {
        var rezka2_fill_cookie_status = $('.settings-param__status', rezka2_fill_cookie).removeClass('active error wait').addClass('wait');
        rezka2FillCookie(function () {
          rezka2_fill_cookie_status.removeClass('active error wait').addClass('active');
          Lampa.Params.update(e.body.find('[data-name="online_mod_rezka2_cookie"]'), [], e.body);
        }, function () {
          rezka2_fill_cookie_status.removeClass('active error wait').addClass('error');
          Lampa.Params.update(e.body.find('[data-name="online_mod_rezka2_cookie"]'), [], e.body);
        });
      });
      
      // Удалены: fancdn_fill_cookie, filmix_fill_cookie, kinopub_fill_cookie и т.д.
      
      var balanser_source_list = [
        {
          title: 'HDrezka (Mirror)',
          name: 'rezka2'
        }, {
          title: 'HDrezka',
          name: 'rezka'
        }
      ];

      var balanser_source = e.body.find('[data-name="online_mod_balanser"]');
      balanser_source.on('hover:enter', function () {
        Lampa.Select.show({
          title: Lampa.Lang.translate('online_mod_balanser'),
          items: balanser_source_list,
          onSelect: function onSelect(a) {
            Lampa.Storage.set('online_mod_balanser', a.name);
            Lampa.Params.update(balanser_source, a.title, e.body);
          }
        });
      });

      Lampa.Params.update(balanser_source, balanser_source_list.find(function (a) {
        return a.name === Lampa.Storage.get('online_mod_balanser', default_balanser);
      }).title, e.body);
      
      // Очищенный шаблон настроек:
      var template = "<div>";
      
      if (Utils.isDebug()) {
        template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_proxy_rezka2\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_proxy_balanser} HDrezka (Mirror)</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      }
      
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_proxy_rezka\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_proxy_balanser} HDrezka</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_balanser\" data-type=\"select\">\n <div class=\"settings-param__name\">#{online_mod_balanser}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_last_balanser\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_last_balanser}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_balanser_source\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_balanser_source}</div>\n <div class=\"settings-param__value\"></div>\n </div>";

      // Настройки для rezka2
      template += "\n <div class=\"settings-param-title\">\n <span>HDrezka (Mirror)</span>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_mirror\" data-type=\"link\">\n <div class=\"settings-param__name\">#{online_mod_rezka2_mirror}</div>\n <div class=\"settings-param__value\">" + Utils.rezka2Mirror() + "</div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_cookie\" data-type=\"link\">\n <div class=\"settings-param__name\">#{online_mod_rezka2_cookie}</div>\n <div class=\"settings-param__value\">" + Lampa.Storage.get('online_mod_rezka2_cookie', '').slice(0, 10) + '...' + "</div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_fill_cookie\">\n <div class=\"settings-param__name\">#{online_mod_rezka2_fill_cookie}</div>\n <div class=\"settings-param__value\">\n <div class=\"settings-param__status\"></div>\n </div>\n </div>";

      // Общие настройки прокси
      template += "\n <div class=\"settings-param-title\">\n <span>#{online_mod_proxy}</span>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_proxy_other\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_proxy_other}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_proxy_other_url\" data-type=\"link\">\n <div class=\"settings-param__name\">#{online_mod_proxy_other_url}</div>\n <div class=\"settings-param__value\">" + (Lampa.Storage.field('online_mod_proxy_other_url') || 'https://') + "</div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_proxy_find_ip\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_proxy_find_ip}</div>\n <div class=\"settings-param__value\"></div>\n </div>";

      // Настройки качества
      template += "\n <div class=\"settings-param-title\">\n <span>#{online_mod_quality_title}</span>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_quality\" data-type=\"select\">\n <div class=\"settings-param__name\">#{online_mod_quality}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_rename_quality\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_rename_quality}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_prefer_mp4\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_prefer_mp4}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      template += "\n <div class=\"settings-param selector\" data-name=\"online_mod_prefer_http\" data-type=\"toggle\">\n <div class=\"settings-param__name\">#{online_mod_prefer_http}</div>\n <div class=\"settings-param__value\"></div>\n </div>";
      
      template += "\n </div>";

      // Создаем новый элемент DOM из очищенного шаблона
      e.body.append($(template));

      // Привязываем обработчики событий к элементам
      e.body.find('[data-name="online_mod_rezka2_mirror"]').data('value', Lampa.Storage.get('online_mod_rezka2_mirror', ''));
      Lampa.Params.update(e.body.find('[data-name="online_mod_rezka2_mirror"]'), Lampa.Storage.get('online_mod_rezka2_mirror', ''), e.body);

      // Обновления параметров прокси для rezka/rezka2:
      Lampa.Params.update(e.body.find('[data-name="online_mod_proxy_rezka2"]'), Lampa.Storage.field('online_mod_proxy_rezka2'), e.body);
      Lampa.Params.update(e.body.find('[data-name="online_mod_proxy_rezka"]'), Lampa.Storage.field('online_mod_proxy_rezka'), e.body);

    });

    Lampa.Component.add('online', component);

})();
