'use strict';
const fs = require('fs');
const extend = require('extend');
const events = require('events');
const readline = require('readline');
const commjob = require('./commjob');

const ctrl_d = 4;

function localui(options, jobQueue)
{
    const ee = new events.EventEmitter();
    var rl;
    var ui;
    var started = false;
    var closed = false;

    function start()
    {
        started = true;
        if (rl.terminal) rl.prompt();
        jobQueue.on('after-job', () => {
            rl.prompt();
        });
        rl.on('line', line => {
            line = line.replace(/#.*$/, '').trim();
            if (! line.length) {
                rl.prompt();
                return;
            }
            const tokens = line.split(/\s+/);
            const cmd = tokens[0];
            const args = tokens.slice(1);
            ee.emit('command', cmd, args);
        });
        rl.on('close', () => {
            ee.emit('command', 'exit');
            closed = true;
        });
    }

    if (process.stdin.isTTY) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    } else
        rl = readline.createInterface({
            input: process.stdin,
            terminal: false,
        });

    ui = extend(ee, {
        start,
        close: function() {
            if (! closed) rl.close();
        },
    });

    jobQueue.on('info', message => {
        console.log(message);
    });
    jobQueue.on('error', message => {
        console.error(message);
    });
    jobQueue.on('response', data => {
        console.info(data);
    });

    if (! options.noAutoStart) start();
    return ui;
}

module.exports = localui;
