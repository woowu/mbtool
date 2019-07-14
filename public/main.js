$(function() {
    var socket = io.connect('http://localhost:3000');

    var command = $('#command');
    var sendBtn = $('#sendBtn');
    var logwin = $('#logwin');

    sendBtn.click( () => {
        socket.emit('command', {command : command.val()});
    });

    socket.on('log', log => {
        logwin.append('<p class="logline">' + log.timestamp + ' '
            + log.message + '</p>')
    });
});
