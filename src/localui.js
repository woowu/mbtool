'use strict';
const fs = require('fs');
const extend = require('extend');
const events = require('events');
const readline = require('readline');
const commjob = require('./commjob');

const ctrl_d = 4;

function localui(inputFile)
{
    const ee = new events.EventEmitter();
    var rl;
    var ui;

    function run()
    {
        if (rl.terminal) rl.prompt();
        rl.on('line', line => {
            line = line.replace(/#.*$/, '').trim();
            if (! line.length) return;
            const tokens = line.split(/\s+/);
            const cmd = tokens[0];
            const args = tokens.slice(1);
            ee.emit('command', cmd, args);
        });
        rl.on('close', () => {
            ee.emit('command', '_eof');
        });
    }

    if (inputFile)
        rl = readline.createInterface({
            input: fs.createReadStream(inputFile),
        });
    else if (process.stdin.isTTY) {
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
        info: function(message) {
            console.log(message);
        },
        error: function(error) {
            console.error(error);
        },
        prompt: function() {
            if (process.stdin.isTTY) rl.prompt();
        },
        response: function(line) {
            console.log(line);
        }, 
        printFrame: function(frame) {
        },
    });

    run();
    return ui;
}

module.exports = localui;
