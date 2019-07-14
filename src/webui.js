"use strict";
const extend = require('extend');
const events = require('events');
const express = require('express');
const socketio = require('socket.io');
require('ejs');

function webui()
{
    const ee = new events.EventEmitter();
    var app = express();
    var ui;
    var io;

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
            io.sockets.emit('log', log);
        },
    });

    run();
    return ui;
}

module.exports = webui;

