/**
 * Shell / MySQL-style exploration commands for DBGrader (learner Run only).
 * Not accepted as graded Check Answer submissions.
 */
(function (global) {
    'use strict';

    var HELP_TEXT = [
        '.tables / SHOW TABLES              List tables',
        '.schema [table]                    Show CREATE statements',
        '.indexes [table]                   List indexes',
        '.databases / SHOW DATABASES        Show attached databases',
        '.columns table / DESCRIBE table    Column info (PRAGMA table_info)',
        '.foreignkeys table                 Foreign keys',
        '.describe table                    Columns, indexes, and foreign keys',
        'SHOW CREATE TABLE table            CREATE statement',
        'SHOW INDEX FROM table              Indexes for a table',
        '.help                              This help'
    ];

    function firstStatement(input) {
        var text = String(input || '').trim();
        if (!text) return '';
        // Single exploration command — take first line, strip trailing semicolon
        var firstLine = text.split(/\r?\n/)[0].trim().replace(/;+\s*$/, '');
        return firstLine;
    }

    /**
     * Normalize shell (.) and easy MySQL explorers into { name, arg, raw, dialect }.
     */
    function parseMeta(input) {
        var raw = firstStatement(input);
        if (!raw) return null;

        // SQLite shell-style
        if (raw.charAt(0) === '.') {
            var m = raw.match(/^\.(\w+)(?:\s+(\S+))?/i);
            if (!m) return null;
            return {
                name: m[1].toLowerCase(),
                arg: m[2] || null,
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

    function stripQuotes(name) {
        if (!name) return null;
        return String(name).replace(/^[`"']+|[`"']+$/g, '');
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
        // LIKE 'foo' or LIKE foo — already stripped quotes in parse
        return quoteString(like);
    }

    /**
     * Map a meta-command to one or more { label, sql } jobs.
     */
    function expandMeta(meta) {
        var name = meta.name;
        var arg = meta.arg;

        if (name === 'help') {
            return [{
                label: 'help',
                sql: null,
                result: {
                    columns: ['command'],
                    rows: HELP_TEXT.map(function (line) { return [line]; })
                }
            }];
        }

        if (name === 'tables') {
            var tablesSql = "SELECT name AS 'Tables_in_main' FROM sqlite_schema " +
                "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
            if (meta.like) {
                tablesSql += ' AND name LIKE ' + likePatternSql(meta.like);
            }
            tablesSql += ' ORDER BY name';
            return [{ label: 'tables', sql: tablesSql }];
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
                    columns: ['Database'],
                    rows: [[':memory:']]
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
            if (!arg) throw metaError('.describe requires a table name');
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

        throw metaError('Unknown exploration command (try .help)');
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
