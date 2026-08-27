/* Lampa.plugin — Жанрові рядки (лише українською) + серіали UA / RU / інші */
(function () {
    'use strict';

    if (window.__genres_ua_plugin) return;
    window.__genres_ua_plugin = true;

    function waitForLampa(callback) {
        if (window.Lampa && Lampa.ContentRows && Lampa.Api) {
            callback();
        } else {
            setTimeout(function () {
                waitForLampa(callback);
            }, 100);
        }
    }

    waitForLampa(function () {
        var PLUGIN = 'genres_ua';

        function setting(name, def) {
            return Lampa.Storage.get(name, def);
        }

        // ========== ФІЛЬМИ (жанри TMDB) ==========
        var MOVIE_GENRES = {
            comedy:     { id: 35,    title: 'Комедії' },
            action:     { id: 28,    title: 'Бойовики' },
            thriller:   { id: 53,    title: 'Трилери' },
            drama:      { id: 18,    title: 'Драми' },
            family:     { id: 10751, title: 'Сімейні' },
            horror:     { id: 27,    title: 'Жахи' },
            scifi:      { id: 878,   title: 'Фантастика' },
            fantasy:    { id: 14,    title: 'Фентезі' },
            adventure:  { id: 12,    title: 'Пригоди' },
            crime:      { id: 80,    title: 'Кримінал' },
            animation:  { id: 16,    title: 'Мультфільми' },
            romance:    { id: 10749, title: 'Мелодрами' },
            mystery:    { id: 9648,  title: 'Детективи' },
            war:        { id: 10752, title: 'Військові' },
            history:    { id: 36,    title: 'Історичні' },
            documentary:{ id: 99,    title: 'Документальні' },
            music:      { id: 10402, title: 'Музичні' },
            western:    { id: 37,    title: 'Вестерни' }
        };

        // Леонід Гайдай — TMDB person id
        var GAIDAI_ID = 1190421;

        // ========== СЕРІАЛИ ==========
        var SERIES_ROWS = {
            ua: {
                title: 'Українські серіали',
                url: 'discover/tv?with_origin_country=UA&sort_by=popularity.desc&include_adult=false&vote_count.gte=5'
            },
            ru: {
                title: 'Російські серіали',
                url: 'discover/tv?with_origin_country=RU&with_original_language=ru&sort_by=popularity.desc&include_adult=false&vote_count.gte=20'
            },
            other: {
                title: 'Серіали інших студій',
                // без UA і RU, популярні закордонні
                url: 'discover/tv?without_origin_country=UA|RU&sort_by=popularity.desc&include_adult=false&vote_count.gte=100'
            }
        };

        function registerSettings() {
            if (!Lampa.SettingsApi) return;

            Lampa.SettingsApi.addComponent({
                component: PLUGIN,
                name: 'Жанрові рядки',
                icon: '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>'
            });

            // --- Фільми ---
            Object.keys(MOVIE_GENRES).forEach(function (key) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: {
                        name: PLUGIN + '_m_' + key,
                        type: 'trigger',
                        default: true
                    },
                    field: {
                        name: 'Фільми · ' + MOVIE_GENRES[key].title
                    }
                });
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: PLUGIN + '_gaidai',
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Фільми · Комедії Гайдая'
                }
            });

            // --- Серіали ---
            Object.keys(SERIES_ROWS).forEach(function (key) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: {
                        name: PLUGIN + '_s_' + key,
                        type: 'trigger',
                        default: true
                    },
                    field: {
                        name: 'Серіали · ' + SERIES_ROWS[key].title
                    }
                });
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: PLUGIN + '_limit',
                    type: 'select',
                    values: {
                        12: '12',
                        20: '20',
                        30: '30'
                    },
                    default: 20
                },
                field: {
                    name: 'Кількість карток'
                }
            });
        }

        function normalizeResults(results) {
            var exists = {};
            results = (results || []).filter(function (card) {
                if (!card.poster_path) return false;
                var title = (card.title || card.name || '').toLowerCase();
                var year = (card.release_date || card.first_air_date || '').slice(0, 4);
                var key = title + '|' + year;
                if (exists[key]) return false;
                exists[key] = true;
                card.promo = card.overview;
                card.promo_title = card.title || card.name;
                return true;
            });
            return results;
        }

        function fetchRow(title, url) {
            return function (ready) {
                Lampa.Api.list(
                    {
                        source: 'tmdb',
                        url: url
                    },
                    function (json) {
                        json = json || {};
                        var limit = Number(setting(PLUGIN + '_limit', 20));
                        json.results = normalizeResults(json.results).slice(0, limit);
                        json.title = title;
                        json.name = title;
                        ready(json);
                    },
                    function () {
                        ready({ title: title, name: title, results: [] });
                    }
                );
            };
        }

        function createMovieGenreRow(title, genreId) {
            var url =
                'discover/movie' +
                '?with_genres=' + genreId +
                '&sort_by=popularity.desc' +
                '&include_adult=false' +
                '&vote_count.gte=50';
            return fetchRow(title, url);
        }

        function createGaidaiRow() {
            var url =
                'discover/movie' +
                '?with_people=' + GAIDAI_ID +
                '&sort_by=primary_release_date.desc' +
                '&include_adult=false';
            return fetchRow('Комедії Гайдая', url);
        }

        registerSettings();

        var index = 4;

        // ----- Фільми: жанри -----
        Object.keys(MOVIE_GENRES).forEach(function (key) {
            var g = MOVIE_GENRES[key];
            Lampa.ContentRows.add({
                name: PLUGIN + '_m_' + key,
                title: g.title,
                screen: ['main'],
                index: index++,
                call: function () {
                    if (!setting(PLUGIN + '_m_' + key, true)) return [];
                    return createMovieGenreRow(g.title, g.id);
                }
            });
        });

        // ----- Комедії Гайдая -----
        Lampa.ContentRows.add({
            name: PLUGIN + '_gaidai',
            title: 'Комедії Гайдая',
            screen: ['main'],
            index: index++,
            call: function () {
                if (!setting(PLUGIN + '_gaidai', true)) return [];
                return createGaidaiRow();
            }
        });

        // ----- Серіали -----
        Object.keys(SERIES_ROWS).forEach(function (key) {
            var s = SERIES_ROWS[key];
            Lampa.ContentRows.add({
                name: PLUGIN + '_s_' + key,
                title: s.title,
                screen: ['main'],
                index: index++,
                call: function () {
                    if (!setting(PLUGIN + '_s_' + key, true)) return [];
                    return fetchRow(s.title, s.url);
                }
            });
        });

        console.log('[Genres UA] loaded — фільми + серіали UA/RU/інші');
    });
})();
