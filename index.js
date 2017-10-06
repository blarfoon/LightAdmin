String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var days = Math.floor((sec_num / 3600) / 24)
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
    if (days > 0) hours = Math.floor((sec_num / 3600) % 24);
    if (days < 10) { days = "0" + days; }
    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    var time = days + ' d ' + hours + ' h ' + minutes + ' m ' + seconds + ' s ';
    return time;
}


var si = require('systeminformation');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var os = require('os');
const isAdmin = require('is-elevated');
const execa = require('execa');

isAdmin().then(elevated => {
    if (!elevated) {
        console.log('You must run the program as root/admin');
        process.exit(1)
    }
}).then(function () {

    app.get('/', function (req, res) {
        res.sendfile('index.html');
    });

    //Whenever someone connects this gets executed
    io.on('connection', function (socket) {
        console.log('A user connected');

        setInterval(function () {
            socket.emit('uptime', { value: (Math.floor(os.uptime()) + "").toHHMMSS() });
        }, 1000);

        si.graphics(function (data) {
            var gpu = "";
            try {
                gpu = data.controllers[0].model
            }
            catch (err) {
                gpu = 'None'
            }
            socket.emit('gpu', {
                value: gpu
            });
        });
        si.osInfo(function (data) {
            socket.emit('ostype', {
                value: data.distro
            });
        });
        si.cpu(function (data) {
            socket.emit('cpu', {
                value: data.manufacturer + " " + data.brand
            });
        });

        setInterval(function () {
            si.currentLoad(function (data) {
                socket.emit('cpuload', {
                    value: data.currentload.toFixed(1)
                });
            });
            si.mem(function (data) {
                socket.emit('ramusage', {
                    value: Math.floor(data.used / 1024 / 1024) + ' MB / ' + Math.floor(data.total / 1024 / 1024) + ' MB'
                });
            });
            si.fsSize(function (data) {
                socket.emit('maindiskusage', {
                    value: (data[0].used / 1024 / 1024 / 1024).toFixed(1) + ' GB / ' + (data[0].size / 1024 / 1024 / 1024).toFixed(1) + ' GB ( ' + ((data[0].size - data[0].used) / 1024 / 1024 / 1024).toFixed(1) + ' GB Free )'
                });
            });
            si.networkStats(function (data) {
                socket.emit('networkdown', {
                    value: (data.rx_sec / 1014 / 1024).toFixed(1) + ' MB/s (' + data.iface + ')'
                });
                socket.emit('networkup', {
                    value: (data.tx_sec / 1014 / 1024).toFixed(1) + ' MB/s (' + data.iface + ')'
                });
                socket.emit('networktotaldown', {
                    value: (data.rx / 1014 / 1024).toFixed(0) + ' MB (' + data.iface + ')'
                });
                socket.emit('networktotalup', {
                    value: (data.tx / 1014 / 1024).toFixed(0) + ' MB (' + data.iface + ')'
                });
            });
        }, 2500);

        socket.on('reboot', function (data) {
            if (os.platform() == 'win32') {
                execa.shell('shutdown -r').catch(error => {
                    console.log(error)
                })
            }
            else {
                execa.shell('reboot').catch(error => {
                    console.log(error)
                })
            }
        });
        socket.on('shutdown', function (data) {
            if (os.platform() == 'win32') {
                execa.shell('shutdown -s').catch(error => {
                    console.log(error)
                })
            }
            else {
                execa.shell('shutdown now').catch(error => {
                    console.log(error)
                })
            }
        });

        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });
    });


    http.listen(3000, function () {
        console.log('listening on *:3000');
    });
});