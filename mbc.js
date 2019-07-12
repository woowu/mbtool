#!/usr/bin/node --harmony
"use strict";
const fs = require('fs');
const readline = require('readline');
const pad = require('pad');
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

var slaveAddr;

const commandHandlers = {
    delay: function(msecs, cb) {
        setTimeout(cb, msecs);
    },
    fc1: function(addr, n, cb) {
        mbContinueWrite(client.writeFC1.bind(client), addr, n, cb);
    },
    fc3: function(addr, n, cb) {
        mbContinueWrite(client.writeFC3.bind(client), addr, n, cb);
    },
};

function makeConnection(cb)
{
    if (argv.server)
        client.connectTCP(argv.server, { port: argv.port }, (err) => {
            cb(err, client, argv.server + ':' + argv.port);
        });
    else
        client.connectRTUBuffered(argv.dev, { baudRate: argv.baud }, (err) => {;
            cb(err, client, argv.dev + '@' + argv.baud);
        });
}

function printContinueData(resp, startAddr)
{
    const lineWidth = 16;
    var valuePad = 4;
    if (Array.isArray(resp) && typeof resp[0] == 'boolean') {
        resp = resp.map(b => b ? '1' : '0');
        valuePad = 1;
    }
    var rowNo = 0;
    while (resp.length > 0) {
        const row = resp.slice(0, lineWidth).map(
            val => pad(valuePad, val.toString(16), '0'));
        resp = resp.slice(lineWidth + 1);
        console.log(pad(4, (rowNo * lineWidth).toString(16), '0') + ': '
            + row.join(' '));
        ++rowNo;
    }
}

function mbContinueWrite(fn, addr, n, cb)
{
    try {
        fn(slaveAddr, addr, n, (err, data) => {
            if (err)
                console.error(err.message);
            else
                printContinueData(data.data, addr);
            cb(null);
        });
    } catch (err) {
        /* it does not use cb to pass error :( */
        console.error(err);
        cb(null);
    }
}

function processCommands(rl, conn)
{
    const jobQueue = [];

    function handleJob(job, cb)
    {
        const handler = commandHandlers[job.cmd];
        if (! handler) {
            console.error('unrecognized command ' + job.cmd);
            cb(null);
        } else
            handler(...job.args, cb);
    }

    function handleJobQueue()
    {
        if (! jobQueue.length) return;
        handleJob(jobQueue[0], (err) => {
            if (err) {
                console.log(err.message);
                conn.close();
                process.exit(2);
            } else {
                jobQueue.shift();
                if (rl.terminal) rl.prompt();
                handleJobQueue();
            }
        });
    }

    if (rl.terminal) rl.prompt();
    rl.on('line', line => {
        line = line.replace(/#.*$/, '').trim();
        if (! line.length) return;
        const tokens = line.split(/\s+/);
        const cmd = tokens[0];
        const args = tokens.slice(1);
        jobQueue.push({
            cmd: tokens[0],
            args: tokens.slice(1),
        });
        if (jobQueue.length == 1)
            handleJobQueue();
    });
    rl.on('close', () => {
        conn.close();
    });
}

var argv = require('yargs')
    .option('server', {
        describe: 'server IP address',
        nargs: 1,
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
    .option('baud', {
        describe: 'serial baudrate',
        nargs: 1,
        default: 115200,
        alias: 'b',
    })
    .option('slave-addr', {
        describe: 'modbus slave address',
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

if (! argv.server && ! argv.dev) {
    console.error('need to select tcp or serial');
    process.exit(1);
}
if (argv.server && argv.dev) {
    console.error('can only specify either tcp or serial mode');
    process.exit(1);
}

slaveAddr = argv.u;

makeConnection((err, conn, connStr) => {
    if (err) return console.error(err.message);
    console.log('connected to ' + connStr);

    var rl;
    if (argv.f)
        rl = readline.createInterface({
            input: fs.createReadStream(argv.f),
        });
    else if (process.stdin.isTTY)
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> ',
        });
    else
        rl = readline.createInterface({
            input: process.stdin,
            terminal: false,
        });
    processCommands(rl, conn);
});
