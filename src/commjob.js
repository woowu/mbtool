'use strict';
const events = require('events');
const extend = require('extend');
const pad = require('pad');
const ieee754 = require('ieee754');

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
    const ee = new events.EventEmitter();
    const jobQueue = [];
    var stopped = false;
    var queueTimer;

    const commandVector = {
        exit: function _eof(cb) {
            return cb(null, true);
        },
        echo: function(cb, ...args) {
            if (args) ee.emit('info', args.join(' '));
            return cb(null);
        },
        delay: function(cb, msecs) {
            msecs = parseInt(msecs);
            if (typeof msecs != 'number' || msecs < 0) {
                ee.emit('error', 'bad delay time');
                cb(null);
            } else
                setTimeout(cb, msecs);
        },
        fc1: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC1.bind(conn), cb, ...parameters);
        },
        fc2: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC2.bind(conn), cb, ...parameters);
        },
        fc3: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC3.bind(conn), cb, ...parameters);
        },
        fc4: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr, n);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead(conn.writeFC4.bind(conn), cb, ...parameters);
        },
        fc5: function(cb, addr, value) {
            const parameters = cmdConvertAddrAndBool(addr, value);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC5.bind(conn), cb, ...parameters);
        },
        fc6: function(cb, addr, value) {
            const parameters = cmdConvertAddrAndRegValue(addr, value);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC6.bind(conn), cb, ...parameters);
        },
        fc15: function(cb, addr, ...values) {
            const parameters = cmdConvertAddrAndBoolValues(addr, values);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC15.bind(conn), cb, ...parameters);
        },
        fc16: function(cb, addr, ...values) {
            const parameters = cmdConvertAddrAndRegValues(addr, values);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusWrite(conn.writeFC16.bind(conn), cb, ...parameters);
        },

        /* wrapper functions */

        /* read single precision floats from holding registers */
        fc3sf: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr * 2, n * 2);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead2(conn.writeFC3.bind(conn), data => {
                    printFloatFromRegisterValues(data.data, 'single');
                    cb(null);
                }, ...parameters);
        },
        fc3df: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr * 4, n * 4);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead2(conn.writeFC3.bind(conn), data => {
                    printFloatFromRegisterValues(data.data, 'double');
                    cb(null);
                }, ...parameters);
        },
        fc4sf: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr * 2, n * 2);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead2(conn.writeFC4.bind(conn), data => {
                    printFloatFromRegisterValues(data.data, 'single');
                    cb(null);
                }, ...parameters);
        },
        fc4df: function(cb, addr, n) {
            const parameters = cmdConvertAddrAndCount(addr * 4, n * 4);
            if (parameters instanceof Error) {
                ee.emit('error', parameters.message);
                cb(null);
            } else
                modbusRead2(conn.writeFC4.bind(conn), data => {
                    printFloatFromRegisterValues(data.data, 'double');
                    cb(null);
                }, ...parameters);
        },
    };

    function printFloatFromRegisterValues(regValues, format)
    {
        const bytesPerNum = format == 'single' ? 2 : 4;
        var line = '';

        for (var i = 0; i < regValues.length; i += bytesPerNum) {
            var bytes = [];
            for (var j = 0; j < bytesPerNum; ++j) {
                bytes.push(parseInt(regValues[j] / 256));
                bytes.push(regValues[i] % 256);
            }
            if (format == 'single')
                line += ieee754.read(bytes, 0, false, 23, 4).toString() + ' ';
            else
                line += ieee754.read(bytes, 0, false, 52, 8).toString() + ' ';
        }
        ee.emit('response', line.trim());
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
            var line = '';
            data = data.slice(valuesPerLine);
            line += pad(hexCharsOfWord, offset.toString(base), '0') + ': ';
            if (isCoil) {
                row = row.join('');
                while (row.length) {
                    line += ' ' + row.slice(0, coilsPerGroup);
                    row = row.slice(coilsPerGroup);
                }
                ee.emit('response', line);
            } else
                ee.emit('response', line + row.join(' '));
            offset += valuesPerLine;
        }
    }

    function modbusRead(fn, cb, addr, n)
    {
        try {
            fn(conn.slaveAddr, addr, n, (err, data) => {
                if (err)
                    ee.emit('error', err.message);
                else
                    printMemoryBlock(data.data.slice(0, n), addr);
                cb(null);
            });
        } catch (err) {
            /* it does not use cb to pass error :( */
            ee.emit('error', err);
            cb(null);
        }
    }

    function modbusRead2(fn, cb, addr, n)
    {
        try {
            fn(conn.slaveAddr, addr, n, (err, data) => {
                if (err) {
                    ee.emit('error', err.message);
                    cb(new Error('read failed'));
                } else
                    cb(data);
            });
        } catch (err) {
            /* it does not use cb to pass error :( */
            ee.emit('error', err);
            cb(new Error('read failed'));
        }
    }

    function modbusWrite(fn, cb, addr, value)
    {
        try {
            fn(conn.slaveAddr, addr, value, (err) => {
                if (err)
                    ee.emit('error', err.message);
                cb(null);
            });
        } catch (err) {
            /* it does not use cb to pass error :( */
            ee.emit('error', err);
            cb(null);
        }
    }

    function handleJob(job, cb)
    {
        const handler = commandVector[job.cmd];
        if (! handler) {
            ee.emit('error', 'unrecognized command ' + job.cmd);
            return cb(null);
        }
        if (job.args)
            handler(cb, ...job.args);
        else
            handler(cb);
    }

    function handleJobQueue()
    {
        if (! jobQueue.length) return;
        const head = jobQueue[0];
        handleJob(head, (err, stop) => {
            if (err) {
                head.ee.emit('error', err.message);
                ee.emit('end', err);
            } else {
                jobQueue.shift();
                stopped = stop;
                if (! stop) {
                    restartTimer();
                    ee.emit('after-job');
                    handleJobQueue();
                } else
                    ee.emit('end', null);
            }
        });
    }

    function restartTimer()
    {
        if (queueTimer) {
            clearTimeout(queueTimer);
            queueTimer = null;
        }
        queueTimer = setTimeout(() => {
            ee.emit('queue-empty');
        }, 500);
    }

    return extend(ee, {
        pushCmd: function(cmd, args) {
            if (stopped) return;
            restartTimer();
            jobQueue.push({cmd, args});
            if (jobQueue.length == 1) handleJobQueue();
        },
    });
}

module.exports = commJob;
