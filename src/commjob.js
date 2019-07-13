'use strict';
const pad = require('pad');

function cmdConvertAddr(addr)
{
    addr = parseInt(addr);
    return typeof addr == 'number' && addr >= 0 ? addr : Error('bad address');
}

function cmdConvertBool(value)
{
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

function commJob(conn)
{
    const jobQueue = [];
    var stopped = false;

    const commandVector = {
        _eof: function _eof(ui, cb) {
            conn.close(cb);
            return cb(null, true);
        },
        echo: function(ui, cb, ...args) {
            if (args) ui.info(args.join(' '));
            return cb(null);
        },
        delay: function(ui, cb, msecs) {
            msecs = parseInt(msecs);
            if (typeof msecs != 'number' || msecs < 0) {
                ui.error('bad delay time');
                cb(null);
            } else
                setTimeout(cb, msecs);
        },
        fc1: function(ui, cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC1.bind(conn), cb, ...parameters);
        },
        fc2: function(ui, cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC2.bind(conn), cb, ...parameters);
        },
        fc3: function(ui, cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC3.bind(conn), cb, ...parameters);
        },
        fc4: function(ui, cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC4.bind(conn), cb, ...parameters);
        },
        fc5: function(ui, cb, addr, value) {
            const parameters = cmdConvertAddrAndBool(addr, value);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC5.bind(conn), cb, ...parameters);
        },
        fc6: function(ui, cb, addr, value) {
            const parameters = cmdConvertAddrAndRegValue(addr, value);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC6.bind(conn), cb, ...parameters);
        },
        fc15: function(ui, cb, addr, ...values) {
            const parameters = cmdConvertAddrAndBoolValues(addr, values);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC16.bind(conn), cb, ...parameters);
        },
        fc16: function(ui, cb, addr, ...values) {
            const parameters = cmdConvertAddrAndRegValues(addr, values);
            if (parameters instanceof Error) {
                ui.error(parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC16.bind(conn), cb, ...parameters);
        },
    };

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
            fn(conn.slaveAddr, addr, n, (err, data) => {
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
            fn(conn.slaveAddr, addr, value, (err) => {
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

    function handleJob(job, cb)
    {
        const handler = commandVector[job.cmd];
        if (! handler) {
            job.ui.error('unrecognized command ' + job.cmd);
            return cb(null);
        }
        if (job.args)
            handler(job.ui, cb, ...job.args);
        else
            handler(job.ui, cb);
    }

    function handleJobQueue()
    {
        if (! jobQueue.length) return;
        const head = jobQueue[0];
        handleJob(head, (err, stop) => {
            if (err) {
                head.ui.error(err.message);
                conn.close();
                process.exit(2);
            } else {
                jobQueue.shift();
                stopped = stop;
                if (! stop) {
                    head.ui.prompt();
                    handleJobQueue();
                }
            }
        });
    }

    return {
        pushCmd: function(ui, cmd, args) {
            if (stopped) return;
            jobQueue.push({ui, cmd, args});
            if (jobQueue.length == 1) handleJobQueue();
        },
    };
}

module.exports = commJob;
