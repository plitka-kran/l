//27.09.2025 - Fix

(function () {
    'use strict';

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

    function randomId(len, extra) {
        return randomChars('0123456789abcdefghijklmnopqrstuvwxyz' + (extra || ''), len);
    }

    function randomChars(chars, len) {
        return randomWords((chars || '').split(''), len);
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

    function baseUserAgent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
    }

    function rezka2Mirror() {
        var url = Lampa.Storage.get('online_mod_rezka2_mirror', '') + '';
        if (!url) return 'https://kvk.zone';
        if (url.indexOf('://') == -1) url = 'https://' + url;
        if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
        return url;
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

        if (Lampa.Storage.field('online_mod_proxy_' + name) === true) {
            if (name === 'rezka') return proxy2;
            if (name === 'rezka2') return proxy2;
            if (name === 'cookie') return proxy1;
        }

        return '';
    }

    function getMyIp() {
        return Lampa.Storage.get('my_ip', '');
    }

    function setMyIp(ip) {
        Lampa.Storage.set('my_ip', ip);
    }

    var Utils = {
        rezka2Mirror: rezka2Mirror,
        proxy: proxy,
        fixLink: fixLink,
        proxyLink: proxyLink,
        randomId: randomId,
        randomChars: randomChars,
        randomWords: randomWords,
        baseUserAgent: baseUserAgent,
        parseURL: parseURL,
        startsWith: startsWith,
        endsWith: endsWith,
        getMyIp: getMyIp,
        setMyIp: setMyIp
    };

    var network = new Lampa.Reguest();

    function rezka2Login(success, error) {
        var host = Utils.rezka2Mirror();
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
        var url = Utils.rezka2Mirror() + '/logout/';
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
        var prox = Utils.proxy('rezka2');
        var prox_enc = '';
        var returnHeaders = Lampa.Platform.is('android');
        var proxy_mirror = Lampa.Storage.field('online_mod_proxy_rezka2_mirror') === true;
        var host = prox && !proxy_mirror ? 'https://rezka.ag' : Utils.rezka2Mirror();
        if (!prox && !returnHeaders) prox = Utils.proxy('cookie');

        if (!prox && !returnHeaders) {
            if (error) error();
            return;
        }

        var user_agent = Utils.baseUserAgent();
        var headers = Lampa.Platform.is('android') ? {
            'User-Agent': user_agent
        } : {};

        if (prox) {
            prox_enc += 'param/User-Agent=' + encodeURIComponent(user_agent) + '/';
            prox_enc += 'cookie_plus/param/Cookie=/';
            returnHeaders = false;
        }

        var url = host + '/ajax/login/';
        var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
        postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
        postdata += '&login_not_save=0';
        network.clear();
        network.timeout(8000);
        network["native"](Utils.proxyLink(url, prox, prox_enc), function (json) {
            var cookie = '';
            var values = {};
            var sid = '';
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
                if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || Utils.randomId(26)) + (cookie ? '; ' + cookie : '');
                var prox_enc2 = prox_enc;

                if (prox) {
                    prox_enc2 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
                } else {
                    headers['Cookie'] = cookie;
                }

                network.clear();
                network.timeout(8000);
                network["native"](Utils.proxyLink(host + '/', prox, prox_enc2), function (str) {
                    var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
                    var body = (json && json.body || '').replace(/\n/g, '');
                    var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

                    if (error_form) {
                        Lampa.Noty.show(error_form[0]);
                        if (error) error();
                        return;
                    }

                    var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

                    if (cookieHeaders && cookieHeaders.forEach) {
                        cookieHeaders.forEach(function (param) {
                            var parts = param.split(';')[0].split('=');

                            if (parts[0]) {
                                if (parts[1] === 'deleted') delete values[parts[0]];
                                else values[parts[0]] = parts[1] || '';
                            }
                        });
                        sid = values['PHPSESSID'] || sid;
                        delete values['PHPSESSID'];
                        var _cookies = [];

                        for (var _name in values) {
                            _cookies.push(_name + '=' + values[_name]);
                        }

                        cookie = _cookies.join('; ');
                        if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                    }

                    var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

                    if (verify_form) {
                        var verify_cookie;

                        try {
                            verify_cookie = (0, eval)('"use strict"; (function(name, value){ return {name: name, value: value}; })' + verify_form[1] + ';');
                        } catch (e) {}

                        if (verify_cookie) {
                            values[verify_cookie.name] = verify_cookie.value;
                            var _cookies2 = [];

                            for (var _name2 in values) {
                                _cookies2.push(_name2 + '=' + values[_name2]);
                            }

                            cookie = _cookies2.join('; ');
                            if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                            if (cookie.indexOf('PHPSESSID=') == -1) cookie = 'PHPSESSID=' + (sid || Utils.randomId(26)) + (cookie ? '; ' + cookie : '');
                            var prox_enc3 = prox_enc;

                            if (prox) {
                                prox_enc3 += 'param/Cookie=' + encodeURIComponent(cookie) + '/';
                            } else {
                                headers['Cookie'] = cookie;
                            }

                            network.clear();
                            network.timeout(8000);
                            network["native"](Utils.proxyLink(host + '/', prox, prox_enc3), function (str) {
                                var json = typeof str === 'string' ? Lampa.Arrays.decodeJson(str, {}) : str;
                                var body = (json && json.body || '').replace(/\n/g, '');
                                var error_form = body.match(/(<div class="error-code">[^<]*<div>[^<]*<\/div>[^<]*<\/div>)\s*(<div class="error-title">[^<]*<\/div>)/);

                                if (error_form) {
                                    Lampa.Noty.show(error_form[0]);
                                    if (error) error();
                                    return;
                                }

                                var verify_form = body.match(/<span>MIRROR<\/span>.*<button type="submit" onclick="\$\.cookie(\([^)]*\))/);

                                if (verify_form) {
                                    Lampa.Storage.set('online_mod_rezka2_cookie', '');
                                    Lampa.Noty.show(Lampa.Lang.translate('online_mod_unsupported_mirror') + ' HDrezka');
                                    if (error) error();
                                    return;
                                }

                                var cookieHeaders = json && json.headers && json.headers['set-cookie'] || null;

                                if (cookieHeaders && cookieHeaders.forEach) {
                                    cookieHeaders.forEach(function (param) {
                                        var parts = param.split(';')[0].split('=');

                                        if (parts[0]) {
                                            if (parts[1] === 'deleted') delete values[parts[0]];
                                            else values[parts[0]] = parts[1] || '';
                                        }
                                    });
                                    sid = values['PHPSESSID'] || sid;
                                    delete values['PHPSESSID'];
                                    var _cookies3 = [];

                                    for (var _name3 in values) {
                                        _cookies3.push(_name3 + '=' + values[_name3]);
                                    }

                                    cookie = _cookies3.join('; ');
                                    if (cookie) Lampa.Storage.set('online_mod_rezka2_cookie', cookie);
                                }

                                if (success) success();
                            }, function (a, c) {
                                if (success) success();
                            }, false, {
                                dataType: 'text',
                                headers: headers,
                                returnHeaders: returnHeaders
                            });
                            return;
                        }
                    }

                    if (success) success();
                }, function (a, c) {
                    if (success) success();
                }, false, {
                    dataType: 'text',
                    headers: headers,
                    returnHeaders: returnHeaders
                });
            } else {
                if (error) error();
            }
        }, function (a, c) {
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, postdata, {
            headers: headers,
            returnHeaders: returnHeaders
        });
    }

    Lampa.Lang.add({
        online_mod_rezka2_mirror: {
            ru: 'Зеркало HDrezka',
            uk: 'Дзеркало HDrezka',
            be: 'Люстэрка HDrezka',
            en: 'HDrezka mirror',
            zh: 'HDrezka镜子'
        },
        online_mod_rezka2_name: {
            ru: 'Логин или email для HDrezka',
            uk: 'Логін чи email для HDrezka',
            be: 'Лагін ці email для HDrezka',
            en: 'Login or email for HDrezka',
            zh: 'HDrezka的登录名或电子邮件'
        },
        online_mod_rezka2_password: {
            ru: 'Пароль для HDrezka',
            uk: 'Пароль для HDrezka',
            be: 'Пароль для HDrezka',
            en: 'Password for HDrezka',
            zh: 'HDrezka的密码'
        },
        online_mod_rezka2_login: {
            ru: 'Войти в HDrezka',
            uk: 'Увійти до HDrezka',
            be: 'Увайсці ў HDrezka',
            en: 'Log in to HDrezka',
            zh: '登录HDrezka'
        },
        online_mod_rezka2_logout: {
            ru: 'Выйти из HDrezka',
            uk: 'Вийти з HDrezka',
            be: 'Выйсці з HDrezka',
            en: 'Log out of HDrezka',
            zh: '注销HDrezka'
        },
        online_mod_rezka2_cookie: {
            ru: 'Куки для HDrezka',
            uk: 'Кукі для HDrezka',
            be: 'Кукі для HDrezka',
            en: 'Cookie for HDrezka',
            zh: 'HDrezka 的 Cookie'
        },
        online_mod_rezka2_fill_cookie: {
            ru: 'Заполнить куки для HDrezka',
            uk: 'Заповнити кукі для HDrezka',
            be: 'Запоўніць кукі для HDrezka',
            en: 'Fill cookie for HDrezka',
            zh: '为HDrezka填充Cookie'
        },
        online_mod_rezka2_fix_stream: {
            ru: 'Фикс видеопотока для HDrezka',
            uk: 'Фікс відеопотоку для HDrezka',
            be: 'Фікс відэаструменю для HDrezka',
            en: 'Fix video stream for HDrezka',
            zh: '修复 HDrezka 的视频流'
        },
        online_mod_rezka2_prx_ukr: {
            ru: 'Прокси-сервер для HDrezka (Укр)',
            uk: 'Проксі-сервер для HDrezka (Укр)',
            be: 'Проксі-сервер для HDrezka (Укр)',
            en: 'Proxy server for HDrezka (Ukr)',
            zh: 'HDrezka 的代理服务器 （乌克兰）'
        },
        online_mod_proxy_rezka2_mirror: {
            ru: 'Проксировать зеркало HDrezka',
            uk: 'Проксирувати дзеркало HDrezka',
            be: 'Праксіраваць люстэрка HDrezka',
            en: 'Proxy HDrezka mirror',
            zh: '代理HDrezka镜子'
        },
        online_mod_unsupported_mirror: {
            ru: 'Неподдерживаемое зеркало',
            uk: 'Непідтримуване дзеркало',
            be: 'Непадтрымоўванае люстэрка',
            en: 'Unsupported mirror',
            zh: '不支持的镜子'
        },
        online_mod_proxy_balanser: {
            ru: 'Прокси-балансер',
            uk: 'Проксі-балансер',
            be: 'Проксі-балансер',
            en: 'Proxy balancer',
            zh: '代理平衡器'
        }
    });

    var template = "<div>";

    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_proxy_rezka2\" data-type=\"toggle\">\n        <div class=\"settings-param__name\">#{online_mod_proxy_balanser} HDrezka</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";
    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_mirror\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_mirror}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";
    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_proxy_rezka2_mirror\" data-type=\"toggle\">\n        <div class=\"settings-param__name\">#{online_mod_proxy_rezka2_mirror}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";
    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_name\" data-type=\"input\" placeholder=\"#{settings_cub_not_specified}\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_name}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_password\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_password}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";

    if (!Lampa.Platform.is('android')) {
        template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_login\" data-static=\"true\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_login}</div>\n        <div class=\"settings-param__status\"></div>\n    </div>\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_logout\" data-static=\"true\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_logout}</div>\n        <div class=\"settings-param__status\"></div>\n    </div>";
    }

    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_cookie\" data-type=\"input\" data-string=\"true\" placeholder=\"#{settings_cub_not_specified}\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_cookie}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_fill_cookie\" data-static=\"true\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_fill_cookie}</div>\n        <div class=\"settings-param__status\"></div>\n    </div>";
    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_fix_stream\" data-type=\"toggle\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_fix_stream}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";
    template += "\n    <div class=\"settings-param selector\" data-name=\"online_mod_rezka2_prx_ukr\" data-type=\"select\">\n        <div class=\"settings-param__name\">#{online_mod_rezka2_prx_ukr}</div>\n        <div class=\"settings-param__value\"></div>\n    </div>";

    template += "\n</div>";
    Lampa.Template.add('settings_online_mod', template);

    function addSettingsOnlineMod() {
        if (Lampa.Settings.main && Lampa.Settings.main() && !Lampa.Settings.main().render().find('[data-component="online_mod"]').length) {
            var field = $(Lampa.Lang.translate("<div class=\"settings-folder selector\" data-component=\"online_mod\">\n            <div class=\"settings-folder__icon\">\n                <svg height=\"260\" viewBox=\"0 0 244 260\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path d=\"M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z\" fill=\"white\"/>\n                </svg>\n            </div>\n            <div class=\"settings-folder__name\">#{online_mod_title_full}</div>\n        </div>"));
            Lampa.Settings.main().render().find('[data-component="more"]').after(field);
            Lampa.Settings.main().update();
        }
    }

    if (window.appready) addSettingsOnlineMod();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') addSettingsOnlineMod();
        });
    }

    Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == 'online_mod') {
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
})();
