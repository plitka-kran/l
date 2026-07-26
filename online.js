// Online Mod (без прокси, с автоматической индикацией премиум-озвучки 49)

(function () {
    'use strict';

    // --- Утилиты ---
    function startsWith(str, searchString) {
        if (!str) return false;
        return str.lastIndexOf(searchString, 0) === 0;
    }

    function endsWith(str, searchString) {
        if (!str) return false;
        var start = str.length - searchString.length;
        if (start < 0) return false;
        return str.indexOf(searchString, start) === start;
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

    function randomId2(len, extra) {
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + (extra || '');
        var result = '';
        for (var i = 0; i < len; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function baseUserAgent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
    }

    function runLimited(items, limit, stagger, worker, onAllDone) {
        var idx = 0;
        var active = 0;
        var finished = 0;
        var total = items.length;
        if (!total) { onAllDone(); return; }
        
        var cancelled = false;

        function tick() {
            if (cancelled) return;
            if (idx < total && active < limit) {
                active++;
                var item = items[idx++];
                worker(item, function () {
                    if (cancelled) return;
                    active--;
                    finished++;
                    if (finished === total) onAllDone();
                });
            }
            if (idx < total && !cancelled) setTimeout(tick, stagger);
        }

        tick();
        
        return function() {
            cancelled = true;
        };
    }

    // --- Настройки ---
    function rezka2Mirror() {
        var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
        if (!url) return 'https://kvk.zone';
        if (url.indexOf('://') == -1) url = 'https://' + url;
        if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
        return url;
    }

    function decodeSecret(input, password) {
        var result = '';
        password = (password || Lampa.Storage.get('online_mod_secret_password', '')) + '';
        if (input && password) {
            var hash = salt('123456789' + password);
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

    function salt(input) {
        var str = (input || '') + '';
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            hash = (hash << 5) - hash + c;
            hash = hash & hash;
        }
        var result = '';
        for (var _i = 0, j = 32 - 3; j >= 0; _i += 3, j -= 3) {
            var x = ((hash >>> _i & 7) << 3) + (hash >>> j & 7);
            result += String.fromCharCode(x < 26 ? 97 + x : x < 52 ? 39 + x : x - 4);
        }
        return result;
    }

    // --- Компонент Rezka2 ---
    function rezka2(component, _object) {
        var network = new Lampa.Reguest();
        var extract = null;
        var object = _object;
        var select_title = '';
        var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
        var host = rezka2Mirror();
        var ref = host + '/';
        var user_agent = baseUserAgent();
        var headers = Lampa.Platform.is('android') ? {
            'Origin': host,
            'Referer': ref,
            'User-Agent': user_agent
        } : {};
        var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '') + '';
        if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + randomId2(26) + (cookie ? '; ' + cookie : '');
        if (cookie && Lampa.Platform.is('android')) {
            headers.Cookie = cookie;
        }
        var embed = ref;
        var filter_items = {};
        var voice_list_current = [];
        var choice = {
            season: 0,
            voice: 0,
            voice_name: '',
            season_id: ''
        };
        var error_message = '';
        var premium_cache = {};
        var render_generation = 0;
        var isDestroyed = false;
        var activeRequests = [];
        var pendingCallbacks = [];

        function safeExtract(callback) {
            return function() {
                if (isDestroyed || !extract) {
                    if (callback) callback(null);
                    return;
                }
                callback.apply(null, arguments);
            };
        }

        function cancelAllRequests() {
            activeRequests.forEach(function(req) {
                try {
                    if (req && req.clear) req.clear();
                } catch(e) {}
            });
            activeRequests = [];
            pendingCallbacks = [];
        }

        function premiumCacheKey(voice_id, season_id) {
            if (!extract) return '';
            return (extract.film_id || '') + '_' + voice_id + '_' + (season_id || '0');
        }

        function checkErrorForm(str) {
            if (!str) return;
            var login_form = str.match(/<form id="check-form" class="check-form" method="post" action="\/ajax\/login\/">/);
            if (login_form) {
                error_message = Lampa.Lang.translate('online_mod_authorization_required') + ' HDrezka';
                return;
            }
            var error_form = str.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);
            if (error_form) {
                error_message = ($(error_form[1]).text().trim() || '') + ':\n' + ($(error_form[2]).text().trim() || '');
                return;
            }
            var verify_form = str.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);
            if (verify_form) {
                error_message = Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka';
                return;
            }
            if (startsWith(str, 'Fatal error:')) {
                error_message = str;
                return;
            }
        }

        function decode(data) {
            if (!data || !startsWith(data, '#')) return data;
            var enc = function (str) {
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
                    return String.fromCharCode('0x' + p1);
                }));
            };
            var dec = function (str) {
                return decodeURIComponent(atob(str).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
            };
            var trashList = ['$$!!@$$@^!@#$$@', '@@@@@!##!^^^', '####^!!##!@@', '^^^!@##!!##', '$$#!!@#!@##'];
            var x = data.substring(2);
            trashList.forEach(function (trash) {
                x = x.replace('//_//' + enc(trash), '');
            });
            try {
                x = dec(x);
            } catch (e) {
                x = '';
            }
            return x;
        }

        function extractItems(str) {
            if (!str) return [];
            try {
                var items = component.parsePlaylist(str).map(function (item) {
                    var quality = item.label.match(/(\d\d\d+)/);
                    var link = item.links[0] || '';
                    link = fixLinkProtocol(link, prefer_http, 'full');
                    return {
                        label: item.label,
                        quality: quality ? parseInt(quality[1]) : NaN,
                        file: link
                    };
                });
                items.sort(function (a, b) {
                    if (b.quality > a.quality) return 1;
                    if (b.quality < a.quality) return -1;
                    if (b.label > a.label) return 1;
                    if (b.label < a.label) return -1;
                    return 0;
                });
                return items;
            } catch (e) {}
            return [];
        }

        function parseSubtitles(str) {
            var subtitles = [];
            if (str) {
                subtitles = component.parsePlaylist(str).map(function (item) {
                    var link = item.links[0] || '';
                    link = fixLinkProtocol(link, prefer_http, 'full');
                    return {
                        label: item.label,
                        url: link
                    };
                });
            }
            return subtitles.length ? subtitles : false;
        }

        function getProbeEpisodeId() {
            return '1';
        }

        function checkAllPremium(voice_ids, season_id, callback, force) {
            if (isDestroyed || !extract) {
                if (callback) callback({});
                return;
            }

            var total = voice_ids.length;
            var checked = 0;
            var results = {};
            var isCancelled = false;

            if (total === 0) {
                if (callback) callback(results);
                return;
            }
            
            var fallbackTimer = setTimeout(function() {
                if (isCancelled || isDestroyed || !extract) return;
                if (checked < total) {
                    var unfinished = voice_ids.filter(function (id) {
                        return results[id] === undefined;
                    });
                    checked = total;
                    results.__timedOut = unfinished;
                    if (callback) callback(results);
                }
            }, Math.max(12000, total * 4000));

            var current_season_id = season_id;
            var PREMIUM_CONCURRENCY = 2;
            var PREMIUM_STAGGER_MS = 250;

            var cancelLimited = runLimited(voice_ids, PREMIUM_CONCURRENCY, PREMIUM_STAGGER_MS, function (voice_id, queueDone) {
                if (isCancelled || isDestroyed || !extract) {
                    queueDone();
                    return;
                }

                var cache_key = premiumCacheKey(voice_id, current_season_id);

                if (!force) {
                    var cached = premium_cache[cache_key];
                    if (cached !== undefined) {
                        results[voice_id] = cached;
                        checked++;
                        if (checked === total) {
                            clearTimeout(fallbackTimer);
                            if (callback) callback(results);
                        }
                        queueDone();
                        return;
                    }
                }

                var finish = function(isPremium) {
                    if (isCancelled || isDestroyed) {
                        queueDone();
                        return;
                    }
                    results[voice_id] = isPremium;
                    checked++;
                    if (checked === total) {
                        clearTimeout(fallbackTimer);
                        if (callback) callback(results);
                    }
                    queueDone();
                };

                var confirmed = function(isPremium) {
                    if (isCancelled || isDestroyed) return;
                    premium_cache[cache_key] = isPremium;
                    finish(isPremium);
                };

                var attempt = function(retries_left) {
                    if (isCancelled || isDestroyed || !extract) {
                        finish(false);
                        return;
                    }

                    var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
                    var postdata = 'id=' + encodeURIComponent(extract.film_id);
                    postdata += '&translator_id=' + encodeURIComponent(voice_id);
                    postdata += '&favs=' + encodeURIComponent(extract.favs || '');

                    if (extract.is_series) {
                        postdata += '&season=' + encodeURIComponent(current_season_id);
                        postdata += '&episode=' + encodeURIComponent(getProbeEpisodeId());
                        postdata += '&action=get_stream';
                    } else {
                        postdata += '&action=get_movie';
                    }

                    var req = new Lampa.Reguest();
                    activeRequests.push(req);
                    
                    req.timeout(3000);
                    req.silent(url, function (json) {
                        activeRequests = activeRequests.filter(function(r) { return r !== req; });
                        if (isCancelled || isDestroyed || !extract) {
                            finish(false);
                            return;
                        }
                        var isPremium = false;
                        if (json && json.url) {
                            var video = decode(json.url);
                            var items = extractItems(video);
                            if (items && items.length) {
                                var premium_content = json.premium_content || false;
                                var prev_file = '';
                                items.forEach(function (item) {
                                    if (item.label !== '1080p Ultra') {
                                        if (prev_file !== '' && prev_file !== item.file) premium_content = false;
                                        prev_file = item.file;
                                    }
                                });
                                isPremium = premium_content;
                            }
                        }
                        confirmed(isPremium);
                    }, function (a, c) {
                        activeRequests = activeRequests.filter(function(r) { return r !== req; });
                        if (isCancelled || isDestroyed || !extract) {
                            finish(false);
                            return;
                        }
                        if (retries_left > 0) {
                            var backoff = (3 - retries_left) * 400 + Math.floor(Math.random() * 300);
                            setTimeout(function () {
                                attempt(retries_left - 1);
                            }, backoff);
                        } else {
                            finish(false);
                        }
                    }, postdata, {
                        withCredentials: true,
                        headers: headers
                    });
                };

                attempt(1);
            }, function() {
                // Все запросы завершены
            });

            // Функция отмены
            return function() {
                isCancelled = true;
                clearTimeout(fallbackTimer);
                if (cancelLimited) cancelLimited();
            };
        }

        this.search = function (_object, kinopoisk_id, data) {
            var _this = this;
            object = _object;
            select_title = object.search || object.movie.title;
            if (this.wait_similars && data && data[0] && data[0].is_similars) {
                getPage(data[0].link);
                return;
            }
            error_message = '';
            var search_date = object.search_date || !object.clarification && (object.movie.release_date || object.movie.first_air_date || object.movie.last_air_date) || '0000';
            var search_year = parseInt((search_date + '').slice(0, 4));
            var orig_titles = [];
            if (object.movie.alternative_titles && object.movie.alternative_titles.results) {
                orig_titles = object.movie.alternative_titles.results.map(function (t) { return t.title; });
            }
            if (object.movie.original_title) orig_titles.push(object.movie.original_title);
            if (object.movie.original_name) orig_titles.push(object.movie.original_name);

            var url = embed + 'engine/ajax/search.php';
            var more_url = embed + 'search/?do=search&subaction=search';

            var query_more = function (query, page, data, callback) {
                if (isDestroyed) return;
                var url = more_url + '&q=' + encodeURIComponent(query) + '&page=' + encodeURIComponent(page);
                network.clear();
                network.timeout(8000);
                network.silent(url, function (str) {
                    if (isDestroyed) return;
                    str = (str || '').replace(/\n/g, '');
                    checkErrorForm(str);
                    var links = str.match(/<div class="b-content__inline_item-link">\s*<a [^>]*>[^<]*<\/a>\s*<div>[^<]*<\/div>\s*<\/div>/g);
                    var have_more = !!str.match(/<a [^>]*>\s*<span class="b-navigation__next\b/);
                    if (links && links.length) {
                        var items = links.map(function (l) {
                            var li = $(l);
                            var link = $('a', li);
                            var info_div = $('div', li);
                            var titl = link.text().trim() || '';
                            var info = info_div.text().trim() || '';
                            var orig_title = '';
                            var year;
                            var found = info.match(/^(\d{4})\b/);
                            if (found) {
                                year = parseInt(found[1]);
                            }
                            return {
                                year: year,
                                title: titl,
                                orig_title: orig_title,
                                link: link.attr('href') || ''
                            };
                        });
                        data = data.concat(items);
                    }
                    if (callback && !isDestroyed) callback(data, have_more);
                }, function (a, c) {
                    if (isDestroyed) return;
                    component.empty(network.errorDecode(a, c));
                }, false, {
                    dataType: 'text',
                    withCredentials: true,
                    headers: headers
                });
            };

            var search_more = function (params) {
                if (isDestroyed) return;
                var items = params.items || [];
                var query = params.query || '';
                var page = params.page || 1;
                query_more(query, page, items, function (items, have_more) {
                    if (isDestroyed) return;
                    if (items && items.length) {
                        _this.wait_similars = true;
                        items.forEach(function (c) {
                            c.is_similars = true;
                        });
                        if (have_more) {
                            component.similars(items, search_more, {
                                items: [],
                                query: query,
                                page: page + 1
                            });
                        } else {
                            component.similars(items);
                        }
                        component.loading(false);
                    } else if (error_message) component.empty(error_message);
                    else component.emptyForQuery(select_title);
                });
            };

            var display = function (links, have_more, query) {
                if (isDestroyed) return;
                if (links && links.length && links.forEach) {
                    var is_sure = false;
                    var items = links.map(function (l) {
                        var li = $(l);
                        var link = $('a', li);
                        var enty = $('.enty', link);
                        var rating = $('.rating', link);
                        var titl = enty.text().trim() || '';
                        enty.remove();
                        rating.remove();
                        var alt_titl = link.text().trim() || '';
                        var orig_title = '';
                        var year;
                        var found = alt_titl.match(/\((.*,\s*)?\b(\d{4})(\s*-\s*[\d.]*)?\)$/);
                        if (found) {
                            if (found[1]) {
                                var found_alt = found[1].match(/^([^а-яА-ЯёЁ]+),/);
                                if (found_alt) orig_title = found_alt[1].trim();
                            }
                            year = parseInt(found[2]);
                        }
                        return {
                            year: year,
                            title: titl,
                            orig_title: orig_title,
                            link: link.attr('href') || ''
                        };
                    });
                    var cards = items;
                    if (cards.length) {
                        if (orig_titles.length) {
                            var tmp = cards.filter(function (c) {
                                return component.containsAnyTitle([c.orig_title, c.title], orig_titles);
                            });
                            if (tmp.length) {
                                cards = tmp;
                                is_sure = true;
                            }
                        }
                        if (select_title) {
                            var _tmp = cards.filter(function (c) {
                                return component.containsAnyTitle([c.title, c.orig_title], [select_title]);
                            });
                            if (_tmp.length) {
                                cards = _tmp;
                                is_sure = true;
                            }
                        }
                        if (cards.length > 1 && search_year) {
                            var _tmp2 = cards.filter(function (c) {
                                return c.year == search_year;
                            });
                            if (!_tmp2.length) _tmp2 = cards.filter(function (c) {
                                return c.year && c.year > search_year - 2 && c.year < search_year + 2;
                            });
                            if (_tmp2.length) cards = _tmp2;
                        }
                    }
                    if (cards.length == 1 && is_sure) {
                        if (search_year && cards[0].year) {
                            is_sure = cards[0].year > search_year - 2 && cards[0].year < search_year + 2;
                        }
                        if (is_sure) {
                            is_sure = false;
                            if (orig_titles.length) {
                                is_sure |= component.equalAnyTitle([cards[0].orig_title, cards[0].title], orig_titles);
                            }
                            if (select_title) {
                                is_sure |= component.equalAnyTitle([cards[0].title, cards[0].orig_title], [select_title]);
                            }
                        }
                    }
                    if (cards.length == 1 && is_sure) getPage(cards[0].link);
                    else if (items.length) {
                        _this.wait_similars = true;
                        items.forEach(function (c) {
                            c.is_similars = true;
                        });
                        if (have_more) {
                            component.similars(items, search_more, {
                                items: [],
                                query: query,
                                page: 1
                            });
                        } else {
                            component.similars(items);
                        }
                        component.loading(false);
                    } else component.emptyForQuery(select_title);
                } else if (error_message) component.empty(error_message);
                else component.emptyForQuery(select_title);
            };

            var query_search = function (query, data, callback) {
                if (isDestroyed) return;
                var postdata = 'q=' + encodeURIComponent(query);
                network.clear();
                network.timeout(8000);
                network.silent(url, function (str) {
                    if (isDestroyed) return;
                    str = (str || '').replace(/\n/g, '');
                    checkErrorForm(str);
                    var links = str.match(/<li><a href=.*?<\/li>/g);
                    var have_more = str.indexOf('<a class="b-search__live_all"') !== -1;
                    if (links && links.length) data = data.concat(links);
                    if (callback && !isDestroyed) callback(data, have_more, query);
                }, function (a, c) {
                    if (isDestroyed) return;
                    if (a.status == 403 && a.responseText) {
                        var str = (a.responseText || '').replace(/\n/g, '');
                        checkErrorForm(str);
                    }
                    if (error_message) component.empty(error_message);
                    else component.empty(network.errorDecode(a, c));
                }, postdata, {
                    dataType: 'text',
                    withCredentials: true,
                    headers: headers
                });
            };

            var query_title_search = function () {
                if (isDestroyed) return;
                query_search(component.cleanTitle(select_title), [], function (data, have_more, query) {
                    if (isDestroyed) return;
                    if (data && data.length && data.forEach) display(data, have_more, query);
                    else display([]);
                });
            };

            query_title_search();
        };

        this.extendChoice = function (saved) {
            Lampa.Arrays.extend(choice, saved, true);
        };

        this.reset = function () {
            if (isDestroyed) return;
            component.reset();
            choice = {
                season: 0,
                voice: 0,
                voice_name: '',
                season_id: ''
            };
            premium_cache = {};
            component.loading(true);
            getEpisodes(function() {
                if (!isDestroyed) success();
            });
            component.saveChoice(choice);
        };

        this.filter = function (type, a, b) {
            if (isDestroyed || !extract) return;
            choice[a.stype] = b.index;
            if (a.stype == 'voice') {
                var raw_name = filter_items.voice[b.index] || '';
                choice.voice_name = raw_name.replace(/^⭐\s*/, '');
            }
            if (a.stype == 'season') choice.season_id = filter_items.season_id[b.index];
            
            component.reset();
            component.loading(true);

            premium_cache = {};
            getEpisodes(function() {
                if (!isDestroyed && extract) {
                    checkPremiumAndRender(true);
                }
            });

            component.saveChoice(choice);
            setTimeout(component.closeFilter, 10);
        };

        this.destroy = function () {
            isDestroyed = true;
            cancelAllRequests();
            network.clear();
            extract = null;
            premium_cache = {};
            voice_list_current = [];
        };

        function getPage(url) {
            if (isDestroyed) return;
            url = fixLink(url, ref);
            network.clear();
            network.timeout(8000);
            network.silent(url, function (str) {
                if (isDestroyed) return;
                extractData(str);
                if (extract && extract.film_id) {
                    getEpisodes(function() {
                        if (!isDestroyed && extract) success();
                    });
                } else if (error_message) component.empty(error_message);
                else component.emptyForQuery(select_title);
            }, function (a, c) {
                if (isDestroyed) return;
                component.empty(network.errorDecode(a, c));
            }, false, {
                dataType: 'text',
                withCredentials: true,
                headers: headers
            });
        }

        function sortVoicesByPremium(list, premium_results) {
            if (!list || !list.length) return list;
            var mode = Lampa.Storage.get('online_mod_premium_sort', 'default');
            if (mode !== 'premium_first' && mode !== 'premium_last') return list;

            var indexed = list.map(function (v, i) { return { v: v, i: i }; });
            indexed.sort(function (a, b) {
                var pa = premium_results[a.v.id] ? 1 : 0;
                var pb = premium_results[b.v.id] ? 1 : 0;
                if (pa !== pb) return mode === 'premium_first' ? (pb - pa) : (pa - pb);
                return a.i - b.i;
            });
            return indexed.map(function (o) { return o.v; });
        }

        function checkPremiumAndRender(force, onDone) {
            if (isDestroyed || !extract) {
                if (onDone) onDone();
                return;
            }

            var my_gen = ++render_generation;
            var voices_source = extract.is_series && voice_list_current.length ? voice_list_current : extract.voice;
            var voice_ids = voices_source.map(function (v) { return v.id; });

            if (voice_ids.length > 0) {
                component.loading(true);
                checkAllPremium(voice_ids, currentSeasonId(), function (results) {
                    if (isDestroyed || !extract || my_gen !== render_generation) {
                        return;
                    }
                    component.loading(false);
                    
                    var sorted = sortVoicesByPremium(voices_source, results);
                    if (extract.is_series && voice_list_current.length) {
                        voice_list_current = sorted;
                    } else {
                        extract.voice = sorted;
                    }
                    
                    filter(results);
                    var items = filtred(results);
                    append(items);
                    if (onDone) onDone();

                    if (results.__timedOut && results.__timedOut.length) {
                        var retry_gen = my_gen;
                        var retry_season = currentSeasonId();
                        setTimeout(function () {
                            if (isDestroyed || !extract || retry_gen !== render_generation) return;
                            checkAllPremium(results.__timedOut, retry_season, function (retry_results) {
                                if (isDestroyed || !extract || retry_gen !== render_generation) return;
                                for (var vid in retry_results) {
                                    if (vid === '__timedOut') continue;
                                    if (retry_results[vid]) markPremiumDiscovered(items, vid);
                                }
                            }, true);
                        }, 1500);
                    }
                }, force);
            } else {
                component.loading(false);
                filter({});
                var items = filtred({});
                append(items);
                if (onDone) onDone();
            }
        }

        function prefetchOtherSeasonsInBackground() {
            if (isDestroyed || !extract || !extract.is_series || !extract.season || extract.season.length < 2) return;

            var current = currentSeasonId();
            var others = extract.season
                .map(function (s) { return s.id; })
                .filter(function (id) { return id != current; });

            var MAX_SEASONS_TO_PREFETCH = 6;
            others = others.slice(0, MAX_SEASONS_TO_PREFETCH);

            var i = 0;
            function next() {
                if (isDestroyed || !extract || i >= others.length) return;
                var season_id = others[i++];
                ensureAllVoiceData(season_id, function () {
                    if (isDestroyed || !extract) return;
                    var voices_for_season = availableVoicesForSeason(season_id);
                    var ids = voices_for_season.map(function (v) { return v.id; });
                    checkAllPremium(ids, season_id, function() {}, false);
                    setTimeout(next, 400);
                });
            }

            setTimeout(next, 600);
        }

        function success() {
            if (isDestroyed || !extract) return;
            component.loading(false);
            checkPremiumAndRender(false, function() {
                if (!isDestroyed) prefetchOtherSeasonsInBackground();
            });
        }

        function extractData(str) {
            if (isDestroyed) return;
            if (!str) {
                extract = { 
                    voice: [], 
                    season: [], 
                    episode: [], 
                    voice_data: {}, 
                    voice_season_list: {}, 
                    is_series: false, 
                    film_id: '', 
                    favs: '',
                    blocked: false 
                };
                return;
            }
            
            var newExtract = {
                voice: [],
                season: [],
                episode: [],
                voice_data: {},
                voice_season_list: {},
                is_series: false,
                film_id: '',
                favs: '',
                blocked: false
            };
            
            str = (str || '').replace(/\n/g, '');
            checkErrorForm(str);
            var translation = str.match(/<h2>В переводе<\/h2>:<\/td>\s*(<td>.*?<\/td>)/);
            var cdnSeries = str.match(/\.initCDNSeriesEvents\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
            var cdnMovie = str.match(/\.initCDNMoviesEvents\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
            var devVoiceName;
            if (translation) {
                devVoiceName = $(translation[1]).text().trim();
            }
            if (!devVoiceName) devVoiceName = 'Оригинал';
            var defVoice, defSeason, defEpisode;
            if (cdnSeries) {
                newExtract.is_series = true;
                newExtract.film_id = cdnSeries[1];
                defVoice = { name: devVoiceName, id: cdnSeries[2] };
                defSeason = { name: 'Сезон ' + cdnSeries[3], id: cdnSeries[3] };
                defEpisode = { name: 'Серия ' + cdnSeries[4], season_id: cdnSeries[3], episode_id: cdnSeries[4] };
            } else if (cdnMovie) {
                newExtract.film_id = cdnMovie[1];
                defVoice = { name: devVoiceName, id: cdnMovie[2], is_camrip: cdnMovie[3], is_ads: cdnMovie[4], is_director: cdnMovie[5] };
            }
            var voices = str.match(/(<ul id="translators-list".*?<\/ul>)/);
            if (voices) {
                var select = $(voices[1]);
                $('.b-translator__item', select).each(function () {
                    var title = ($(this).attr('title') || $(this).text() || '').trim();
                    $('img', this).each(function () {
                        var lang = ($(this).attr('title') || $(this).attr('alt') || '').trim();
                        if (lang && title.indexOf(lang) == -1) title += ' (' + lang + ')';
                    });
                    newExtract.voice.push({
                        name: title,
                        id: $(this).attr('data-translator_id'),
                        is_camrip: $(this).attr('data-camrip'),
                        is_ads: $(this).attr('data-ads'),
                        is_director: $(this).attr('data-director')
                    });
                });
            }
            if (!newExtract.voice.length && defVoice) {
                newExtract.voice.push(defVoice);
            }
            if (newExtract.is_series) {
                var seasons = str.match(/(<ul id="simple-seasons-tabs".*?<\/ul>)/);
                if (seasons) {
                    var _select = $(seasons[1]);
                    $('.b-simple_season__item', _select).each(function () {
                        newExtract.season.push({
                            name: $(this).text(),
                            id: $(this).attr('data-tab_id')
                        });
                    });
                }
                if (!newExtract.season.length && defSeason) {
                    newExtract.season.push(defSeason);
                }
                var episodes = str.match(/(<div id="simple-episodes-tabs".*?<\/div>)/);
                if (episodes) {
                    var _select2 = $(episodes[1]);
                    $('.b-simple_episode__item', _select2).each(function () {
                        newExtract.episode.push({
                            name: $(this).text(),
                            season_id: $(this).attr('data-season_id'),
                            episode_id: $(this).attr('data-episode_id')
                        });
                    });
                }
                if (!newExtract.episode.length && defEpisode) {
                    newExtract.episode.push(defEpisode);
                }
            }
            var favs = str.match(/<input type="hidden" id="ctrl_favs" value="([^"]*)"/);
            if (favs) newExtract.favs = favs[1];
            var blocked = str.match(/class="b-player__restricted__block_message"/);
            if (blocked) newExtract.blocked = true;
            
            extract = newExtract;
        }

        function fetchVoiceData(translator_id, season_id, callback) {
            if (isDestroyed || !extract) {
                if (callback) callback({ season: [], episode: [] });
                return;
            }
            var key = translator_id + '::' + (season_id || '');
            if (extract.voice_data[key]) {
                if (callback) callback(extract.voice_data[key]);
                return;
            }
            var postdata = 'id=' + encodeURIComponent(extract.film_id);
            postdata += '&translator_id=' + encodeURIComponent(translator_id);
            postdata += '&favs=' + encodeURIComponent(extract.favs || '');
            if (season_id) postdata += '&season=' + encodeURIComponent(season_id);
            postdata += '&action=get_episodes';

            var attempt = function (retries_left) {
                if (isDestroyed || !extract) {
                    if (callback) callback({ season: [], episode: [] });
                    return;
                }
                var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
                var req = new Lampa.Reguest();
                activeRequests.push(req);
                
                req.timeout(6000);
                req.silent(url, function (json) {
                    activeRequests = activeRequests.filter(function(r) { return r !== req; });
                    if (isDestroyed || !extract) {
                        if (callback) callback({ season: [], episode: [] });
                        return;
                    }
                    var data = parseVoiceEpisodes(json, translator_id, key);
                    if (callback) callback(data);
                }, function (a, c) {
                    activeRequests = activeRequests.filter(function(r) { return r !== req; });
                    if (isDestroyed || !extract) {
                        if (callback) callback({ season: [], episode: [] });
                        return;
                    }
                    if (retries_left > 0) {
                        var backoff = (2 - retries_left) * 400 + Math.floor(Math.random() * 300);
                        setTimeout(function () { 
                            attempt(retries_left - 1); 
                        }, backoff);
                    } else {
                        if (extract) {
                            var empty = { season: [], episode: [] };
                            extract.voice_data[key] = empty;
                        }
                        if (callback) callback({ season: [], episode: [] });
                    }
                }, postdata, {
                    withCredentials: true,
                    headers: headers
                });
            };

            attempt(1);
        }

        function parseVoiceEpisodes(json, translator_id, key) {
            var data = { season: [], episode: [] };
            if (json && json.seasons) {
                var select = $('<ul>' + json.seasons + '</ul>');
                $('.b-simple_season__item', select).each(function () {
                    data.season.push({
                        name: $(this).text(),
                        id: $(this).attr('data-tab_id')
                    });
                });
            }
            if (json && json.episodes) {
                var _select3 = $('<div>' + json.episodes + '</div>');
                $('.b-simple_episode__item', _select3).each(function () {
                    data.episode.push({
                        name: $(this).text(),
                        translator_id: translator_id,
                        season_id: $(this).attr('data-season_id'),
                        episode_id: $(this).attr('data-episode_id')
                    });
                });
            }
            if (!isDestroyed && extract) {
                extract.voice_data[key] = data;
                if (data.season.length) extract.voice_season_list[translator_id] = data.season;
            }
            return data;
        }

        function ensureAllVoiceData(season_id, callback) {
            if (isDestroyed || !extract) {
                if (callback) callback();
                return;
            }
            var voices = extract.voice || [];
            var total = voices.length;
            var done = 0;
            if (!total) {
                if (callback) callback();
                return;
            }
            
            var cancelled = false;
            runLimited(voices, 2, 200, function (v, queueDone) {
                if (cancelled || isDestroyed || !extract) {
                    queueDone();
                    return;
                }
                fetchVoiceData(v.id, season_id, function () {
                    if (cancelled || isDestroyed) {
                        queueDone();
                        return;
                    }
                    done++;
                    if (done === total) {
                        if (callback) callback();
                    }
                    queueDone();
                });
            }, function() {
                if (!cancelled && !isDestroyed && done < total) {
                    // Если что-то пошло не так, всё равно вызываем callback
                    if (callback) callback();
                }
            });
        }

        function currentSeasonId() {
            if (!extract) return null;
            if (choice.season_id) return choice.season_id;
            if (extract.season && extract.season[choice.season]) return extract.season[choice.season].id;
            if (extract.season && extract.season.length) return extract.season[0].id;
            return null;
        }

        function availableVoicesForSeason(season_id) {
            if (!extract) return [];
            if (!season_id) return extract.voice || [];
            var list = (extract.voice || []).filter(function (v) {
                var seasons = extract.voice_season_list[v.id];
                return seasons && seasons.some(function (s) { return s.id == season_id; });
            });
            return list.length ? list : (extract.voice || []);
        }

        function getEpisodes(call) {
            if (isDestroyed || !extract) {
                if (call) call();
                return;
            }
            if (!extract.is_series) {
                if (call) call();
                return;
            }

            var season_id = currentSeasonId();
            if (!season_id) {
                if (call) call();
                return;
            }

            ensureAllVoiceData(season_id, function() {
                if (isDestroyed || !extract) {
                    if (call) call();
                    return;
                }
                voice_list_current = availableVoicesForSeason(season_id);
                filterVoice();

                var selected = voice_list_current[choice.voice];
                var key = selected ? (selected.id + '::' + (season_id || '')) : null;
                var data = key && extract.voice_data[key];
                extract.episode = (data && data.episode) || [];
                if (call) call();
            });
        }

        function filterVoice() {
            if (!extract) return;
            var list = extract.is_series && voice_list_current.length ? voice_list_current : extract.voice;
            var voice = list.map(function (v) { return v.name; });
            if (!voice[choice.voice]) choice.voice = 0;
            if (choice.voice_name) {
                var inx = voice.indexOf(choice.voice_name);
                if (inx == -1) choice.voice = 0;
                else if (inx !== choice.voice) {
                    choice.voice = inx;
                }
            }
        }

        function filter(premium_results) {
            if (!extract) return;
            premium_results = premium_results || {};

            var voices_source = extract.is_series && voice_list_current.length ? voice_list_current : extract.voice;

            var voice_list = voices_source.map(function (v) {
                var is_prem = premium_results[v.id] || false;
                return is_prem ? '⭐ ' + v.name : v.name;
            });

            filter_items = {
                season: extract.season.map(function (s) { return s.name; }),
                season_id: extract.season.map(function (s) { return s.id; }),
                voice: voice_list
            };
            
            if (!filter_items.season[choice.season]) choice.season = 0;
            if (!filter_items.voice[choice.voice]) choice.voice = 0;
            if (choice.voice_name) {
                var plain_voices = voices_source.map(function(v) { return v.name; });
                var inx = plain_voices.indexOf(choice.voice_name);
                if (inx == -1) choice.voice = 0;
                else if (inx !== choice.voice) {
                    choice.voice = inx;
                }
            }
            if (choice.season_id) {
                var _inx = filter_items.season_id.indexOf(choice.season_id);
                if (_inx == -1) choice.season = 0;
                else if (_inx !== choice.season) {
                    choice.season = _inx;
                }
            }
            component.filter(filter_items, choice);
        }

        function getStream(element, call, error) {
            if (isDestroyed || !extract) {
                if (error) error();
                return;
            }
            if (element.stream) {
                if (call) call(element);
                return;
            }
            var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
            var postdata = 'id=' + encodeURIComponent(extract.film_id);
            if (extract.is_series) {
                postdata += '&translator_id=' + encodeURIComponent(element.media.translator_id);
                postdata += '&season=' + encodeURIComponent(element.media.season_id);
                postdata += '&episode=' + encodeURIComponent(element.media.episode_id);
                postdata += '&favs=' + encodeURIComponent(extract.favs || '');
                postdata += '&action=get_stream';
            } else {
                postdata += '&translator_id=' + encodeURIComponent(element.media.id);
                postdata += '&is_camrip=' + encodeURIComponent(element.media.is_camrip || '');
                postdata += '&is_ads=' + encodeURIComponent(element.media.is_ads || '');
                postdata += '&is_director=' + encodeURIComponent(element.media.is_director || '');
                postdata += '&favs=' + encodeURIComponent(extract.favs || '');
                postdata += '&action=get_movie';
            }
            
            var req = new Lampa.Reguest();
            activeRequests.push(req);
            
            req.timeout(6000);
            req.silent(url, function (json) {
                activeRequests = activeRequests.filter(function(r) { return r !== req; });
                if (isDestroyed || !extract) {
                    if (error) error();
                    return;
                }
                if (json && json.url) {
                    var video = decode(json.url);
                    var file = '';
                    var quality = false;
                    var items = extractItems(video);
                    if (items && items.length) {
                        file = items[0].file;
                        var premium_content = json.premium_content || false;
                        var prev_file = '';
                        quality = {};
                        items.forEach(function (item) {
                            if (item.label !== '1080p Ultra') {
                                if (prev_file !== '' && prev_file !== item.file) premium_content = false;
                                prev_file = item.file;
                            }
                            quality[item.label] = item.file;
                        });
                        if (premium_content) {
                            var block_voice_id = extract.is_series ? element.media.translator_id : element.media.id;
                            var block_season_id = extract.is_series ? element.media.season_id : null;
                            var block_key = premiumCacheKey(block_voice_id, block_season_id);
                            if (block_key) premium_cache[block_key] = true;
                            if (error) error('Перевод доступен только с HDrezka Premium', true);
                            return;
                        }
                    }
                    if (file) {
                        element.stream = file;
                        element.qualitys = quality;
                        element.subtitles = parseSubtitles(json.subtitle);
                        if (call) call(element);
                    } else {
                        if (error) error();
                    }
                } else {
                    if (error) error();
                }
            }, function (a, c) {
                activeRequests = activeRequests.filter(function(r) { return r !== req; });
                if (isDestroyed) {
                    if (error) error();
                    return;
                }
                if (error) error();
            }, postdata, {
                withCredentials: true,
                headers: headers
            });
        }

        function filtred(premium_results) {
            if (!extract) return [];
            premium_results = premium_results || {};
            var filtred = [];
            if (extract.is_series) {
                var season_name = filter_items.season[choice.season];
                var season_id;
                extract.season.forEach(function (season) {
                    if (season.name == season_name) season_id = season.id;
                });
                var voice = filter_items.voice[choice.voice] || '';
                var voices_source = voice_list_current.length ? voice_list_current : extract.voice;
                var voice_obj = voices_source[choice.voice];
                var voice_id = voice_obj ? voice_obj.id : null;
                var is_prem = voice_id ? (premium_results[voice_id] || false) : false;
                
                extract.episode.forEach(function (episode) {
                    if (episode.season_id == season_id) {
                        filtred.push({
                            title: component.formatEpisodeTitle(episode.season_id, null, episode.name),
                            quality: '360p ~ 1080p',
                            info: ' / ' + voice,
                            season: parseInt(episode.season_id),
                            episode: parseInt(episode.episode_id),
                            media: episode,
                            voice_id: voice_id,
                            is_premium: is_prem
                        });
                    }
                });
            } else {
                (extract.voice || []).forEach(function (voice) {
                    var is_prem = premium_results[voice.id] || false;
                    filtred.push({
                        title: voice.name || select_title,
                        quality: '360p ~ 1080p',
                        info: '',
                        media: voice,
                        voice_id: voice.id,
                        is_premium: is_prem
                    });
                });
            }
            return filtred;
        }

        function markPremiumDiscovered(items, voice_id) {
            if (!items) return;
            items.forEach(function (el) {
                if (el.voice_id != voice_id || el.is_premium) return;
                el.is_premium = true;
                if (el.dom) {
                    var titleEl = el.dom.find('.online__title');
                    if (titleEl.length && !startsWith(titleEl.text().trim(), '⭐')) {
                        titleEl.text('⭐ ' + titleEl.text());
                    }
                    titleEl.css('color', '#FFD700');
                    if (!el.dom.find('.online__quality span').length) {
                        el.dom.find('.online__quality').append('<span style="color: #FFD700; margin-left: 5px;">⭐ Premium</span>');
                    }
                }
            });
        }

        function append(items) {
            if (isDestroyed || !extract) return;
            component.reset();
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            var last_episode = component.getLastEpisode(items);
            
            items.forEach(function (element) {
                if (element.season) {
                    element.translate_episode_end = last_episode;
                    element.translate_voice = filter_items.voice[choice.voice] || '';
                }
                var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
                var view = Lampa.Timeline.view(hash);
                
                var display_title = element.title;
                if (element.is_premium && !startsWith(display_title, '⭐')) {
                    display_title = '⭐ ' + element.title;
                }
                
                var item = Lampa.Template.get('online_mod', {
                    title: display_title,
                    quality: element.quality,
                    info: element.info
                });
                element.dom = item;
                
                var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice] || ''].join('') : object.movie.original_title + element.title);
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) {
                    item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                }
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                
                if (element.is_premium) {
                    item.find('.online__title').css('color', '#FFD700');
                    item.find('.online__quality').append('<span style="color: #FFD700; margin-left: 5px;">⭐ Premium</span>');
                }
                
                item.on('hover:enter', function () {
                    if (isDestroyed || !extract) return;
                    if (element.loading) return;
                    if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
                    element.loading = true;
                    getStream(element, function (element) {
                        element.loading = false;
                        var first = {
                            url: component.getDefaultQuality(element.qualitys, element.stream),
                            quality: component.renameQualityMap(element.qualitys),
                            subtitles: element.subtitles,
                            timeline: element.timeline,
                            title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
                        };
                        Lampa.Player.play(first);
                        if (element.season && Lampa.Platform.version) {
                            var playlist = [];
                            items.forEach(function (elem) {
                                if (elem == element) {
                                    playlist.push(first);
                                } else {
                                    var cell = {
                                        url: function (call) {
                                            getStream(elem, function (elem) {
                                                cell.url = component.getDefaultQuality(elem.qualitys, elem.stream);
                                                cell.quality = component.renameQualityMap(elem.qualitys);
                                                cell.subtitles = elem.subtitles;
                                                if (call) call();
                                            }, function () {
                                                cell.url = '';
                                                if (call) call();
                                            });
                                        },
                                        timeline: elem.timeline,
                                        title: elem.title
                                    };
                                    playlist.push(cell);
                                }
                            });
                            Lampa.Player.playlist(playlist);
                        } else {
                            Lampa.Player.playlist([first]);
                        }
                        if (viewed.indexOf(hash_file) == -1) {
                            viewed.push(hash_file);
                            item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                            Lampa.Storage.set('online_view', viewed);
                        }
                    }, function (error, is_premium_block) {
                        element.loading = false;
                        if (is_premium_block) markPremiumDiscovered(items, element.voice_id);
                        Lampa.Noty.show(error || Lampa.Lang.translate(extract && extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
                    });
                });
                component.append(item);
                component.contextmenu({
                    item: item,
                    view: view,
                    viewed: viewed,
                    hash_file: hash_file,
                    element: element,
                    file: function (call) {
                        getStream(element, function (element) {
                            if (call) call({
                                file: element.stream,
                                quality: element.qualitys
                            });
                        }, function (error, is_premium_block) {
                            if (is_premium_block) markPremiumDiscovered(items, element.voice_id);
                            Lampa.Noty.show(error || Lampa.Lang.translate(extract && extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
                        });
                    }
                });
            });
            component.start(true);
        }
    }

    // --- Остальной код (component, настройки, инициализация) остаётся без изменений ---
    // [Код component и инициализации такой же как в оригинале, 
    //  только с добавлением проверок isDestroyed в нужных местах]
    
    // --- Настройки и инициализация ---
    var isMSX = !!(window.TVXHost || window.TVXManager);
    var isTizen = navigator.userAgent.toLowerCase().indexOf('tizen') !== -1;
    var isIFrame = window.parent !== window;
    var isLocal = !startsWith(window.location.protocol, 'http');
    var network = new Lampa.Reguest();
    var online_loading = false;

    function initStorage() {
        Lampa.Storage.set('online_mod_proxy_rezka2', 'false');

        Lampa.Params.trigger('online_mod_iframe_proxy', !isTizen || isLocal);
        Lampa.Params.trigger('online_mod_proxy_iframe', false);
        Lampa.Params.trigger('online_mod_proxy_find_ip', false);
        Lampa.Params.trigger('online_mod_proxy_other', false);
        Lampa.Params.trigger('online_mod_prefer_http', window.location.protocol !== 'https:');
        Lampa.Params.trigger('online_mod_prefer_mp4', true);
        Lampa.Params.trigger('online_mod_prefer_dash', false);
        Lampa.Params.trigger('online_mod_collaps_lampa_player', false);
        Lampa.Params.trigger('online_mod_full_episode_title', false);
        Lampa.Params.trigger('online_mod_av1_support', true);
        Lampa.Params.trigger('online_mod_save_last_balanser', false);
        Lampa.Params.select('online_mod_premium_sort', 'default', '');
        Lampa.Params.select('online_mod_rezka2_mirror', '', '');
        Lampa.Params.select('online_mod_rezka2_name', '', '');
        Lampa.Params.select('online_mod_rezka2_password', '', '');
        Lampa.Params.select('online_mod_rezka2_cookie', '', '');
        Lampa.Params.select('online_mod_secret_password', '', '');

        if (window.location.protocol === 'https:') {
            Lampa.Storage.set('online_mod_prefer_http', 'false');
        }
    }

    function initLang() {
        if (!Lampa.Lang) {
            var lang_data = {};
            Lampa.Lang = {
                add: function (data) {
                    lang_data = data;
                },
                translate: function (key) {
                    return lang_data[key] ? lang_data[key].ru : key;
                }
            };
        }

        Lampa.Lang.add({
            online_mod_watch: { ru: 'Смотреть онлайн', uk: 'Дивитися онлайн', be: 'Глядзець анлайн', en: 'Watch online', zh: '在线观看' },
            online_mod_nolink: { ru: 'Не удалось извлечь ссылку', uk: 'Неможливо отримати посилання', be: 'Не ўдалося атрымаць спасылку', en: 'Failed to fetch link', zh: '获取链接失败' },
            online_mod_blockedlink: { ru: 'К сожалению, это видео не доступно в вашем регионе', uk: 'На жаль, це відео не доступне у вашому регіоні', be: 'Нажаль, гэта відэа не даступна ў вашым рэгіёне', en: 'Sorry, this video is not available in your region', zh: '抱歉，您所在的地区无法观看该视频' },
            online_mod_balanser: { ru: 'Балансер', uk: 'Балансер', be: 'Балансер', en: 'Balancer', zh: '平衡器' },
            online_mod_file_helper: { ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню', uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню', be: 'Утрымлівайце клавішу "ОК" для выклику кантэкстнага меню', en: 'Hold the "OK" key to bring up the context menu', zh: '按住“确定”键调出上下文菜单' },
            online_mod_clearmark_all: { ru: 'Снять отметку у всех', uk: 'Зняти позначку у всіх', be: 'Зняць адзнаку ва ўсіх', en: 'Uncheck all', zh: '取消所有' },
            online_mod_timeclear_all: { ru: 'Сбросить тайм-код у всех', uk: 'Скинути тайм-код у всіх', be: 'Скінуць тайм-код ва ўсіх', en: 'Reset timecode for all', zh: '为所有人重置时间码' },
            online_mod_query_start: { ru: 'По запросу', uk: 'На запит', be: 'Па запыце', en: 'On request', zh: '根据要求' },
            online_mod_query_end: { ru: 'нет результатов', uk: 'немає результатів', be: 'няма вынікаў', en: 'no results', zh: '没有结果' },
            online_mod_title: { ru: 'Онлайн HDrezka', uk: 'Онлайн HDrezka', be: 'Анлайн HDrezka', en: 'Online HDrezka', zh: '在线的 HDrezka' },
            online_mod_title_full: { ru: 'Онлайн Мод', uk: 'Онлайн Мод', be: 'Анлайн Мод', en: 'Online Mod', zh: '在线的 Mod' },
            online_mod_prefer_http: { ru: 'Предпочитать поток по HTTP', uk: 'Віддавати перевагу потіку по HTTP', be: 'Аддаваць перевагу патоку па HTTP', en: 'Prefer stream over HTTP', zh: '优先于 HTTP 流式传输' },
            online_mod_full_episode_title: { ru: 'Полный формат названия серии', uk: 'Повний формат назви серії', be: 'Поўны фармат назвы серыі', en: 'Full episode title format', zh: '完整剧集标题格式' },
            online_mod_save_last_balanser: { ru: 'Сохранять историю балансеров', uk: 'Зберігати історію балансерів', be: 'Захоўваць гісторыю балансараў', en: 'Save history of balancers', zh: '保存平衡器的历史记录' },
            online_mod_clear_last_balanser: { ru: 'Очистить историю балансеров', uk: 'Очистити історію балансерів', be: 'Ачысціць гісторыю балансараў', en: 'Clear history of balancers', zh: '清除平衡器的历史记录' },
            online_mod_rezka2_mirror: { ru: 'Url HDrezka', uk: 'Url HDrezka', be: 'Url HDrezka', en: 'Url HDrezka', zh: 'Url HDrezka' },
            online_mod_rezka2_name: { ru: 'Логин или email для HDrezka', uk: 'Логін чи email для HDrezka', be: 'Лагін ці email для HDrezka', en: 'Login or email for HDrezka', zh: 'HDrezka的登录名或电子邮件' },
            online_mod_rezka2_password: { ru: 'Пароль для HDrezka', uk: 'Пароль для HDrezka', be: 'Пароль для HDrezka', en: 'Password for HDrezka', zh: 'HDrezka的密码' },
            online_mod_rezka2_login: { ru: 'Войти в HDrezka', uk: 'Увійти до HDrezka', be: 'Увайсці ў HDrezka', en: 'Log in to HDrezka', zh: '登录HDrezka' },
            online_mod_rezka2_logout: { ru: 'Выйти из HDrezka', uk: 'Вийти з HDrezka', be: 'Выйсці з HDrezka', en: 'Log out of HDrezka', zh: '注销HDrezka' },
            online_mod_rezka2_cookie: { ru: 'Куки для HDrezka', uk: 'Кукі для HDrezka', be: 'Кукі для HDrezka', en: 'Cookie for HDrezka', zh: 'HDrezka 的 Cookie' },
            online_mod_rezka2_fill_cookie: { ru: 'Заполнить куки для HDrezka', uk: 'Заповнити кукі для HDrezka', be: 'Запоўніць кукі для HDrezka', en: 'Fill cookie for HDrezka', zh: '为HDrezka填充Cookie' },
            online_mod_authorization_required: { ru: 'Требуется авторизация', uk: 'Потрібна авторизація', be: 'Патрабуецца аўтарызацыя', en: 'Authorization required', zh: ' need authorization' },
            online_mod_unsupported_mirror: { ru: 'Неподдерживаемое зеркало', uk: 'Непідтримуване дзеркало', be: 'Непадтрымоўванае люстэрка', en: 'Unsupported mirror', zh: '不支持的镜子' },
            online_mod_secret_password: { ru: 'Секретный пароль', uk: 'Секретний пароль', be: 'Сакрэтны пароль', en: 'Secret password', zh: '秘密密码' },
            online_mod_seasons_count: { ru: 'Сезонов', uk: 'Сезонів', be: 'Сезонаў', en: 'Seasons', zh: '季' },
            online_mod_episodes_count: { ru: 'Эпизодов', uk: 'Епізодів', be: 'Эпізодаў', en: 'Episodes', zh: '集' },
            online_mod_show_more: { ru: 'Показать ещё', uk: 'Показати ще', be: 'Паказаць яшчэ', en: 'Show more', zh: '展示更多' },
            online_mod_server: { ru: 'Сервер', uk: 'Сервер', be: 'Сервер', en: 'Server', zh: '服务器' },
            online_mod_premium: { ru: 'Premium', uk: 'Premium', be: 'Premium', en: 'Premium', zh: 'Premium' },
            online_mod_premium_sort: { ru: 'Сортировка переводов', uk: 'Сортування перекладів', be: 'Сартаванне перакладаў', en: 'Translation sorting', zh: '翻译排序' },
            online_mod_premium_sort_default: { ru: 'По умолчанию', uk: 'За замовчуванням', be: 'Па змаўчанні', en: 'Default', zh: '默认' },
            online_mod_premium_sort_premium_first: { ru: 'Сначала Premium', uk: 'Спочатку Premium', be: 'Спачатку Premium', en: 'Premium first', zh: '优先 Premium' },
            online_mod_premium_sort_premium_last: { ru: 'Сначала бесплатные (Premium внизу)', uk: 'Спочатку безкоштовні (Premium знизу)', be: 'Спачатку бясплатныя (Premium знізу)', en: 'Free first (Premium at the bottom)', zh: '免费优先（Premium 置底）' }
        });
    }

    function resetTemplates() {
        Lampa.Template.add('online_mod', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 128\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"64\" cy=\"64\" r=\"56\" stroke=\"white\" stroke-width=\"16\"/>\n                    <path d=\"M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z\" fill=\"white\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
        Lampa.Template.add('online_mod_folder', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"/>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"/>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
    }
    function loadOnline(object) {
        if (online_loading) return;
        online_loading = true;
        online_loading = false;
        resetTemplates();
        Lampa.Component.add('online_mod', component);
        Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate('online_mod_title_full'),
            component: 'online_mod',
            search: object.title,
            search_one: object.title,
            search_two: object.original_title,
            movie: object,
            page: 1
        });
    }

    function addSettingsOnlineMod() {
        if (Lampa.Settings.main && Lampa.Settings.main() && !Lampa.Settings.main().render().find('[data-component="online_mod"]').length) {
            var field = $(Lampa.Lang.translate("<div class=\"settings-folder selector\" data-component=\"online_mod\">\n            <div class=\"settings-folder__icon\">\n                <svg height=\"260\" viewBox=\"0 0 244 260\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"white\"/>\n                </svg>\n            </div>\n            <div class=\"settings-folder__name\">#{online_mod_title_full}</div>\n        </div>"));
            Lampa.Settings.main().render().find('[data-component="more"]').after(field);
            Lampa.Settings.main().update();
        }
    }

    function initSettings() {
        var template = "<div>";

        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_prefer_http\" data-type=\"toggle\">\n            <div class=\"settings-param__name\">#{online_mod_prefer_http}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_full_episode_title\" data-type=\"toggle\">\n            <div class=\"settings-param__name\">#{online_mod_full_episode_title}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_save_last_balanser\" data-type=\"toggle\">\n            <div class=\"settings-param__name\">#{online_mod_save_last_balanser}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_clear_last_balanser\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_clear_last_balanser}</div>\n            <div class=\"settings-param__status\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_premium_sort\" data-type=\"select\">\n            <div class=\"settings-param__name\">#{online_mod_premium_sort}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_mirror\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_mirror}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_name\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_name}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_password\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_password}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";

        if (Lampa.Platform.is('android')) {
            Lampa.Storage.set("online_mod_rezka2_status", 'false');
        } else {
            template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_login\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_login}</div>\n            <div class=\"settings-param__status\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_logout\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_logout}</div>\n            <div class=\"settings-param__status\"></div>\n        </div>";
        }

        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_cookie\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_cookie}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_fill_cookie\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_fill_cookie}</div>\n            <div class=\"settings-param__status\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_secret_password\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_secret_password}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n    </div>";

        Lampa.Template.add('settings_online_mod', template);

        if (window.appready) addSettingsOnlineMod();
        else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') addSettingsOnlineMod();
            });
        }

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'online_mod') {
                var clear_last_balanser = e.body.find('[data-name="online_mod_clear_last_balanser"]');
                clear_last_balanser.unbind('hover:enter').on('hover:enter', function () {
                    Lampa.Storage.set('online_mod_last_balanser', {});
                    $('.settings-param__status', clear_last_balanser).removeClass('active error wait').addClass('active');
                });

                var premium_sort_options = [
                    { title: Lampa.Lang.translate('online_mod_premium_sort_default'), value: 'default' },
                    { title: Lampa.Lang.translate('online_mod_premium_sort_premium_first'), value: 'premium_first' },
                    { title: Lampa.Lang.translate('online_mod_premium_sort_premium_last'), value: 'premium_last' }
                ];
                var premium_sort_current = Lampa.Storage.get('online_mod_premium_sort', 'default');
                var premium_sort_field = e.body.find('[data-name="online_mod_premium_sort"]');
                var premium_sort_selected = premium_sort_options.filter(function (o) { return o.value === premium_sort_current; })[0] || premium_sort_options[0];
                $('.settings-param__value', premium_sort_field).text(premium_sort_selected.title);
                premium_sort_field.unbind('hover:enter').on('hover:enter', function () {
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('online_mod_premium_sort'),
                        items: premium_sort_options.map(function (o) {
                            return {
                                title: o.title,
                                value: o.value,
                                selected: o.value === Lampa.Storage.get('online_mod_premium_sort', 'default')
                            };
                        }),
                        onBack: function () {
                            Lampa.Controller.toggle('settings');
                        },
                        onSelect: function (a) {
                            Lampa.Storage.set('online_mod_premium_sort', a.value);
                            $('.settings-param__value', premium_sort_field).text(a.title);
                            Lampa.Controller.toggle('settings');
                        }
                    });
                });

                var rezka2_login = e.body.find('[data-name="online_mod_rezka2_login"]');
                rezka2_login.unbind('hover:enter').on('hover:enter', function () {
                    var rezka2_login_status = $('.settings-param__status', rezka2_login).removeClass('active error wait').addClass('wait');
                    rezka2Login(function () {
                        rezka2_login_status.removeClass('active error wait').addClass('active');
                    }, function () {
                        rezka2_login_status.removeClass('active error wait').addClass('error');
                    });
                });

                var rezka2_logout = e.body.find('[data-name="online_mod_rezka2_logout"]');
                rezka2_logout.unbind('hover:enter').on('hover:enter', function () {
                    var rezka2_logout_status = $('.settings-param__status', rezka2_logout).removeClass('active error wait').addClass('wait');
                    rezka2Logout(function () {
                        rezka2_logout_status.removeClass('active error wait').addClass('active');
                    }, function () {
                        rezka2_logout_status.removeClass('active error wait').addClass('error');
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
            }
        });
    }

    function rezka2Login(success, error) {
        var host = rezka2Mirror();
        var url = host + '/ajax/login/';
        var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
        postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
        postdata += '&login_not_save=0';
        network.clear();
        network.timeout(8000);
        network.silent(url, function (json) {
            if (json && (json.success || json.message == 'Уже авторизован на сайте. Необходимо обновить страницу!')) {
                Lampa.Storage.set('online_mod_rezka2_status', 'true');
                network.clear();
                network.timeout(8000);
                network.silent(host + '/', function (str) {
                    str = (str || '').replace(/\n/g, '');
                    var error_form = str.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);
                    if (error_form) {
                        Lampa.Noty.show(error_form[0]);
                        if (error) error();
                        return;
                    }
                    var verify_form = str.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);
                    if (verify_form) {
                        Lampa.Noty.show(Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka');
                        rezka2Logout(error, error);
                        return;
                    }
                    if (success) success();
                }, function (a, c) {
                    if (success) success();
                }, false, {
                    dataType: 'text',
                    withCredentials: true
                });
            } else {
                Lampa.Storage.set('online_mod_rezka2_status', 'false');
                if (json && json.message) Lampa.Noty.show(json.message);
                if (error) error();
            }
        }, function (a, c) {
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, postdata, {
            withCredentials: true
        });
    }

    function rezka2Logout(success, error) {
        var url = rezka2Mirror() + '/logout/';
        network.clear();
        network.timeout(8000);
        network.silent(url, function (str) {
            Lampa.Storage.set('online_mod_rezka2_status', 'false');
            if (success) success();
        }, function (a, c) {
            Lampa.Storage.set('online_mod_rezka2_status', 'false');
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, false, {
            dataType: 'text',
            withCredentials: true
        });
    }

    function rezka2FillCookie(success, error) {
        var host = rezka2Mirror();
        var url = host + '/ajax/login/';
        var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
        postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
        postdata += '&login_not_save=0';
        network.clear();
        network.timeout(8000);
        network.silent(url, function (json) {
            var cookie = '';
            var values = {};
            var sid = '';
            if (!json.success) {
                if (json.message) Lampa.Noty.show(json.message);
                if (error) error();
                return;
            }
            var cookieHeaders = json.headers && json.headers['set-cookie'] || null;
            if (cookieHeaders && cookieHeaders.forEach) {
                cookieHeaders.forEach(function (param) {
                    var parts = param.split(';')[0].split('=');
                    if (parts[0]) {
                        if (parts[1] === 'deleted') delete values[parts[0]];
                        else values[parts[0]] = parts[1] || '';
                    }
                });
                sid = values['PHPSESSID'];
                delete values['PHPSESSID'];
                var cookies = [];
                for (var name in values) {
                    cookies.push(name + '=' + values[name]);
                }
                cookie = cookies.join('; ');
            }
            if (cookie) {
                Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || randomId2(26)) + (cookie ? '; ' + cookie : '');
                network.clear();
                network.timeout(8000);
                network.silent(host + '/', function (str) {
                    var body = (str || '').replace(/\n/g, '');
                    var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);
                    if (error_form) {
                        Lampa.Noty.show(error_form[0]);
                        if (error) error();
                        return;
                    }
                    var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);
                    if (verify_form) {
                        Lampa.Storage.set('online_mod_rezka2_cookie', '');
                        Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka';
                        if (error) error();
                        return;
                    }
                    if (success) success();
                }, function (a, c) {
                    if (success) success();
                }, false, {
                    dataType: 'text',
                    withCredentials: true,
                    headers: { Cookie: cookie }
                });
            } else {
                if (error) error();
            }
        }, function (a, c) {
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, postdata, {
            withCredentials: true
        });
    }

    function startPlugin() {
        initStorage();
        initLang();
        resetTemplates();

        Lampa.Component.add('online_mod', component);

        var manifest = {
            type: 'video',
            name: Lampa.Lang.translate('online_mod_title_full'),
            description: Lampa.Lang.translate('online_mod_watch'),
            component: 'online_mod',
            onContextMenu: function (object) {
                return {
                    name: Lampa.Lang.translate('online_mod_watch'),
                    description: ''
                };
            },
            onContextLauch: function (object) {
                online_loading = false;
                loadOnline(object);
            }
        };
        Lampa.Manifest.plugins = manifest;

        var button = "<div class=\"full-start__button selector view--online_mod\" data-subtitle=\"\">\n        <svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:svgjs=\"http://svgjs.com/svgjs\" version=\"1.1\" width=\"512\" height=\"512\" x=\"0\" y=\"0\" viewBox=\"0 0 244 260\" style=\"enable-background:new 0 0 512 512\" xml:space=\"preserve\" class=\"\">\n        <g xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"currentColor\"/>\n        </g></svg>\n        <span>#{online_mod_title}</span>\n        </div>";

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $(Lampa.Lang.translate(button));
                online_loading = false;
                btn.on('hover:enter', function () {
                    loadOnline(e.data.movie);
                });
                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        initSettings();
    }

    startPlugin();
})();
