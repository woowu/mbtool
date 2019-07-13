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
    fc1: function(cb, addr, n) {
        modbusRead(client.writeFC1.bind(client), cb, addr, n);
    },
    fc2: function(cb, addr, n) {
        modbusRead(client.writeFC2.bind(client), cb, addr, n);
    },
    fc3: function(cb, addr, n) {
        modbusRead(client.writeFC3.bind(client), cb, addr, n);
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

function printMemoryBlock(data, startAddr)
{
    const base = 16;
    const coilsPerGroup = 8;
    const hexCharsOfWord = 4;
    const isCoil = typeof data[0] == 'boolean';
    const valuesPerLine = isCoil ? 64 : 16;

    var offset = parseInt(startAddr / valuesPerLine) * valuesPerLine;
    const paddingNum = startAddr - offset; 
    data = Array(paddingNum).fill(0).concat(data);

    data = data.map((d, i) => {
        if (i < paddingNum)
            return isCoil ? ' ' : Array(hexCharsOfWord).fill(' ').join('');
        else
            return isCoil ? (d ? '1' : '0')
                : pad(hexCharsOfWord, d.toString(base), '0');
    });

    while (data.length > 0) {
        var row = data.slice(0, valuesPerLine);
        data = data.slice(valuesPerLine);
        process.stdout.write(pad(hexCharsOfWord, offset.toString(base), '0')
            + ':');
        if (isCoil) {
            row = row.join('');
            while (row.length) {
                process.stdout.write(' ' + row.slice(0, coilsPerGroup));
                row = row.slice(coilsPerGroup);
            }
            process.stdout.write('\n');
        } else
            process.stdout.write(' ' + row.join(' ') + '\n');
        offset += valuesPerLine;
    }
}

function modbusRead(fn, cb, addr, n)
{
    addr = parseInt(addr);
    n = parseInt(n);
    if (typeof addr != 'number' || typeof n != 'number') {
        console.log('incorrect number of parameters');
        return cb(null);
    }

    try {
        fn(slaveAddr, addr, n, (err, data) => {
            if (err)
                console.error(err.message);
            else
                printMemoryBlock(data.data.slice(0, n), addr);
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
            handler(cb, ...job.args);
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
