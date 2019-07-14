const respseGapMinMSecs = 2000;

$(function() {
    var socket = io.connect('http://localhost:3000');

    var command = $('#command');
    var sendBtn = $('#sendBtn');
    var logwin = $('#logwin');
    var output = $('#output');

    var nLogLines = 0;
    var lastRespTime = new Date();

    sendBtn.click( () => {
        socket.emit('command', {command : command.val()});
    });

    command.on('keydown', (e) => {
        if (e.key == 'Enter') {
            socket.emit('command', {command : command.val()});
            command.val('');
            output.html('');
        }
    });

    socket.on('log', log => {
        if (log.message.search('parsed tcp port:') == 0) return;
        const cls = (nLogLines++ % 2) == 0 ? '"logitem even-line"'
            : '"logitem odd-line"';
        logwin.append('<div class="logitem">'
            + log.timestamp + '</div>'
            + '<div class=' + cls + '>' + log.message
            + '</div>');
        logwin.scrollTop(9999);
    });
    socket.on('response', resp => {
        const t = new Date();
        if (t - lastRespTime > respseGapMinMSecs)
            output.html('');
        lastRespTime = t;

        resp = resp.replace(/\s/g, '&nbsp;');
        console.log(resp);
        resp.split('\n').forEach(line => {
            output.append('<div class="outputLine"> <p>' + line + '</p> </dvi>');
            output.scrollTop(9999);
        });
    });
});
