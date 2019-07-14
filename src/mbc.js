#!/usr/bin/node --harmony
"use strict";

process.env.DEBUG_COLORS = 'no';
const debug = require('debug');
debug.enable('modbus-serial');
debug.log = log;
debug.formatters.O = formatLogObject;
debug.formatters.o = formatLogObject;

const fs = require('fs');
const util = require('util');
const readline = require('readline');
const ModbusRTU = require('modbus-serial');
const localui = require('./localui');
const webui = require('./webui');
const commjob = require('./commjob');

const client = new ModbusRTU();
var rtu;
var jobQueue;
var local;
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
    const samplePrefix = '2019-07-14T08:49:22.123Z modbus-serial ';
    const timestamp = new Date(args[0].split(/\s+/)[0]);
    const message = args[0].slice(samplePrefix.length);
    if (web) web.sendLog({timestamp, message});
}

function processCommandsFile(file, cb)
{
    const rl = readline.createInterface({
        input: fs.createReadStream(file),
    });
    jobQueue.on('queue-empty', function onQueueEmpty() {
        jobQueue.removeListener('queue-empty', onQueueEmpty);
        cb(null);
    });
    rl.on('line', line => {
        line = line.replace(/#.*$/, '').trim();
        if (! line.length) return;
        const tokens = line.split(/\s+/);
        const cmd = tokens[0];
        const args = tokens.slice(1);
        jobQueue.pushCmd(cmd, args);
    });
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

    conn.slaveAddr = argv.u;
    rtu = conn;
    console.log('connected to ' + connStr);

    web = webui(jobQueue);
    jobQueue = commjob(rtu);
    jobQueue.on('end', (err) => {
        if (err) console.error(err);
        local.close();
        web.close();
        rtu.close();
        setTimeout(() => {
            process.exit(0);
        }, 1);
    });
    local = localui({noAutoStart: true}, jobQueue);
    local.on('command', (cmd, args) => {
        jobQueue.pushCmd(cmd, args);
    });

    if (argv.f)
        processCommandsFile(argv.f, () => {
            local.start();
        });
    else
        local.start();
});

