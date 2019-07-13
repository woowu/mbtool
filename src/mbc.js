#!/usr/bin/node --harmony
"use strict";
const ModbusRTU = require('modbus-serial');
const localUI = require('./localui');

const client = new ModbusRTU();

function makeConnection(cb)
{
    client.setTimeout(3000);
    if (argv.dev)
        client.connectRTUBuffered(argv.dev, { baudRate: argv.baudrate }, err => {;
            cb(err, client, argv.dev + '@' + argv.baudrate);
        });
    else
        client.connectTCP(argv.server, { port: argv.port }, err => {
            cb(err, client, argv.server + ':' + argv.port);
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
    .option('dev-addr', {
        describe: 'modbus slave device address to connect',
        nargs: 1,
        alias: 'u',
        demandOption: true,
    })
    .option('file', {
        describe: 'read script from file',
        nargs: 1,
        alias: 'f',
    })
    .argv;

makeConnection((err, conn, connStr) => {
    if (err) return console.error(err.message);
    conn.slaveAddr = argv.u;
    console.log('connected to ' + connStr);

    var commJob = require('./commjob')(conn);
    const localui = localUI(argv.f);
    localui.on('command', (cmd, args) => {
        commJob.pushCmd(localui, cmd, args);
    });
});
