"use strict";
const extend = require('extend');
const events = require('events');
const express = require('express');
const socketio = require('socket.io');
require('ejs');

const logHistSize = 10000;

function webui(jobQueue, port)
{
    const ee = new events.EventEmitter();
    var app = express();
    var ui;
    var io;
    var server;
    const logHist = [];

    function start()
    {
        app.set('view engine', 'ejs');
        app.use(express.static('public'));
        app.get('/', (req, res) => {
            res.render('index');
        });

        server = app.listen(port);
        io = socketio(server);
        io.on('connection', socket => {
            logHist.forEach(log => {
                socket.emit('log', log);
            });
            socket.on('command', cmd => {
                var command = cmd.command;
                command = command.replace(/#.*$/, '').trim();
                if (! command.length) return;
                const tokens = command.split(/\s+/);
                const c = tokens[0];
                const args = tokens.slice(1);
                ee.emit('command', c, args);
            });
            socket.on('end', () => {
                socket.disconnect(0);
            });
        });

        jobQueue.on('response', data => {
            io.sockets.emit('response', data);
        });
    }

    ui = extend(ee, {
        sendLog: function(log) {
            if (logHist.length == logHistSize) logHist.unshift();
            logHist.push(log);
            if (io) io.sockets.emit('log', log);
        },
        close: function() {
            if (io) {
                io.close();
                io = null;
            }
            if (server) {
                server.close();
                server = null;
            }
        },
    });

    start();
    return ui;
}

module.exports = webui;

