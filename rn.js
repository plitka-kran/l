// Упрощенная версия rn.js для Tizen TV Samsung
// Поддержка: Rezka (обычный, rezka.ag) и Rezka2 (с зеркалом, прокси, авторизацией через cookie)
// Оптимизировано: только необходимые функции для Rezka/Rezka2.

(function () {
    'use strict';

    // Базовые утилиты
    var Utils = {
        baseUserAgent: function () {
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
        },
        parseURL: function (link) {
            var url = { href: link, protocol: '', host: '', origin: '', pathname: '', search: '', hash: '' };
            var pos = link.indexOf('#');
            if (pos !== -1) { url.hash = link.substring(pos); link = link.substring(0, pos); }
            pos = link.indexOf('?');
            if (pos !== -1) { url.search = link.substring(pos); link = link.substring(0, pos); }
            pos = link.indexOf(':');
            var path_pos = link.indexOf('/');
            if (pos !== -1 && (path_pos === -1 || path_pos > pos)) {
                url.protocol = link.substring(0, pos + 1);
                link = link.substring(pos + 1);
            }
            if (link.indexOf('//') === 0) {
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
        },
        fixLink: function (link, referrer) {
            if (link) {
                if (!referrer || link.indexOf('://') !== -1) return link;
                var url = this.parseURL(referrer);
                if (link.indexOf('//') === 0) return url.protocol + link;
                if (link.indexOf('/') === 0) return url.origin + link;
                if (link.indexOf('?') === 0) return url.origin + url.pathname + link;
                if (link.indexOf('#') === 0) return url.origin + url.pathname + url.search + link;
                var base = url.origin + url.pathname;
                base = base.substring(0, base.lastIndexOf('/') + 1);
                return base + link;
            }
            return link;
        },
        proxyLink: function (link, proxy, proxy_enc) {
            if (link && proxy) {
                if (!proxy_enc) proxy_enc = '';
                var pos = link.indexOf('/');
                if (pos !== -1 && link.charAt(pos + 1) === '/') pos++;
                var part1 = pos !== -1 ? link.substring(0, pos + 1) : '';
                var part2 = pos !== -1 ? link.substring(pos + 1) : link;
                return proxy + 'enc/' + encodeURIComponent(btoa(proxy_enc + part1)) + '/' + part2;
            }
            return link;
        },
        rezka2Mirror: function () {
            var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
            if (!url) return 'https://rezka.ag'; // Fallback на основной сайт
            if (url.indexOf('://') == -1) url = 'https://' + url;
            if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
            return url;
        },
        proxy: function (name) {
            var proxy2 = (window.location.protocol === 'https:' ? 'https://' : 'http://') + 'iqslgbok.deploy.cx/';
            var proxy_other = Lampa.Storage.field('online_mod_proxy_other') === true;
            var proxy_other_url = proxy_other ? Lampa.Storage.field('online_mod_proxy_other_url') + '' : '';
            var user_proxy2 = (proxy_other_url || proxy2);
            if (name === 'rezka') return user_proxy2;
            if (name === 'rezka2') return user_proxy2;
            return '';
        },
        getRezkaProxy: function () {
            var use_ukr_proxy = Lampa.Storage.field('online_mod_rezka2_prx_ukr') === true;
            if (use_ukr_proxy) {
                return 'https://cors.apn.monster/'; // Прокси для UA
            }
            return Utils.proxy('rezka2');
        }
    };

    // Языковые строки
    Lampa.Lang.add({
        online_mod_title_full: { ru: 'Онлайн' },
        online_mod_title: { ru: 'Онлайн' },
        online_mod_watch: { ru: 'Смотреть онлайн' },
        online_mod_nolink: { ru: 'Не удалось извлечь ссылку' },
        online_mod_unsupported_mirror: { ru: 'Неподдерживаемое зеркало' },
        online_mod_rezka2_mirror: { ru: 'Зеркало HDRezka' },
        online_mod_proxy_rezka2_mirror: { ru: 'Прокси для зеркала HDRezka' },
        rezka2_prx_ukr: { ru: 'Прокси для Украины' },
        online_mod_rezka2_cookie: { ru: 'Cookie для HDRezka' }
    });

    // Функция заполнения cookie для Rezka2
    function rezka2FillCookie(success, error) {
        var prox = Utils.proxy('rezka2');
        var prox_enc = '';
        var proxy_mirror = Lampa.Storage.field('online_mod_proxy_rezka2_mirror') === true;
        var host = prox && !proxy_mirror ? 'https://rezka.ag' : Utils.rezka2Mirror();
        if (!prox) prox = Utils.proxy('cookie');

        var user_agent = Utils.baseUserAgent();
        var headers = { 'User-Agent': user_agent };

        if (prox) {
            prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
            prox_enc += 'cookie_plus/param/Cookie=/';
        }

        var url = host + '/ajax/login/';
        var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
        postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
        postdata += '&login_not_save=0';
        var network = new Lampa.Reguest();
        network.clear();
        network.timeout(8000);
        network["native"](Utils.proxyLink(url, prox, prox_enc), function (json) {
            var cookie = '';
            var values = {};
            var body = json && json.body || {};
            body = typeof body === 'string' ? Lampa.Arrays.decodeJson(body, {}) : body;

            if (!body.success) {
                if (body.message) Lampa.Noty.show(body.message);
                if (error) error();
                return;
            }

            var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;
            if (cookieHeaders && cookieHeaders.forEach) {
                cookieHeaders.forEach(function (param) {
                    var parts = param.split(';')[0].split('=');
                    if (parts[0]) {
                        if (parts[1] === 'deleted') delete values[parts[0]]; else values[parts[0]] = parts[1] || '';
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
                if (success) success(cookie);
            } else {
                if (error) error();
            }
        }, function (a, c) {
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, postdata, { headers: headers });
    }

    // Основной компонент
    var component = {
        choice: { season: 0, voice: 0 },
        filter_items: { season: [], voice: [] },
        search: function (_object, kinopoisk_id, data) {
            var object = _object;
            var select_title = object.search || object.movie.title;
            var error = this.empty.bind(this);
            var use_rezka2 = Lampa.Storage.field('online_mod_balanser') === 'rezka2';
            var host = use_rezka2 ? Utils.rezka2Mirror() : 'https://rezka.ag';
            var prox = Utils.getRezkaProxy();
            var prox_enc = 'param/User-Agent=' + encodeURIComponent(Utils.baseUserAgent()) + '/';
            var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '');
            if (use_rezka2 && cookie) {
                prox_enc += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
            }
            var url = host + '/ajax/search/?action=query&q=' + encodeURIComponent(select_title) + '&kp_id=' + kinopoisk_id;
            var network = new Lampa.Reguest();
            network.clear();
            network.timeout(10000);
            network.silent(Utils.proxyLink(url, prox, prox_enc), function (json) {
                if (json && json.length) {
                    var success = json[0];
                    var url_embed = host + success.url;
                    network.clear();
                    network.timeout(10000);
                    network.silent(Utils.proxyLink(url_embed, prox, prox_enc), function (str) {
                        var parse = str.match(/<iframe src="([^"]+)"/);
                        if (parse) {
                            var player_url = Utils.fixLink(parse[1], url_embed);
                            network.clear();
                            network.timeout(10000);
                            network.silent(Utils.proxyLink(player_url, prox, prox_enc), function (str2) {
                                var parse2 = str2.match(/data-document="([^"]+)"/);
                                if (parse2) {
                                    var playlist = JSON.parse(atob(parse2[1]));
                                    if (playlist && playlist.playlist && playlist.playlist.length) {
                                        var extract = playlist.playlist[0].seasons || [{ episodes: playlist.playlist }];
                                        this.extendChoice(object.movie ? object.movie.choice : null);
                                        this.reset();
                                        var itemsProcessed = [];
                                        extract.forEach(function (season, s) {
                                            season.episodes.forEach(function (episode, e) {
                                                episode.media.forEach(function (voice) {
                                                    itemsProcessed.push({
                                                        title: 'Сезон ' + (s + 1) + ' / Серия ' + (e + 1),
                                                        quality: voice.max_quality + 'p',
                                                        info: ' / ' + voice.translator.name,
                                                        season: s + 1,
                                                        episode: e + 1,
                                                        media: voice
                                                    });
                                                });
                                            });
                                        });
                                        this.append(itemsProcessed);
                                    } else {
                                        this.emptyForQuery(select_title);
                                    }
                                } else {
                                    this.emptyForQuery(select_title);
                                }
                            }.bind(this), function () { this.emptyForQuery(select_title); }.bind(this));
                        } else {
                            this.emptyForQuery(select_title);
                        }
                    }.bind(this), function () { this.emptyForQuery(select_title); }.bind(this));
                } else {
                    this.emptyForQuery(select_title);
                }
            }.bind(this), error);
        },
        extendChoice: function (saved) {
            Lampa.Arrays.extend(this.choice, saved, true);
        },
        reset: function () {
            this.activity.loader(false);
            this.activity.render().find('.selector').remove();
        },
        filter: function (filter_items, choice) {
            this.filter_items = filter_items;
            this.choice = choice;
        },
        append: function (items) {
            var _this = this;
            items.forEach(function (element) {
                var item = Lampa.Template.get('online_mod', element);
                item.on('hover:enter', function () {
                    _this.startLoad();
                    _this.loadData(element.media.file).then(function (result) {
                        Lampa.Player.play(result);
                        _this.stopLoad();
                    }).catch(function () {
                        Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
                        _this.stopLoad();
                    });
                });
                _this.activity.render().append(item);
            });
        },
        loadData: function (file) {
            return new Promise(function (resolve, reject) {
                var use_rezka2 = Lampa.Storage.field('online_mod_balanser') === 'rezka2';
                var prox = Utils.getRezkaProxy();
                var prox_enc = 'param/User-Agent=' + encodeURIComponent(Utils.baseUserAgent()) + '/';
                var cookie = Lampa.Storage.get('online_mod_rezka2_cookie', '');
                if (use_rezka2 && cookie) {
                    prox_enc += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
                }
                var network = new Lampa.Reguest();
                network.timeout(10000);
                network.silent(Utils.proxyLink(file, prox, prox_enc), function (str) {
                    var parse = str.match(/\.mp4" src="([^"]+)"/);
                    if (parse) resolve({ url: Utils.fixLink(parse[1], file) });
                    else reject();
                }, reject);
            });
        },
        empty: function () {
            this.activity.loader(false);
            this.activity.empty();
        },
        emptyForQuery: function (query) {
            this.empty('По запросу "' + query + '" ничего не найдено');
        }
    };

    // Шаблон
    Lampa.Template.add('online_mod', '<div class="online selector"><div class="online__body"><div class="online__title">{title}</div><div class="online__quality">{quality}{info}</div></div></div>');

    // Добавление компонента
    Lampa.Component.add('online_mod', component);

    // Кнопка
    var button = '<div class="full-start__button selector view--online_mod" data-subtitle=""><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 260"><path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z" fill="currentColor"/></svg><span>#{online_mod_title}</span></div>';
    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
            var btn = $(Lampa.Lang.translate(button));
            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url: '',
                    title: Lampa.Lang.translate('online_mod_title_full'),
                    component: 'online_mod',
                    search: e.data.movie.title,
                    movie: e.data.movie,
                    page: 1
                });
            });
            e.object.activity.render().find('.view--torrent').after(btn);
        }
    });

    // Настройки
    var template = '<div>' +
        '<div class="settings-param selector" data-name="online_mod_balanser" data-type="select">' +
            '<div class="settings-param__name">Балансер</div>' +
            '<div class="settings-param__value"></div>' +
        '</div>' +
        '<div class="settings-param selector" data-name="online_mod_rezka2_mirror" data-type="input" placeholder="#{settings_cub_not_specified}">' +
            '<div class="settings-param__name">#{online_mod_rezka2_mirror}</div>' +
            '<div class="settings-param__value"></div>' +
        '</div>' +
        '<div class="settings-param selector" data-name="online_mod_proxy_rezka2_mirror" data-type="toggle">' +
            '<div class="settings-param__name">#{online_mod_proxy_rezka2_mirror}</div>' +
            '<div class="settings-param__value"></div>' +
        '</div>' +
        '<div class="settings-param selector" data-name="online_mod_rezka2_prx_ukr" data-type="toggle">' +
            '<div class="settings-param__name">#{rezka2_prx_ukr}</div>' +
            '<div class="settings-param__value"></div>' +
        '</div>' +
        '<div class="settings-param selector" data-name="online_mod_rezka2_cookie" data-type="input" data-string="true" placeholder="#{settings_cub_not_specified}">' +
            '<div class="settings-param__name">#{online_mod_rezka2_cookie}</div>' +
            '<div class="settings-param__value"></div>' +
        '</div>' +
        '<div class="settings-param selector" data-name="online_mod_rezka2_fill_cookie" data-static="true">' +
            '<div class="settings-param__name">Заполнить Cookie</div>' +
            '<div class="settings-param__status"></div>' +
        '</div>' +
    '</div>';
    Lampa.Template.add('settings_online_mod', template);

    // Инициализация настроек
    if (window.appready) addSettings(); else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') addSettings();
        });
    }
    function addSettings() {
        if (Lampa.Settings.main && Lampa.Settings.main() && !Lampa.Settings.main().render().find('[data-component="online_mod"]').length) {
            var field = $(Lampa.Lang.translate('<div class="settings-folder selector" data-component="online_mod"><div class="settings-folder__icon"><svg height="260" viewBox="0 0 244 260" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z" fill="white"/></svg></div><div class="settings-folder__name">#{online_mod_title_full}</div></div>'));
            Lampa.Settings.main().render().find('[data-component="more"]').after(field);
            Lampa.Settings.main().update();
        }
    }
    Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == 'online_mod') {
            var balanser = e.body.find('[data-name="online_mod_balanser"]');
            balanser.find('.settings-param__value').html('<div class="settings-param__value-selector"><div class="settings-param__value-selector-item selector" data-item="rezka">Rezka (rezka.ag)</div><div class="settings-param__value-selector-item selector" data-item="rezka2">Rezka2</div></div>');
            balanser.unbind('hover:enter').on('hover:enter', function () {
                var select = $('.settings-param__value-selector', balanser);
                select.toggleClass('open');
            }).find('.settings-param__value-selector-item').on('hover:enter', function () {
                Lampa.Storage.set('online_mod_balanser', $(this).data('item'));
                balanser.find('.settings-param__value').html($(this).text());
                $('.settings-param__value-selector', balanser).removeClass('open');
            }).eq(0).trigger('hover:enter');

            var fill_cookie = e.body.find('[data-name="online_mod_rezka2_fill_cookie"]');
            fill_cookie.unbind('hover:enter').on('hover:enter', function () {
                var status = $('.settings-param__status', fill_cookie).removeClass('active error wait').addClass('wait');
                rezka2FillCookie(function (cookie) {
                    status.removeClass('active error wait').addClass('active');
                    Lampa.Params.update(e.body.find('[data-name="online_mod_rezka2_cookie"]'), [], e.body);
                }, function () {
                    status.removeClass('active error wait').addClass('error');
                });
            });
        }
    });

})();
