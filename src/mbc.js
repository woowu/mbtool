#!/usr/bin/node --harmony
"use strict";

process.env.DEBUG_COLORS = 'no';
const debug = require('debug');
debug.enable('modbus-serial');
debug.log = log;
debug.formatters.O = formatLogObject;
debug.formatters.o = formatLogObject;

const util = require('util');
const ModbusRTU = require('modbus-serial');
const localui = require('./localui');
const webui = require('./webui');
const commjob = require('./commjob');

const client = new ModbusRTU();
var web;

function makeConnection(cb)
{
    if (argv.dev) {
        client.connectRTUBuffered(argv.dev, { baudRate: argv.baudrate }, err => {;
            cb(err, client, argv.dev + '@' + argv.baudrate);
        });
        client.setTimeout(2000);
    } else {
        client.connectTCP(argv.server, { port: argv.port }, err => {
            cb(err, client, argv.server + ':' + argv.port);
        });
        client.setTimeout(5000);
    }
}

function formatLogObject(o)
{
    function groupString(str, size)
    {
        var s = '';
        var r = str;
        while (r.length) {
            s += r.slice(0, size);
            r = r.slice(size);
            if (r.length) s += ' ';
        }
        return s;
    }

    var line = '';
    Object.keys(o).forEach(k => {
        if (k == 'action')
            line += o[k] + ': ';
        else if (typeof o[k] == 'string')
            line += k + ': ' + o[k].replace(/\n/g, ' ') + '; ';
        else if (typeof o[k] == 'number' || typeof o[k] == 'boolean')
            line += k + ': ' + o[k].toString() + '; ';
        else if (Buffer.isBuffer(o[k]))
            line += 'buffer: ' + groupString(o[k].toString('hex'), 4) + '; ';
        else if (Array.isArray(o[k]))
            line += k.toLowerCase() + ': ' + o[k].toString() + '; ';
        else
            line += '<' + typeof o[k] + '>; ';
    });
    return line.slice(0, -2);
}

function log(...args)
{
    if (! web) return;
    const samplePrefix = '2019-07-14T08:49:22.123Z modbus-serial ';
    const timestamp = new Date(args[0].split(/\s+/)[0]);
    const message = args[0].slice(samplePrefix.length);
    web.sendLog({timestamp, message});
}

var argv = require('yargs')
    .option('server', {
        describe: 'server IP address',
        nargs: 1,
        default: 'localhost',
        alias: 's',
    })
    .option('port', {
        describe: 'tcp port number of server',
        nargs: 1,
        default: 502,
        alias: 'p',
    })
    .option('dev', {
        describe: 'name of serial device',
        nargs: 1,
        alias: 'd',
    })
    .option('baudrate', {
        describe: 'serial baudrate',
        nargs: 1,
        default: 9600,
        alias: 'b',
    })
    .option('unit-id', {
        describe: 'modbus server address (a.k.a, unit id)',
        nargs: 1,
        alias: 'u',
        demandOption: true,
    })
    .option('file', {
        describe: 'run script from file',
        nargs: 1,
        alias: 'f',
    })
    .argv;

makeConnection((err, conn, connStr) => {
    if (err) return console.error(err.message);

    web = webui();

    conn.slaveAddr = argv.u;
    console.log('connected to ' + connStr);

    var jobQueue = commjob(conn);
    const local = localui(argv.f);
    local.on('command', (cmd, args) => {
        jobQueue.pushCmd(local, cmd, args);
    });
});

