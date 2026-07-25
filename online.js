// Online Mod (без прокси, с автоматической индикацией премиум-озвучки 29)

(function () {
    'use strict';

    // --- Глобальный кеш премиума (сохраняется между переходами по меню) ---
    var global_premium_cache = {};

    // --- Утилиты ---
    function startsWith(str, searchString) {
        return str.lastIndexOf(searchString, 0) === 0;
    }

    function endsWith(str, searchString) {
        var start = str.length - searchString.length;
        if (start < 0) return false;
        return str.indexOf(searchString, start) === start;
    }

    function parseURL(link) {
        var url = {
            href: link, protocol: '', host: '', origin: '', pathname: '', search: '', hash: ''
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

    // --- Настройки ---
    function rezka2Mirror() {
        var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
        if (!url) return 'https://kvk.zone';
        if (url.indexOf('://') == -1) url = 'https://' + url;
        if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
        return url;
    }

    // --- Компонент Rezka2 ---
    function rezka2(component, _object) {
        var network = new Lampa.Reguest();
        var extract = {};
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

        function getFilmCacheKey(voice_id) {
            return (extract.film_id || object.movie.id) + '_' + voice_id;
        }

        function checkErrorForm(str) {
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
            if (!startsWith(data, '#')) return data;
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

        function checkAllPremium(voice_ids, callback) {
            var total = voice_ids.length;
            var checked = 0;
            var results = {};
            
            if (total === 0) {
                callback(results);
                return;
            }
            
            var fallbackTimer = setTimeout(function() {
                if (checked < total) {
                    checked = total;
                    callback(results);
                }
            }, 6000);

            voice_ids.forEach(function(voice_id) {
                var cache_key = getFilmCacheKey(voice_id);
                if (global_premium_cache[cache_key] !== undefined) {
                    results[voice_id] = global_premium_cache[cache_key];
                    checked++;
                    if (checked === total) {
                        clearTimeout(fallbackTimer);
                        callback(results);
                    }
                    return;
                }
                
                var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
                var postdata = 'id=' + encodeURIComponent(extract.film_id);
                postdata += '&translator_id=' + encodeURIComponent(voice_id);
                postdata += '&favs=' + encodeURIComponent(extract.favs);
                
                if (extract.is_series) {
                    var current_season_id = choice.season_id || (extract.season && extract.season[choice.season] ? extract.season[choice.season].id : (extract.season && extract.season.length > 0 ? extract.season[0].id : 1));
                    postdata += '&season=' + encodeURIComponent(current_season_id);
                    postdata += '&episode=1';
                    postdata += '&action=get_stream';
                } else {
                    postdata += '&action=get_movie';
                }
                
                var req = new Lampa.Reguest();
                req.timeout(4500);
                
                var done = function(isPremium) {
                    global_premium_cache[cache_key] = isPremium;
                    results[voice_id] = isPremium;
                    checked++;
                    if (checked === total) {
                        clearTimeout(fallbackTimer);
                        callback(results);
                    }
                };

                req.silent(url, function (json) {
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
                    done(isPremium);
                }, function () {
                    done(false);
                }, postdata, {
                    withCredentials: true,
                    headers: headers
                });
            });
        }

        this.search = function (_object, kinopoisk_id, data) {
            var _this = this;
            object = _object;
            select_title = object.search || object.movie.title;
            if (this.wait_similars && data && data[0].is_similars) return getPage(data[0].link);
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
                var url = more_url + '&q=' + encodeURIComponent(query) + '&page=' + encodeURIComponent(page);
                network.clear();
                network.timeout(10000);
                network.silent(url, function (str) {
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
                    if (callback) callback(data, have_more);
                }, function (a, c) {
                    component.empty(network.errorDecode(a, c));
                }, false, {
                    dataType: 'text',
                    withCredentials: true,
                    headers: headers
                });
            };

            var search_more = function (params) {
                var items = params.items || [];
                var query = params.query || '';
                var page = params.page || 1;
                query_more(query, page, items, function (items, have_more) {
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
                var postdata = 'q=' + encodeURIComponent(query);
                network.clear();
                network.timeout(10000);
                network.silent(url, function (str) {
                    str = (str || '').replace(/\n/g, '');
                    checkErrorForm(str);
                    var links = str.match(/<li><a href=.*?<\/li>/g);
                    var have_more = str.indexOf('<a class="b-search__live_all"') !== -1;
                    if (links && links.length) data = data.concat(links);
                    if (callback) callback(data, have_more, query);
                }, function (a, c) {
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
                query_search(component.cleanTitle(select_title), [], function (data, have_more, query) {
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
            component.reset();
            choice = {
                season: 0,
                voice: 0,
                voice_name: '',
                season_id: ''
            };
            component.loading(true);
            getEpisodes(success);
            component.saveChoice(choice);
        };

        this.filter = function (type, a, b) {
            choice[a.stype] = b.index;
            if (a.stype == 'voice') {
                var raw_name = filter_items.voice[b.index] || '';
                choice.voice_name = raw_name.replace(/^⭐\s*/, '');
            }
            if (a.stype == 'season') choice.season_id = filter_items.season_id[b.index];
            
            component.reset();
            component.loading(true);

            getEpisodes(checkPremiumAndRender);

            component.saveChoice(choice);
            setTimeout(component.closeFilter, 10);
        };

        this.destroy = function () {
            network.clear();
            extract = null;
        };

        function getPage(url) {
            url = fixLink(url, ref);
            network.clear();
            network.timeout(10000);
            network.silent(url, function (str) {
                extractData(str);
                if (extract.film_id) {
                    getEpisodes(success);
                } else if (error_message) component.empty(error_message);
                else component.emptyForQuery(select_title);
            }, function (a, c) {
                component.empty(network.errorDecode(a, c));
            }, false, {
                dataType: 'text',
                withCredentials: true,
                headers: headers
            });
        }

        function checkPremiumAndRender() {
            var voices_source = extract.is_series && voice_list_current.length ? voice_list_current : extract.voice;
            
            // Фильтр сортировки премиума
            var sort_type = Lampa.Storage.get('online_mod_premium_sort', 'default');
            if (sort_type === 'free_first') {
                voices_source.sort(function(a, b) {
                    var premA = global_premium_cache[getFilmCacheKey(a.id)] ? 1 : 0;
                    var premB = global_premium_cache[getFilmCacheKey(b.id)] ? 1 : 0;
                    return premA - premB;
                });
            }

            var voice_ids = voices_source.map(function (v) { return v.id; });

            if (voice_ids.length > 0) {
                component.loading(true);
                checkAllPremium(voice_ids, function (results) {
                    component.loading(false);
                    
                    if (sort_type === 'free_first') {
                        voices_source.sort(function(a, b) {
                            var premA = results[a.id] ? 1 : 0;
                            var premB = results[b.id] ? 1 : 0;
                            return premA - premB;
                        });
                    }

                    filter(results);
                    var items = filtred(results);
                    append(items);
                });
            } else {
                component.loading(false);
                filter({});
                var items = filtred({});
                append(items);
            }
        }

        function success() {
            component.loading(false);
            checkPremiumAndRender();
        }

        function extractData(str) {
            extract.voice = [];
            extract.season = [];
            extract.episode = [];
            extract.voice_data = {};
            extract.is_series = false;
            extract.film_id = '';
            extract.favs = '';
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
                extract.is_series = true;
                extract.film_id = cdnSeries[1];
                defVoice = { name: devVoiceName, id: cdnSeries[2] };
                defSeason = { name: 'Сезон ' + cdnSeries[3], id: cdnSeries[3] };
                defEpisode = { name: 'Серия ' + cdnSeries[4], season_id: cdnSeries[3], episode_id: cdnSeries[4] };
            } else if (cdnMovie) {
                extract.film_id = cdnMovie[1];
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
                    extract.voice.push({
                        name: title,
                        id: $(this).attr('data-translator_id'),
                        is_camrip: $(this).attr('data-camrip'),
                        is_ads: $(this).attr('data-ads'),
                        is_director: $(this).attr('data-director')
                    });
                });
            }
            if (!extract.voice.length && defVoice) {
                extract.voice.push(defVoice);
            }
            if (extract.is_series) {
                var seasons = str.match(/(<ul id="simple-seasons-tabs".*?<\/ul>)/);
                if (seasons) {
                    var _select = $(seasons[1]);
                    $('.b-simple_season__item', _select).each(function () {
                        extract.season.push({
                            name: $(this).text(),
                            id: $(this).attr('data-tab_id')
                        });
                    });
                }
                if (!extract.season.length && defSeason) {
                    extract.season.push(defSeason);
                }
                var episodes = str.match(/(<div id="simple-episodes-tabs".*?<\/div>)/);
                if (episodes) {
                    var _select2 = $(episodes[1]);
                    $('.b-simple_episode__item', _select2).each(function () {
                        extract.episode.push({
                            name: $(this).text(),
                            season_id: $(this).attr('data-season_id'),
                            episode_id: $(this).attr('data-episode_id')
                        });
                    });
                }
                if (!extract.episode.length && defEpisode) {
                    extract.episode.push(defEpisode);
                }
            }
            var favs = str.match(/<input type="hidden" id="ctrl_favs" value="([^"]*)"/);
            if (favs) extract.favs = favs[1];
            var blocked = str.match(/class="b-player__restricted__block_message"/);
            if (blocked) extract.blocked = true;
        }

        function fetchVoiceData(translator_id, callback) {
            if (extract.voice_data[translator_id]) {
                callback(extract.voice_data[translator_id]);
                return;
            }
            var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
            var postdata = 'id=' + encodeURIComponent(extract.film_id);
            postdata += '&translator_id=' + encodeURIComponent(translator_id);
            postdata += '&favs=' + encodeURIComponent(extract.favs);
            postdata += '&action=get_episodes';

            var req = new Lampa.Reguest();
            req.timeout(10000);
            req.silent(url, function (json) {
                callback(parseVoiceEpisodes(json, translator_id));
            }, function () {
                var empty = { season: [], episode: [] };
                extract.voice_data[translator_id] = empty;
                callback(empty);
            }, postdata, {
                withCredentials: true,
                headers: headers
            });
        }

        function parseVoiceEpisodes(json, translator_id) {
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
            extract.voice_data[translator_id] = data;
            return data;
        }

        function ensureAllVoiceData(callback) {
            var voices = extract.voice || [];
            var total = voices.length;
            var done = 0;
            if (!total) {
                callback();
                return;
            }
            voices.forEach(function (v) {
                fetchVoiceData(v.id, function () {
                    done++;
                    if (done === total) callback();
                });
            });
        }

        function currentSeasonId() {
            if (choice.season_id) return choice.season_id;
            if (extract.season && extract.season[choice.season]) return extract.season[choice.season].id;
            if (extract.season && extract.season.length) return extract.season[0].id;
            return null;
        }

        function availableVoicesForSeason(season_id) {
            if (!season_id) return extract.voice;
            var list = extract.voice.filter(function (v) {
                var data = extract.voice_data[v.id];
                return data && data.season && data.season.some(function (s) { return s.id == season_id; });
            });
            return list.length ? list : extract.voice;
        }

        function getEpisodes(call) {
            if (!extract.is_series) {
                call();
                return;
            }

            ensureAllVoiceData(function () {
                voice_list_current = availableVoicesForSeason(currentSeasonId());
                filterVoice();

                var selected = voice_list_current[choice.voice];
                var data = selected && extract.voice_data[selected.id];
                extract.episode = (data && data.episode) || [];

                call();
            });
        }

        function filterVoice() {
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
            if (element.stream) return call(element);
            var url = embed + 'ajax/get_cdn_series/?t=' + Date.now();
            var postdata = 'id=' + encodeURIComponent(extract.film_id);
            if (extract.is_series) {
                postdata += '&translator_id=' + encodeURIComponent(element.media.translator_id);
                postdata += '&season=' + encodeURIComponent(element.media.season_id);
                postdata += '&episode=' + encodeURIComponent(element.media.episode_id);
                postdata += '&favs=' + encodeURIComponent(extract.favs);
                postdata += '&action=get_stream';
            } else {
                postdata += '&translator_id=' + encodeURIComponent(element.media.id);
                postdata += '&is_camrip=' + encodeURIComponent(element.media.is_camrip);
                postdata += '&is_ads=' + encodeURIComponent(element.media.is_ads);
                postdata += '&is_director=' + encodeURIComponent(element.media.is_director);
                postdata += '&favs=' + encodeURIComponent(extract.favs);
                postdata += '&action=get_movie';
            }
            network.clear();
            network.timeout(10000);
            network.silent(url, function (json) {
                if (json && json.url) {
                    var video = decode(json.url),
                        file = '',
                        quality = false;
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
                            error('Перевод доступен только с HDrezka Premium');
                            return;
                        }
                    }
                    if (file) {
                        element.stream = file;
                        element.qualitys = quality;
                        element.subtitles = parseSubtitles(json.subtitle);
                        call(element);
                    } else error();
                } else error();
            }, function (a, c) {
                error();
            }, postdata, {
                withCredentials: true,
                headers: headers
            });
        }

        function filtred(premium_results) {
            premium_results = premium_results || {};
            var filtred = [];
            if (extract.is_series) {
                var season_name = filter_items.season[choice.season];
                var season_id;
                extract.season.forEach(function (season) {
                    if (season.name == season_name) season_id = season.id;
                });
                var voice = filter_items.voice[choice.voice];
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
                extract.voice.forEach(function (voice) {
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
                
                var display_title = element.title;
                if (element.is_premium && !startsWith(display_title, '⭐')) {
                    display_title = '⭐ ' + element.title;
                }
                
                var item = Lampa.Template.get('online_mod', {
                    title: display_title,
                    quality: element.quality,
                    info: element.info
                });
                
                var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
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
                                                call();
                                            }, function () {
                                                cell.url = '';
                                                call();
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
                    }, function (error) {
                        element.loading = false;
                        Lampa.Noty.show(error || Lampa.Lang.translate(extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
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
                            call({
                                file: element.stream,
                                quality: element.qualitys
                            });
                        }, function (error) {
                            Lampa.Noty.show(error || Lampa.Lang.translate(extract.blocked ? 'online_mod_blockedlink' : 'online_mod_nolink'));
                        });
                    }
                });
            });
            component.start(true);
        }
    }

    // --- Компонент Online Mod ---
    function component(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var filter = new Lampa.Filter(object);
        var balanser = 'rezka2';
        var last_bls = Lampa.Storage.field('online_mod_save_last_balanser') === true ? Lampa.Storage.cache('online_mod_last_balanser', 200, {}) : {};
        var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
        var forcedQuality = '';
        var qualityFilter = {
            title: Lampa.Lang.translate('settings_player_quality'),
            subtitle: '',
            items: [],
            stype: 'quality'
        };
        var contextmenu_all = [];

        if (last_bls[object.movie.id]) {
            balanser = last_bls[object.movie.id];
        }

        this.proxy = function (name) {
            return '';
        };

        this.fixLink = function (link, referrer) {
            return fixLink(link, referrer);
        };

        this.fixLinkProtocol = function (link, prefer_http, replace_protocol) {
            return fixLinkProtocol(link, prefer_http, replace_protocol);
        };

        this.proxyLink = function (link, proxy, proxy_enc, enc) {
            return link;
        };

        this.proxyStream = function (url, name) {
            return url;
        };

        this.processSubs = function (url) {
            return url;
        };

        this.proxyStreamSubs = function (url, name) {
            return this.processSubs(url);
        };

        this.checkMyIp = function (onComplite) {
            onComplite();
        };

        var last;
        var extended;
        var selected_id;
        var filter_translate = {
            season: Lampa.Lang.translate('torrent_serial_season'),
            voice: Lampa.Lang.translate('torrent_parser_voice'),
            source: Lampa.Lang.translate('settings_rest_source')
        };

        var source = new rezka2(this, object);

        scroll.body().addClass('torrent-list');
        scroll.minus(files.render().find('.explorer__files-head'));

        this.create = function () {
            var _this = this;
            this.activity.loader(true);

            filter.onSearch = function (value) {
                Lampa.Activity.replace({
                    search: value,
                    search_date: '',
                    clarification: true
                });
            };

            filter.onBack = function () {
                _this.start();
            };

            filter.onSelect = function (type, a, b) {
                if (type == 'filter') {
                    if (a.reset) {
                        if (extended) source.reset();
                        else _this.start();
                    } else if (a.stype == 'quality') {
                        forcedQuality = b.title;
                        _this.updateQualityFilter();
                    } else {
                        source.filter(type, a, b);
                    }
                }
            };

            filter.render().find('.filter--sort span').text(Lampa.Lang.translate('online_mod_balanser'));
            files.appendHead(filter.render());
            files.appendFiles(scroll.render());
            this.search();
            return this.render();
        };

        this.updateQualityFilter = function () {
            var preferably = forcedQuality;
            if (!preferably) {
                preferably = Lampa.Storage.get('video_quality_default', '1080') + 'p';
                if (preferably === '1080p') preferably = '1080p Ultra';
            }
            var items = ['2160p', '1440p', '1080p Ultra', '1080p', '720p', '480p'].map(function (quality, i) {
                return {
                    title: quality,
                    selected: quality === preferably,
                    index: i
                };
            });
            qualityFilter.subtitle = preferably;
            qualityFilter.items = items;
            setTimeout(this.closeFilter, 10);
        };

        this.search = function () {
            this.activity.loader(true);
            this.filter({ source: ['HDrezka'] }, { source: 0 });
            this.reset();
            this.find();
        };

        this.cleanTitle = function (str) {
            return str.replace(/[\s.,:;’'`!?]+/g, ' ').trim();
        };

        this.kpCleanTitle = function (str) {
            return this.cleanTitle(str).replace(/^[ \/\\]+/, '').replace(/[ \/\\]+$/, '').replace(/\+( *[+\/\\])+/g, '+').replace(/([+\/\\] *)+\+/g, '+').replace(/( *[\/\\]+ *)+/g, '+');
        };

        this.normalizeTitle = function (str) {
            return this.cleanTitle(str.toLowerCase().replace(/[\-\u2010-\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]+/g, '-').replace(/ё/g, 'е'));
        };

        this.equalTitle = function (t1, t2) {
            return typeof t1 === 'string' && typeof t2 === 'string' && this.normalizeTitle(t1) === this.normalizeTitle(t2);
        };

        this.containsTitle = function (str, title) {
            return typeof str === 'string' && typeof title === 'string' && this.normalizeTitle(str).indexOf(this.normalizeTitle(title)) !== -1;
        };

        this.equalAnyTitle = function (strings, titles) {
            var _this2 = this;
            return titles.some(function (title) {
                return title && strings.some(function (str) {
                    return str && _this2.equalTitle(str, title);
                });
            });
        };

        this.containsAnyTitle = function (strings, titles) {
            var _this3 = this;
            return titles.some(function (title) {
                return title && strings.some(function (str) {
                    return str && _this3.containsTitle(str, title);
                });
            });
        };

        this.uniqueNamesShortText = function (names, limit) {
            var unique = [];
            names.forEach(function (name) {
                if (name && unique.indexOf(name) == -1) unique.push(name);
            });
            if (limit && unique.length > 1) {
                var length = 0;
                var limit_index = -1;
                var last_index = unique.length - 1;
                unique.forEach(function (name, index) {
                    length += name.length;
                    if (limit_index == -1 && length > limit - (index == last_index ? 0 : 5)) limit_index = index;
                    length += 2;
                });
                if (limit_index != -1) {
                    unique = unique.splice(0, Math.max(limit_index, 1));
                    unique.push('...');
                }
            }
            return unique.join(', ');
        };

        this.decodeHtml = function (html) {
            var text = document.createElement("textarea");
            text.innerHTML = html;
            return text.value;
        };

        this.find = function () {
            var _this4 = this;
            var query = object.search || object.movie.title;
            if (!query) {
                this.emptyForQuery(query);
                return;
            }
            this.extendChoice();
            source.search(object, null);
        };

        this.parsePlaylist = function (str) {
            var pl = [];
            try {
                if (startsWith(str, '[')) {
                    str.substring(1).split(/, *\[/).forEach(function (item) {
                        item = item.trim();
                        if (endsWith(item, ',')) item = item.substring(0, item.length - 1).trim();
                        var label_end = item.indexOf(']');
                        if (label_end >= 0) {
                            var label = item.substring(0, label_end).trim();
                            if (item.charAt(label_end + 1) === '{') {
                                item.substring(label_end + 2).split(/; *\{/).forEach(function (voice_item) {
                                    voice_item = voice_item.trim();
                                    if (endsWith(voice_item, ';')) voice_item = voice_item.substring(0, voice_item.length - 1).trim();
                                    var voice_end = voice_item.indexOf('}');
                                    if (voice_end >= 0) {
                                        var voice = voice_item.substring(0, voice_end).trim();
                                        pl.push({
                                            label: label,
                                            voice: voice,
                                            links: voice_item.substring(voice_end + 1).split(' or ').map(function (link) {
                                                return link.trim();
                                            }).filter(function (link) { return link; })
                                        });
                                    }
                                });
                            } else {
                                pl.push({
                                    label: label,
                                    links: item.substring(label_end + 1).split(' or ').map(function (link) {
                                        return link.trim();
                                    }).filter(function (link) { return link; })
                                });
                            }
                        }
                    });
                    pl = pl.filter(function (item) { return item.links.length; });
                }
            } catch (e) {}
            return pl;
        };

        this.formatEpisodeTitle = function (s_num, e_num, name) {
            var title = '';
            var full = Lampa.Storage.field('online_mod_full_episode_title') === true;
            if (s_num != null && s_num !== '') {
                title = (full ? Lampa.Lang.translate('torrent_serial_season') + ' ' : 'S') + s_num + ' / ';
            }
            if (name == null || name === '') name = Lampa.Lang.translate('torrent_serial_episode') + ' ' + e_num;
            else if (e_num != null && e_num !== '') name = Lampa.Lang.translate('torrent_serial_episode') + ' ' + e_num + ' - ' + name;
            title += name;
            return title;
        };

        this.extendChoice = function () {
            var data = Lampa.Storage.cache('online_mod_choice_rezka2', 500, {});
            var save = data[selected_id || object.movie.id] || {};
            extended = true;
            source.extendChoice(save);
        };

        this.saveChoice = function (choice) {
            var data = Lampa.Storage.cache('online_mod_choice_rezka2', 500, {});
            data[selected_id || object.movie.id] = choice;
            Lampa.Storage.set('online_mod_choice_rezka2', data);
        };

        this.similars = function (json, search_more, more_params) {
            var _this5 = this;
            json.forEach(function (elem) {
                var title = elem.title || elem.ru_title || elem.nameRu || elem.en_title || elem.nameEn || elem.orig_title || elem.nameOriginal;
                var orig_title = elem.orig_title || elem.nameOriginal || elem.en_title || elem.nameEn;
                var year = elem.start_date || elem.year || '';
                var info = [];
                if (orig_title && orig_title != elem.title) info.push(orig_title);
                if (elem.seasons_count) info.push(Lampa.Lang.translate('online_mod_seasons_count') + ': ' + elem.seasons_count);
                if (elem.episodes_count) info.push(Lampa.Lang.translate('online_mod_episodes_count') + ': ' + elem.episodes_count);
                elem.title = title;
                elem.quality = year ? (year + '').slice(0, 4) : '----';
                elem.info = info.length ? ' / ' + info.join(' / ') : '';
                var item = Lampa.Template.get('online_mod_folder', elem);
                item.on('hover:enter', function () {
                    _this5.activity.loader(true);
                    _this5.reset();
                    object.search = elem.title;
                    object.search_date = year;
                    selected_id = elem.id;
                    _this5.extendChoice();
                    source.search(object, null, [elem]);
                });
                _this5.append(item);
            });
            if (search_more) {
                var elem = {
                    title: Lampa.Lang.translate('online_mod_show_more'),
                    quality: '...',
                    info: ''
                };
                var item = Lampa.Template.get('online_mod_folder', elem);
                item.on('hover:enter', function () {
                    _this5.activity.loader(true);
                    _this5.reset();
                    search_more(more_params);
                });
                this.append(item);
            }
        };

        this.reset = function () {
            contextmenu_all = [];
            last = filter.render().find('.selector').eq(0)[0];
            scroll.render().find('.empty').remove();
            scroll.clear();
            scroll.reset();
        };

        this.inActivity = function () {
            var body = $('body');
            return !(body.hasClass('settings--open') || body.hasClass('menu--open') || body.hasClass('keyboard-input--visible') || body.hasClass('selectbox--open') || body.hasClass('search--open') || body.hasClass('ambience--enable') || $('div.modal').length);
        };

        this.loading = function (status) {
            if (status) this.activity.loader(true);
            else {
                this.activity.loader(false);
                if (Lampa.Activity.active().activity === this.activity && this.inActivity()) this.activity.toggle();
            }
        };

        this.getDefaultQuality = function (qualityMap, defValue) {
            if (qualityMap) {
                var preferably = forcedQuality;
                if (!preferably) {
                    preferably = Lampa.Storage.get('video_quality_default', '1080') + 'p';
                    if (preferably === '1080p') preferably = '1080p Ultra';
                }
                var items = ['2160p', '2160', '4K', '1440p', '1440', '2K', '1080p Ultra', '1080p', '1080', '720p', '720', '480p', '480', '360p', '360', '240p', '240'];
                var idx = items.indexOf(preferably);
                if (idx !== -1) {
                    for (var i = idx; i < items.length; i++) {
                        var item = items[i];
                        if (qualityMap[item]) return qualityMap[item];
                    }
                    for (var _i = idx - 1; _i >= 0; _i--) {
                        var _item = items[_i];
                        if (qualityMap[_item]) return qualityMap[_item];
                    }
                }
            }
            return defValue;
        };

        this.renameQualityMap = function (qualityMap) {
            if (!qualityMap) return qualityMap;
            var renamed = {};
            for (var label in qualityMap) {
                renamed["\u200B" + label] = qualityMap[label];
            }
            return renamed;
        };

        this.filter = function (filter_items, choice) {
            var select = [];
            var add = function (type, title) {
                var need = Lampa.Storage.get('online_mod_filter', '{}');
                var items = filter_items[type];
                var subitems = [];
                var value = need[type];
                items.forEach(function (name, i) {
                    subitems.push({
                        title: name,
                        selected: value == i,
                        index: i
                    });
                });
                select.push({
                    title: title,
                    subtitle: items[value],
                    items: subitems,
                    stype: type
                });
            };
            choice.source = 0;
            Lampa.Storage.set('online_mod_filter', choice);
            select.push({
                title: Lampa.Lang.translate('torrent_parser_reset'),
                reset: true
            });
            filter_items.source = ['HDrezka'];
            add('source', Lampa.Lang.translate('online_mod_balanser'));
            if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
            if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));
            if (filter_items.server && filter_items.server.length) add('server', Lampa.Lang.translate('online_mod_server'));
            this.updateQualityFilter();
            select.push(qualityFilter);
            filter.set('filter', select);
            filter.set('sort', [{ source: 'rezka2', title: 'HDrezka', selected: true }]);
            this.selected(filter_items);
        };

        this.closeFilter = function () {
            if ($('body').hasClass('selectbox--open')) Lampa.Select.close();
        };

        this.selected = function (filter_items) {
            var need = Lampa.Storage.get('online_mod_filter', '{}'),
                select = [];
            for (var i in need) {
                if (i !== 'source' && filter_translate[i] && filter_items[i] && filter_items[i].length > 1) {
                    select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
                }
            }
            filter.chosen('filter', select);
            filter.chosen('sort', ['HDrezka']);
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
                                onBack: function () {
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
                Lampa.Select.show({
                    title: Lampa.Lang.translate('title_action'),
                    items: menu,
                    onBack: function () {
                        Lampa.Controller.toggle(enabled);
                    },
                    onSelect: function (a) {
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
                            params.item.trigger('hover:enter', { runas: a.player });
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
            if (Lampa.Activity.active().activity !== this.activity) return;
            if (first_select) {
                var last_views = scroll.render().find('.selector.online').find('.torrent-item__viewed').parent().last();
                if (object.movie.number_of_seasons && last_views.length) last = last_views.eq(0)[0];
                else last = scroll.render().find('.selector').eq(0)[0];
            }
            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: function () {
                    if (Navigator.canmove('up')) {
                        Navigator.move('up');
                    } else Lampa.Controller.toggle('head');
                },
                down: function () {
                    Navigator.move('down');
                },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                    else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
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
            source.destroy();
        };
    }

    // --- Настройки и инициализация ---
    function initStorage() {
        Lampa.Storage.set('online_mod_proxy_rezka2', 'false');

        Lampa.Params.trigger('online_mod_prefer_http', window.location.protocol !== 'https:');
        Lampa.Params.trigger('online_mod_full_episode_title', false);
        Lampa.Params.trigger('online_mod_save_last_balanser', false);
        
        // Новая опция сортировки перевода по умолчанию
        Lampa.Params.select('online_mod_premium_sort', {
            'default': 'По умолчанию',
            'free_first': 'Сначала бесплатные, потом Премиум'
        }, 'default');

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
                add: function (data) { lang_data = data; },
                translate: function (key) { return lang_data[key] ? lang_data[key].ru : key; }
            };
        }

        Lampa.Lang.add({
            online_mod_watch: { ru: 'Смотреть онлайн' },
            online_mod_nolink: { ru: 'Не удалось извлечь ссылку' },
            online_mod_blockedlink: { ru: 'К сожалению, это видео не доступно в вашем регионе' },
            online_mod_balanser: { ru: 'Балансер' },
            online_mod_file_helper: { ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню' },
            online_mod_clearmark_all: { ru: 'Снять отметку у всех' },
            online_mod_timeclear_all: { ru: 'Сбросить тайм-код у всех' },
            online_mod_query_start: { ru: 'По запросу' },
            online_mod_query_end: { ru: 'нет результатов' },
            online_mod_title: { ru: 'Онлайн HDrezka' },
            online_mod_title_full: { ru: 'Онлайн Мод' },
            online_mod_prefer_http: { ru: 'Предпочитать поток по HTTP' },
            online_mod_full_episode_title: { ru: 'Полный формат названия серии' },
            online_mod_save_last_balanser: { ru: 'Сохранять историю балансеров' },
            online_mod_clear_last_balanser: { ru: 'Очистить историю балансеров' },
            online_mod_premium_sort: { ru: 'Сортировка премиум перевода' },
            online_mod_rezka2_mirror: { ru: 'Url HDrezka' },
            online_mod_rezka2_name: { ru: 'Логин или email для HDrezka' },
            online_mod_rezka2_password: { ru: 'Пароль для HDrezka' },
            online_mod_rezka2_login: { ru: 'Войти в HDrezka' },
            online_mod_rezka2_logout: { ru: 'Выйти из HDrezka' },
            online_mod_rezka2_cookie: { ru: 'Куки для HDrezka' },
            online_mod_rezka2_fill_cookie: { ru: 'Заполнить куки для HDrezka' },
            online_mod_authorization_required: { ru: 'Требуется авторизация' },
            online_mod_unsupported_mirror: { ru: 'Неподдерживаемое зеркало' },
            online_mod_secret_password: { ru: 'Секретный пароль' },
            online_mod_seasons_count: { ru: 'Сезонов' },
            online_mod_episodes_count: { ru: 'Эпизодов' },
            online_mod_show_more: { ru: 'Показать ещё' },
            online_mod_server: { ru: 'Сервер' },
            online_mod_premium: { ru: 'Premium' }
        });
    }

    function resetTemplates() {
        Lampa.Template.add('online_mod', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 128\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"64\" cy=\"64\" r=\"56\" stroke=\"white\" stroke-width=\"16\"/>\n                    <path d=\"M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z\" fill=\"white\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
        Lampa.Template.add('online_mod_folder', "<div class=\"online selector\">\n        <div class=\"online__body\">\n            <div style=\"position: absolute;left: 0;top: -0.3em;width: 2.4em;height: 2.4em\">\n                <svg style=\"height: 2.4em; width:  2.4em;\" viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"/>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"/>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"/>\n                </svg>\n            </div>\n            <div class=\"online__title\" style=\"padding-left: 2.1em;\">{title}</div>\n            <div class=\"online__quality\" style=\"padding-left: 3.4em;\">{quality}{info}</div>\n        </div>\n    </div>");
    }

    function loadOnline(object) {
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
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_premium_sort\" data-type=\"select\">\n            <div class=\"settings-param__name\">#{online_mod_premium_sort}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_save_last_balanser\" data-type=\"toggle\">\n            <div class=\"settings-param__name\">#{online_mod_save_last_balanser}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_clear_last_balanser\" data-static=\"true\">\n            <div class=\"settings-param__name\">#{online_mod_clear_last_balanser}</div>\n            <div class=\"settings-param__status\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_mirror\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_mirror}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_name\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_name}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_password\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_password}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";

        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_cookie\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_rezka2_cookie}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n        <div class=\"settings-param selector\" data-name=\"online_mod_secret_password\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n            <div class=\"settings-param__name\">#{online_mod_secret_password}</div>\n            <div class=\"settings-param__value\"></div>\n        </div>";
        template += "\n    </div>";

        Lampa.Template.add('settings_online_mod', template);

        if (window.appready) addSettingsOnlineMod();
        else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') addSettingsOnlineMod();
            });
        }
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
            onContextMenu: function () {
                return { name: Lampa.Lang.translate('online_mod_watch'), description: '' };
            },
            onContextLauch: function (object) {
                loadOnline(object);
            }
        };
        Lampa.Manifest.plugins = manifest;

        var button = "<div class=\"full-start__button selector view--online_mod\" data-subtitle=\"\">\n        <svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" width=\"512\" height=\"512\" viewBox=\"0 0 244 260\"><path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"currentColor\"/></svg>\n        <span>#{online_mod_title}</span>\n        </div>";

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $(Lampa.Lang.translate(button));
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
