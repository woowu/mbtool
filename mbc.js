#!/usr/bin/node --harmony
"use strict";
const fs = require('fs');
const readline = require('readline');
const pad = require('pad');
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

var slaveAddr;

const commandVector = {
    delay: function(msecs, cb) {
        msecs = parseInt(msecs);
        if (typeof msecs != 'number' || msecs < 0) {
            console.error('bad delay time');
            cb(null);
        } else
            setTimeout(cb, msecs);
    },
    fc1: function(cb, addr, n) {
        const parameters = cmdConvertAddrAndCount(addr, n);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusRead(client.writeFC1.bind(client), cb, ...parameters);
    },
    fc2: function(cb, addr, n) {
        const parameters = cmdConvertAddrAndCount(addr, n);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusRead(client.writeFC2.bind(client), cb, ...parameters);
    },
    fc3: function(cb, addr, n) {
        const parameters = cmdConvertAddrAndCount(addr, n);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusRead(client.writeFC3.bind(client), cb, ...parameters);
    },
    fc4: function(cb, addr, n) {
        const parameters = cmdConvertAddrAndCount(addr, n);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusRead(client.writeFC4.bind(client), cb, ...parameters);
    },
    fc5: function(cb, addr, value) {
        const parameters = cmdConvertAddrAndBool(addr, value);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusWrite(client.writeFC5.bind(client), cb, ...parameters);
    },
    fc6: function(cb, addr, value) {
        const parameters = cmdConvertAddrAndRegValue(addr, value);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusWrite(client.writeFC6.bind(client), cb, ...parameters);
    },
    fc15: function(cb, addr, ...values) {
        const parameters = cmdConvertAddrAndBoolValues(addr, values);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusWrite(client.writeFC16.bind(client), cb, ...parameters);
    },
    fc16: function(cb, addr, ...values) {
        const parameters = cmdConvertAddrAndRegValues(addr, values);
        if (parameters instanceof Error) {
            console.error(parameters.message);
            cb(null);
        } else
            modbusWrite(client.writeFC16.bind(client), cb, ...parameters);
    },
};

/* --- Parameters converting and checking --- */

function cmdConvertAddr(addr)
{
    addr = parseInt(addr);
    return typeof addr == 'number' && addr >= 0 ? addr : Error('bad address');
}

function cmdConvertBool(value)
{
    value = value.toLowerCase();
    if (value == 'true' || value == '1')
        value = true;
    else if (value == 'false' || value == '0')
        value = false;
    else
        return new Error('bad boolean value');
    return value;
}

function cmdConvertRegValue(value)
{
    value = parseInt(value);
    return typeof value == 'number' && value >= 0 && value <= 65535 ? value
        : Error('bad register value');
}

function cmdConvertRegValues(values)
{
    var error = false;

    if (! Array.isArray(values))
        return new Error('incorrect register values');
    values = values.map(v => {
        v = parseInt(v);
        if (typeof v != 'number') error = true;
        return v;
    });
    if (error) return new Error('incorrect register value');
    return values;
}

function cmdConvertBoolValues(values)
{
    var error = false;

    if (! Array.isArray(values))
        return new Error('incorrect bool values');
    values = values.map(v => {
        v = cmdConvertBool(v);
        if (v instanceof Error) error = true;
        return v;
    });
    if (error) return new Error('incorrect bool value');
    return values;
}

function cmdConvertCount(n)
{
    n = parseInt(n);
    return typeof n == 'number' && n > 0 ? n : Error('bad count value');
}

function cmdConvertAddrAndBool(addr, value)
{
    addr = cmdConvertAddr(addr);
    if (addr instanceof Error) return addr;

    value = cmdConvertBool(value);
    if (value instanceof Error) return value;
    return [addr, value];
}

function cmdConvertAddrAndRegValue(addr, value)
{
    addr = cmdConvertAddr(addr);
    if (addr instanceof Error) return addr;

    value = cmdConvertRegValue(value);
    if (value instanceof Error) return value;
    return [addr, value];
}

function cmdConvertAddrAndRegValues(addr, values)
{
    addr = cmdConvertAddr(addr);
    if (addr instanceof Error) return addr;

    values = cmdConvertRegValues(values);
    if (values instanceof Error) return values;
    return [addr, values];
}

function cmdConvertAddrAndBoolValues(addr, values)
{
    addr = cmdConvertAddr(addr);
    if (addr instanceof Error) return addr;

    values = cmdConvertBoolValues(values);
    if (values instanceof Error) return values;
    return [addr, values];
}

function cmdConvertAddrAndCount(addr, n)
{
    addr = cmdConvertAddr(addr);
    if (addr instanceof Error) return addr;

    n = cmdConvertCount(n);
    if (n instanceof Error) return n;
    return [addr, n];
}

/* -------------------------------------------------------------------------- */

function makeConnection(cb)
{
    if (argv.server) {
        client.setTimeout(3000);
        client.connectTCP(argv.server, { port: argv.port }, (err) => {
            cb(err, client, argv.server + ':' + argv.port);
        });
    } else {
        client.setTimeout(1000);
        client.connectRTUBuffered(argv.dev, { baudRate: argv.baudrate }, (err) => {;
            cb(err, client, argv.dev + '@' + argv.baud);
        });
    }
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

function modbusWrite(fn, cb, addr, value)
{
    try {
        fn(slaveAddr, addr, value, (err) => {
            if (err)
                console.error(err.message);
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
        if (job.cmd == 'EOF')
            return conn.close(cb);
        else if (job.cmd == 'echo') {
            console.log(...job.args);
            return cb(null);
        }

        const handler = commandVector[job.cmd];
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
        jobQueue.push({cmd: 'EOF'})
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

slaveAddr = argv.u;

makeConnection((err, conn, connStr) => {
    if (err) return console.error(err.message);
    console.log('connected to ' + connStr);

    var rl;
    if (argv.f) {
        rl = readline.createInterface({
            input: fs.createReadStream(argv.f),
        });
    } else if (process.stdin.isTTY)
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
