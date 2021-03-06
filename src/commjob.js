'use strict';
const events = require('events');
const extend = require('extend');
const pad = require('pad');
const {reg2ieee, ieee2reg} = require('./regfmt');

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

        /* read ieee floats from holding registers */
        fc3b: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC3.bind(conn), addr, n, 'b', cb);
        },
        fc3bb: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC3.bind(conn), addr, n, 'bb', cb);
        },
        fc3l: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC3.bind(conn), addr, n, 'l', cb);
        },
        fc3lb: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC3.bind(conn), addr, n, 'lb', cb);
        },
        fc4b: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC4.bind(conn), addr, n, 'b', cb);
        },
        fc4bb: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC4.bind(conn), addr, n, 'bb', cb);
        },
        fc4l: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC4.bind(conn), addr, n, 'l', cb);
        },
        fc4lb: function(cb, addr, n) {
            readFormatedFloats(conn.writeFC4.bind(conn), addr, n, 'lb', cb);
        },
        fc16b: function(cb, addr, value) {
            writeFormatedFloat(conn.writeFC16.bind(conn), addr, value, 'b', cb);
        },
        fc16bb: function(cb, addr, value) {
            writeFormatedFloat(conn.writeFC16.bind(conn), addr, value, 'bb', cb);
        },
        fc16l: function(cb, addr, value) {
            writeFormatedFloat(conn.writeFC16.bind(conn), addr, value, 'l', cb);
        },
        fc16lb: function(cb, addr, value) {
            writeFormatedFloat(conn.writeFC16.bind(conn), addr, value, 'lb', cb);
        },
    };

    function readFormatedFloats(modbusFun, addr, n, fmt, cb)
    {
        const parameters = cmdConvertAddrAndCount(addr, n * 2);
        if (parameters instanceof Error) {
            ee.emit('error', parameters.message);
            cb(null);
        } else
            modbusRead2(modbusFun, (err, data) => {
                if (err)
                    ee.emit('error', err.message);
                else
                    emitValueArray(ee, reg2ieee(data.data, fmt));
                cb(null);
            }, ...parameters);
    }

    function writeFormatedFloat(modbusFun, addr, value, fmt, cb)
    {
        const parameters = cmdConvertAddrAndRegValues(addr, ieee2reg(value, fmt));
        if (parameters instanceof Error) {
            ee.emit('error', parameters.message);
            cb(null);
        } else
            modbusWrite(modbusFun, cb, ...parameters);
    }

    function emitValueArray(ee, values)
    {
        ee.emit('response', values.reduce((v, index) => {
            return index == 0 ? v.toString() : (' ' + v.toString());
        }));
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
                    cb(null, data);
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
