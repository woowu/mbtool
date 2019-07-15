const respseGapMinMSecs = 2000;

const clearResp = false;

$(function() {
    var socket = io.connect('http://localhost:3000');

    var command = $('#command');
    var sendBtn = $('#sendBtn');
    var logwin = $('#logwin');
    var respWin = $('#response');
    var history = [];
    var histCurr = 1;

    var nLogLines = 0;
    var lastRespTime = new Date();

    sendBtn.click( () => {
        socket.emit('command', {command : command.val()});
    });

    command.on('keydown', (e) => {
        if (e.key == 'ArrowUp' && histCurr - 1 >= 0
            && histCurr - 1 < history.length) {
            --histCurr;
            command.val(history[histCurr]);
        } else if (e.key == 'Enter') {
            const line = command.val().trim();
            command.val('');
            if (clearResp) respWin.html('');
            history.push(line);
            histCurr = history.length;
            socket.emit('command', {command : line});
        } else
            histCurr = history.length;
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
        if (clearResp && t - lastRespTime > respseGapMinMSecs)
            respWin.html('');
        lastRespTime = t;

        resp = resp.replace(/\s/g, '&nbsp;');
        resp.split('\n').forEach(line => {
            respWin.append('<div class="responseline"> <p>' + line + '</p> </dvi>');
            respWin.scrollTop(9999);
        });
    });

    for (var i = 0; i < 500; ++i)
        logwin.append('<div class="logitem">'
            + '&nbsp;' + '</div>'
            + '<div>' + '&nbsp;' 
            + '</div>');
    logwin.scrollTop(9999);
});
