const ieee754 = require('ieee754');

function reg2ieee(registers, fmt)
{
    var bytes, ordered;
    var floats = [];

    for (var i = 0; i + 2 <= registers.length; i += 2) {
        bytes = [
            parseInt(registers[i] / 256),
            registers[i] % 256,
            parseInt(registers[i + 1] / 256),
            registers[i + 1] % 256,
        ];
        floats.push(ieee754.read(bytes, 0, false, 23, 4));
    }
    return floats;
}

function ieee2reg(float, fmt)
{
    var buf = Buffer.alloc(4);
    ieee754.write(buf, float, 0, false, 23, 4);
    return [
        buf[0] * 256 + buf[1],
        buf[2] * 256 + buf[3],
    ];
}

module.exports = {
    reg2ieee,
    ieee2reg,
};
