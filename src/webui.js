"use strict";
const extend = require('extend');
const events = require('events');
const express = require('express');
const socketio = require('socket.io');
require('ejs');

const logHistSize = 10000;

function webui()
{
    const ee = new events.EventEmitter();
    var app = express();
    var ui;
    var io;
    const logHist = [];

    function run()
    {
        app.set('view engine', 'ejs');
        app.use(express.static('public'));
        app.get('/', (req, res) => {
            res.render('index');
        });

        const server = app.listen(3000);
        io = socketio(server);
        io.on('connection', socket => {
            logHist.forEach(log => {
                socket.emit('log', log);
            });
            socket.on('command', cmd => {
                /* TODO */
                ;
            });
        });
    }

    ui = extend(ee, {
        info: function(message) {
        },
        error: function(error) {
        },
        prompt: function() {
        },
        sendLog: function(log) {
            if (logHist.length == logHistSize) logHist.unshift();
            logHist.push(log);
            io.sockets.emit('log', log);
        },
    });

    run();
    return ui;
}

module.exports = webui;

