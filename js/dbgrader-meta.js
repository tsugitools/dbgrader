/**
 * Shell / MySQL / psql-style exploration commands for DBGrader (learner Run only).
 * Not accepted as graded Check Answer submissions.
 *
 * .help lists sqlite3-style commands only; MySQL / psql aliases still work.
 */
(function (global) {
    'use strict';

    // sqlite3-style listing only (aliases work but stay out of .help)
    var HELP_ENTRIES = [
        ['.help ?PATTERN?', 'Show this message'],
        ['.tables ?TABLE?', 'List names of tables matching LIKE pattern TABLE'],
        ['.schema ?TABLE?', 'Show the CREATE statements matching TABLE'],
        ['.indexes ?TABLE?', 'Show names of indexes'],
        ['.columns TABLE', 'Show column info for TABLE'],
        ['.describe TABLE', 'Show columns, indexes, and foreign keys'],
        ['.databases', 'List names of attached databases']
    ];

    function formatHelpText(pattern) {
        var entries = HELP_ENTRIES;
        if (pattern) {
            var p = String(pattern).replace(/^\./, '').toLowerCase();
            entries = HELP_ENTRIES.filter(function (pair) {
                return pair[0].toLowerCase().indexOf(p) >= 0
                    || pair[1].toLowerCase().indexOf(p) >= 0;
            });
            if (!entries.length) {
                return 'No help found for "' + String(pattern) + '"';
            }
        }
        var width = 0;
        entries.forEach(function (pair) {
            if (pair[0].length > width) width = pair[0].length;
        });
        // sqlite3 pads commands to a comfortable column
        if (width < 22) width = 22;
        return entries.map(function (pair) {
            var pad = width - pair[0].length + 2;
            return pair[0] + new Array(pad + 1).join(' ') + pair[1];
        }).join('\n');
    }

    function firstStatement(input) {
        var text = String(input || '').trim();
        if (!text) return '';
        var firstLine = text.split(/\r?\n/)[0].trim().replace(/;+\s*$/, '');
        return firstLine;
    }

    function stripQuotes(name) {
        if (!name) return null;
        return String(name).replace(/^[`"']+|[`"']+$/g, '');
    }

    function mapPsql(cmd, arg, raw) {
        var base = { raw: raw, dialect: 'postgresql' };

        if (cmd === '?' || cmd === 'h' || cmd === 'help') {
            return Object.assign({ name: 'help', arg: null }, base);
        }
        if (cmd === 'dt') {
            return Object.assign({ name: 'tables', arg: null }, base);
        }
        if (cmd === 'di') {
            return Object.assign({ name: 'indexes', arg: arg }, base);
        }
        if (cmd === 'dv') {
            return Object.assign({ name: 'views', arg: null }, base);
        }
        if (cmd === 'l' || cmd === 'list') {
            return Object.assign({ name: 'databases', arg: null }, base);
        }
        // \d with no arg → list relations; with arg → rich describe
        if (cmd === 'd') {
            if (arg) {
                return Object.assign({ name: 'describe', arg: arg }, base);
            }
            return Object.assign({ name: 'relations', arg: null }, base);
        }
        return null;
    }

    /**
     * Normalize shell (.), MySQL, and psql explorers into { name, arg, raw, dialect }.
     */
    function parseMeta(input) {
        var raw = firstStatement(input);
        if (!raw) return null;

        // psql-style (\dt, \d table, \di, \dv, \l, \?)
        if (raw.charAt(0) === '\\') {
            var psql = raw.match(/^\\([?a-zA-Z]+)[+S]?(?:\s+(\S+))?/);
            if (!psql) return null;
            var cmd = psql[1].toLowerCase();
            var arg = psql[2] ? stripQuotes(psql[2]) : null;
            return mapPsql(cmd, arg, raw);
        }

        // SQLite shell-style
        if (raw.charAt(0) === '.') {
            var m = raw.match(/^\.(\w+)(?:\s+(\S+))?/i);
            if (!m) return null;
            return {
                name: m[1].toLowerCase(),
                arg: m[2] ? stripQuotes(m[2]) : null,
                raw: raw,
                dialect: 'sqlite-shell'
            };
        }

        // MySQL-style (case-insensitive)
        var showTables = raw.match(/^SHOW\s+TABLES(?:\s+FROM\s+(\S+))?(?:\s+LIKE\s+(\S+))?$/i);
        if (showTables) {
            return {
                name: 'tables',
                arg: null,
                like: stripQuotes(showTables[2]),
                raw: raw,
                dialect: 'mysql'
            };
        }

        var showDatabases = raw.match(/^SHOW\s+(DATABASES|SCHEMAS)$/i);
        if (showDatabases) {
            return { name: 'databases', arg: null, raw: raw, dialect: 'mysql' };
        }

        var showCreate = raw.match(/^SHOW\s+CREATE\s+TABLE\s+(\S+)$/i);
        if (showCreate) {
            return {
                name: 'schema',
                arg: stripQuotes(showCreate[1]),
                raw: raw,
                dialect: 'mysql'
            };
        }

        var showIndex = raw.match(/^SHOW\s+(?:INDEX|INDEXES|KEYS)\s+(?:FROM\s+)?(\S+)$/i);
        if (showIndex) {
            return {
                name: 'indexes',
                arg: stripQuotes(showIndex[1]),
                raw: raw,
                dialect: 'mysql'
            };
        }

        var describe = raw.match(/^(?:DESCRIBE|DESC)\s+(\S+)$/i);
        if (describe) {
            return {
                name: 'columns',
                arg: stripQuotes(describe[1]),
                raw: raw,
                dialect: 'mysql'
            };
        }

        return null;
    }

    function isMeta(input) {
        return !!parseMeta(input);
    }

    function quoteString(name) {
        return "'" + String(name).replace(/'/g, "''") + "'";
    }

    function quoteIdent(name) {
        return '"' + String(name).replace(/"/g, '""') + '"';
    }

    function likePatternSql(like) {
        if (!like) return null;
        return quoteString(like);
    }

    function expandMeta(meta) {
        var name = meta.name;
        var arg = meta.arg;

        if (name === 'help') {
            return [{
                label: 'help',
                sql: null,
                result: {
                    text: formatHelpText(arg)
                }
            }];
        }

        if (name === 'tables') {
            var tablesSql = "SELECT name AS 'Table' FROM sqlite_schema " +
                "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
            var tableLike = meta.like || arg;
            if (tableLike) {
                tablesSql += ' AND name LIKE ' + likePatternSql(tableLike);
            }
            tablesSql += ' ORDER BY name';
            return [{
                label: 'tables',
                sql: tablesSql,
                withRowCounts: true
            }];
        }

        if (name === 'views') {
            return [{
                label: 'views',
                sql: "SELECT name AS 'View' FROM sqlite_schema " +
                    "WHERE type = 'view' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            }];
        }

        if (name === 'relations') {
            return [{
                label: 'relations',
                sql: "SELECT name AS 'Name', type AS 'Type' FROM sqlite_schema " +
                    "WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' " +
                    "ORDER BY type, name"
            }];
        }

        if (name === 'schema') {
            if (arg) {
                return [{
                    label: 'schema ' + arg,
                    sql: "SELECT name AS 'Table', sql AS 'Create Table' FROM sqlite_schema WHERE name = " +
                        quoteString(arg) + " AND sql IS NOT NULL"
                }];
            }
            return [{
                label: 'schema',
                sql: "SELECT type, name, sql FROM sqlite_schema " +
                    "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' " +
                    "ORDER BY type, name"
            }];
        }

        if (name === 'indexes' || name === 'indices') {
            if (arg) {
                return [{
                    label: 'indexes ' + arg,
                    sql: "SELECT name, sql FROM sqlite_schema " +
                        "WHERE type = 'index' AND tbl_name = " + quoteString(arg) +
                        " ORDER BY name"
                }];
            }
            return [{
                label: 'indexes',
                sql: "SELECT name, tbl_name, sql FROM sqlite_schema " +
                    "WHERE type = 'index' AND name NOT LIKE 'sqlite_%' " +
                    "ORDER BY tbl_name, name"
            }];
        }

        if (name === 'databases') {
            return [{
                label: 'databases',
                sql: null,
                result: {
                    columns: ['name', 'file'],
                    rows: [['main', '']]
                }
            }];
        }

        if (name === 'columns') {
            if (!arg) throw metaError('DESCRIBE / .columns requires a table name');
            return [{
                label: 'columns ' + arg,
                sql: 'PRAGMA table_info(' + quoteIdent(arg) + ')'
            }];
        }

        if (name === 'foreignkeys') {
            if (!arg) throw metaError('.foreignkeys requires a table name');
            return [{
                label: 'foreignkeys ' + arg,
                sql: 'PRAGMA foreign_key_list(' + quoteIdent(arg) + ')'
            }];
        }

        if (name === 'describe') {
            if (!arg) throw metaError('.describe / \\d requires a table name');
            var qi = quoteIdent(arg);
            var qs = quoteString(arg);
            return [
                {
                    label: 'columns',
                    sql: 'PRAGMA table_info(' + qi + ')'
                },
                {
                    label: 'indexes',
                    sql: "SELECT name, sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = " +
                        qs + ' ORDER BY name'
                },
                {
                    label: 'foreign keys',
                    sql: 'PRAGMA foreign_key_list(' + qi + ')'
                },
                {
                    label: 'create',
                    sql: 'SELECT sql FROM sqlite_schema WHERE name = ' + qs + ' AND sql IS NOT NULL'
                }
            ];
        }

        throw metaError('Unknown exploration command (try .help or \\?)');
    }

    function metaError(message) {
        var err = new Error(message);
        err.phase = 'meta';
        return err;
    }

    global.DBGraderMeta = {
        parseMeta: parseMeta,
        isMeta: isMeta,
        expandMeta: expandMeta
    };
})(typeof window !== 'undefined' ? window : self);
