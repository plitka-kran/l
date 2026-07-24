// Online Mod - UASerials

(function () {
    'use strict';

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

    function baseUserAgent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
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

    // --- Компонент UASerials ---
    function uaserials(component, _object) {
        var network = new Lampa.Reguest();
        var extract = {};
        var object = _object;
        var select_title = '';
        var prefer_http = Lampa.Storage.field('online_mod_prefer_http') === true;
        var host = 'https://uaserials.com';
        var ref = host + '/';
        var user_agent = baseUserAgent();
        var headers = Lampa.Platform.is('android') ? {
            'Origin': host,
            'Referer': ref,
            'User-Agent': user_agent
        } : {};
        var embed = ref;
        var filter_items = {};
        var choice = {
            season: 0,
            voice: 0,
            voice_name: ''
        };
        var error_message = '';

        function checkErrorForm(str) {
            var error_form = str.match(/<div class="alert alert-danger">([^<]*)<\/div>/);
            if (error_form) {
                error_message = error_form[1].trim();
                return;
            }
            if (startsWith(str, 'Fatal error:')) {
                error_message = str;
                return;
            }
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

            var url = embed + 'search/';
            var postdata = 'do=search&subaction=search&search_start=0&full_search=1&result_from=1&story=' + encodeURIComponent(select_title) + '&titleonly=3&searchuser=&replyless=0&replylimit=0&searchdate=0&beforeafter=after&sortby=title&resorder=asc&showposts=0&catlist%5B%5D=0';

            var display = function (str) {
                str = (str || '').replace(/\n/g, '');
                var links = str.match(/<div class="shortstory"[^>]*>[\s\S]*?<h2>[\s\S]*?<a href="([^"]+)"[^>]*>([^<]*)<\/a>[\s\S]*?<div class="info">[\s\S]*?<span class="date">([^<]*)<\/span>/g);
                if (links && links.length) {
                    var is_sure = false;
                    var items = links.map(function (l) {
                        var link_match = l.match(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/);
                        var year_match = l.match(/<span class="date">([^<]*)<\/span>/);
                        var year = year_match ? parseInt(year_match[1].match(/\d{4}/)) : null;
                        return {
                            year: year,
                            title: link_match ? link_match[2].trim() : '',
                            link: link_match ? link_match[1] : ''
                        };
                    });
                    var cards = items;
                    if (cards.length) {
                        if (orig_titles.length) {
                            var tmp = cards.filter(function (c) {
                                return component.containsAnyTitle([c.title], orig_titles);
                            });
                            if (tmp.length) {
                                cards = tmp;
                                is_sure = true;
                            }
                        }
                        if (select_title) {
                            var _tmp = cards.filter(function (c) {
                                return component.containsAnyTitle([c.title], [select_title]);
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
                        getPage(cards[0].link);
                    } else if (items.length) {
                        _this.wait_similars = true;
                        items.forEach(function (c) {
                            c.is_similars = true;
                        });
                        component.similars(items);
                        component.loading(false);
                    } else component.emptyForQuery(select_title);
                } else if (error_message) component.empty(error_message);
                else component.emptyForQuery(select_title);
            };

            network.clear();
            network.timeout(15000);
            network.silent(url, function (str) {
                display(str);
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

        this.extendChoice = function (saved) {
            Lampa.Arrays.extend(choice, saved, true);
        };

        this.reset = function () {
            component.reset();
            choice = {
                season: 0,
                voice: 0,
                voice_name: ''
            };
            component.loading(true);
            getEpisodes(success);
            component.saveChoice(choice);
        };

        this.filter = function (type, a, b) {
            choice[a.stype] = b.index;
            if (a.stype == 'voice') choice.voice_name = filter_items.voice[b.index];
            component.reset();
            component.loading(true);
            getEpisodes(success);
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
            network.timeout(15000);
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

        function success() {
            component.loading(false);
            filter();
            append(filtred());
        }

        function extractData(str) {
            extract.voice = [];
            extract.season = [];
            extract.episode = [];
            extract.is_series = false;
            extract.film_id = '';
            str = (str || '').replace(/\n/g, '');
            checkErrorForm(str);

            // Определяем сериал или фильм
            var series_check = str.match(/<span class="label label-warning">Сериал<\/span>/);
            if (series_check) extract.is_series = true;

            // Получаем ID фильма
            var film_id = str.match(/data-post_id="(\d+)"/);
            if (film_id) extract.film_id = film_id[1];

            // Получаем переводы (озвучки)
            var voices = str.match(/<select[^>]*id="translator"[^>]*>([\s\S]*?)<\/select>/);
            if (voices) {
                var options = voices[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g);
                if (options) {
                    options.forEach(function (opt) {
                        var val = opt.match(/value="([^"]+)"/);
                        var name = opt.match(/>([^<]*)</);
                        if (val && name) {
                            extract.voice.push({
                                id: val[1],
                                name: name[1].trim()
                            });
                        }
                    });
                }
            }

            // Если нет переводов - добавляем дефолтный
            if (!extract.voice.length) {
                extract.voice.push({
                    id: '0',
                    name: 'Оригинал'
                });
            }

            if (extract.is_series) {
                // Получаем сезоны
                var seasons = str.match(/<select[^>]*id="season"[^>]*>([\s\S]*?)<\/select>/);
                if (seasons) {
                    var options = seasons[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g);
                    if (options) {
                        options.forEach(function (opt) {
                            var val = opt.match(/value="([^"]+)"/);
                            var name = opt.match(/>([^<]*)</);
                            if (val && name) {
                                extract.season.push({
                                    id: val[1],
                                    name: name[1].trim()
                                });
                            }
                        });
                    }
                }

                // Если нет сезонов - добавляем дефолтный
                if (!extract.season.length) {
                    extract.season.push({
                        id: '1',
                        name: 'Сезон 1'
                    });
                }

                // Получаем серии
                var episodes = str.match(/<select[^>]*id="episode"[^>]*>([\s\S]*?)<\/select>/);
                if (episodes) {
                    var options = episodes[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g);
                    if (options) {
                        options.forEach(function (opt) {
                            var val = opt.match(/value="([^"]+)"/);
                            var name = opt.match(/>([^<]*)</);
                            if (val && name) {
                                extract.episode.push({
                                    id: val[1],
                                    name: name[1].trim()
                                });
                            }
                        });
                    }
                }
            }
        }

        function getEpisodes(call) {
            if (extract.is_series) {
                filterVoice();
                call();
            } else {
                call();
            }
        }

        function filterVoice() {
            var voice = extract.voice.map(function (v) { return v.name; });
            if (!voice[choice.voice]) choice.voice = 0;
            if (choice.voice_name) {
                var inx = voice.indexOf(choice.voice_name);
                if (inx == -1) choice.voice = 0;
                else if (inx !== choice.voice) {
                    choice.voice = inx;
                }
            }
        }

        function filter() {
            filter_items = {
                season: extract.season.map(function (s) { return s.name; }),
                voice: extract.is_series ? extract.voice.map(function (v) { return v.name; }) : []
            };
            if (!filter_items.season[choice.season]) choice.season = 0;
            if (!filter_items.voice[choice.voice]) choice.voice = 0;
            if (choice.voice_name) {
                var inx = filter_items.voice.indexOf(choice.voice_name);
                if (inx == -1) choice.voice = 0;
                else if (inx !== choice.voice) {
                    choice.voice = inx;
                }
            }
            component.filter(filter_items, choice);
        }

        function getStream(element, call, error) {
            if (element.stream) return call(element);

            var url = embed + 'ajax/get_cdn_link/';
            var postdata = 'id=' + encodeURIComponent(extract.film_id);
            postdata += '&translator_id=' + encodeURIComponent(element.media.voice_id || extract.voice[choice.voice].id);

            if (extract.is_series) {
                var season_id = extract.season[choice.season] ? extract.season[choice.season].id : '1';
                var episode_id = element.media.episode_id || '1';
                postdata += '&season=' + encodeURIComponent(season_id);
                postdata += '&episode=' + encodeURIComponent(episode_id);
            }

            network.clear();
            network.timeout(15000);
            network.silent(url, function (json) {
                if (json && json.url) {
                    var file = fixLinkProtocol(json.url, prefer_http, true);
                    element.stream = file;
                    element.qualitys = false;
                    call(element);
                } else error();
            }, function (a, c) {
                error();
            }, postdata, {
                withCredentials: true,
                headers: headers
            });
        }

        function filtred() {
            var filtred = [];
            if (extract.is_series) {
                var voice = filter_items.voice[choice.voice];
                var season_name = filter_items.season[choice.season];
                var season_id = extract.season[choice.season] ? extract.season[choice.season].id : '1';
                extract.episode.forEach(function (episode) {
                    filtred.push({
                        title: component.formatEpisodeTitle(season_name, null, episode.name),
                        quality: '360p ~ 1080p',
                        info: ' / ' + voice,
                        season: season_id,
                        episode: parseInt(episode.id),
                        media: {
                            voice_id: extract.voice[choice.voice] ? extract.voice[choice.voice].id : '0',
                            episode_id: episode.id
                        }
                    });
                });
            } else {
                extract.voice.forEach(function (voice) {
                    filtred.push({
                        title: voice.name || select_title,
                        quality: '360p ~ 1080p',
                        info: '',
                        media: {
                            voice_id: voice.id
                        }
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
                var item = Lampa.Template.get('online_mod', element);
                var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title);
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) {
                    item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                }
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                item.on('hover:enter', function () {
                    if (element.loading) return;
                    if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
                    element.loading = true;
                    getStream(element, function (element) {
                        element.loading = false;
                        var first = {
                            url: component.getDefaultQuality(element.qualitys, element.stream),
                            quality: component.renameQualityMap(element.qualitys),
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
                    }, function () {
                        element.loading = false;
                        Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
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
                        }, function () {
                            Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
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
        var source = new uaserials(this, object);

        var last;
        var extended;
        var selected_id;
        var forcedQuality = '';
        var qualityFilter = {
            title: Lampa.Lang.translate('settings_player_quality'),
            subtitle: '',
            items: [],
            stype: 'quality'
        };
        var contextmenu_all = [];

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
            this.filter({ source: ['UASerials'] }, { source: 0 });
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
            var data = Lampa.Storage.cache('online_mod_choice_uaserials', 500, {});
            var save = data[selected_id || object.movie.id] || {};
            extended = true;
            source.extendChoice(save);
        };

        this.saveChoice = function (choice) {
            var data = Lampa.Storage.cache('online_mod_choice_uaserials', 500, {});
            data[selected_id || object.movie.id] = choice;
            Lampa.Storage.set('online_mod_choice_uaserials', data);
        };

        this.similars = function (json, search_more, more_params) {
            var _this5 = this;
            json.forEach(function (elem) {
                var title = elem.title || elem.ru_title || elem.nameRu || elem.en_title || elem.nameEn || elem.orig_title || elem.nameOriginal;
                var year = elem.start_date || elem.year || '';
                var info = [];
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
            filter_items.source = ['UASerials'];
            add('source', Lampa.Lang.translate('online_mod_balanser'));
            if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
            if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));
            this.updateQualityFilter();
            select.push(qualityFilter);
            filter.set('filter', select);
            filter.set('sort', [{ source: 'uaserials', title: 'UASerials', selected: true }]);
            this.selected(filter_items);
        };

        this.closeFilter = function () {
            if ($('body').hasClass('selectbox--open')) Lampa.Select.close();
        };

        this.selected = function (filter_items) {
            var need = Lampa.Storage.get('online_mod_filter', '{}'),
                select = [];
            for (var i in need) {
                if (i !== 'source') {
                    select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
                }
            }
            filter.chosen('filter', select);
            filter.chosen('sort', ['UASerials']);
        };

        var filter_translate = {
            season: Lampa.Lang.translate('torrent_serial_season'),
            voice: Lampa.Lang.translate('torrent_parser_voice'),
            source: Lampa.Lang.translate('settings_rest_source')
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
    var isMSX = !!(window.TVXHost || window.TVXManager);
    var isTizen = navigator.userAgent.toLowerCase().indexOf('tizen') !== -1;
    var isIFrame = window.parent !== window;
    var isLocal = !startsWith(window.location.protocol, 'http');
    var network = new Lampa.Reguest();
    var online_loading = false;

    function logApp() {
        console.log('Online Mod - UASerials');
        console.log('App', 'is MSX:', isMSX);
        console.log('App', 'is Tizen:', isTizen);
        console.log('App', 'is iframe:', isIFrame);
        console.log('App', 'is local:', isLocal);
    }

    function initStorage() {
        Lampa.Params.trigger('online_mod_prefer_http', window.location.protocol !== 'https:');
        Lampa.Params.trigger('online_mod_full_episode_title', false);
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
            online_mod_file_helper: { ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню', uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню', be: 'Утрымлівайце клавішу "ОК" для выкліку кантэкстнага меню', en: 'Hold the "OK" key to bring up the context menu', zh: '按住“确定”键调出上下文菜单' },
            online_mod_clearmark_all: { ru: 'Снять отметку у всех', uk: 'Зняти позначку у всіх', be: 'Зняць адзнаку ва ўсіх', en: 'Uncheck all', zh: '取消所有' },
            online_mod_timeclear_all: { ru: 'Сбросить тайм-код у всех', uk: 'Скинути тайм-код у всіх', be: 'Скінуць тайм-код ва ўсіх', en: 'Reset timecode for all', zh: '为所有人重置时间码' },
            online_mod_query_start: { ru: 'По запросу', uk: 'На запит', be: 'Па запыце', en: 'On request', zh: '根据要求' },
            online_mod_query_end: { ru: 'нет результатов', uk: 'немає результатів', be: 'няма вынікаў', en: 'no results', zh: '没有结果' },
            online_mod_title: { ru: 'Онлайн', uk: 'Онлайн', be: 'Анлайн', en: 'Online', zh: '在线的' },
            online_mod_title_full: { ru: 'Онлайн Мод (UASerials)', uk: 'Онлайн Мод (UASerials)', be: 'Анлайн Мод (UASerials)', en: 'Online Mod (UASerials)', zh: '在线的 Mod (UASerials)' },
            online_mod_prefer_http: { ru: 'Предпочитать поток по HTTP', uk: 'Віддавати перевагу потіку по HTTP', be: 'Аддаваць перавагу патоку па HTTP', en: 'Prefer stream over HTTP', zh: '优先于 HTTP 流式传输' },
            online_mod_full_episode_title: { ru: 'Полный формат названия серии', uk: 'Повний формат назви серії', be: 'Поўны фармат назвы серыі', en: 'Full episode title format', zh: '完整剧集标题格式' },
            online_mod_secret_password: { ru: 'Секретный пароль', uk: 'Секретний пароль', be: 'Сакрэтны пароль', en: 'Secret password', zh: '秘密密码' },
            online_mod_seasons_count: { ru: 'Сезонов', uk: 'Сезонів', be: 'Сезонаў', en: 'Seasons', zh: '季' },
            online_mod_episodes_count: { ru: 'Эпизодов', uk: 'Епізодів', be: 'Эпізодаў', en: 'Episodes', zh: '集' },
            online_mod_show_more: { ru: 'Показать ещё', uk: 'Показати ще', be: 'Паказаць яшчэ', en: 'Show more', zh: '展示更多' }
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

    // --- Запуск ---
    function startPlugin() {
        logApp();
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

        var button = "<div class=\"full-start__button selector view--online_mod\" data-subtitle=\"online_mod\">\n        <svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:svgjs=\"http://svgjs.com/svgjs\" version=\"1.1\" width=\"512\" height=\"512\" x=\"0\" y=\"0\" viewBox=\"0 0 244 260\" style=\"enable-background:new 0 0 512 512\" xml:space=\"preserve\" class=\"\">\n        <g xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"currentColor\"/>\n        </g></svg>\n        <span>#{online_mod_title}</span>\n        </div>";

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
