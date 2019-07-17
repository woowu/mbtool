const ieee754 = require('ieee754');

function reg2ieee_b(reg1, reg2)
{
    return [
        parseInt(reg1 / 256),
        reg1 % 256,
        parseInt(reg2 / 256),
        reg2 % 256,
    ];
}

function reg2ieee_bb(reg1, reg2)
{
    return [
        reg1 % 256,
        parseInt(reg1 / 256),
        reg2 % 256,
        parseInt(reg2 / 256),
    ];
}

function reg2ieee_l(reg1, reg2)
{
    return [
        reg2 % 256,
        parseInt(reg2 / 256),
        reg1 % 256,
        parseInt(reg1 / 256),
    ];
}

function reg2ieee_lb(reg1, reg2)
{
    return [
        parseInt(reg2 / 256),
        reg2 % 256,
        parseInt(reg1 / 256),
        reg1 % 256,
    ];
}

function ieee2reg_b(buf)
{
    return [
        buf[0] * 256 + buf[1],
        buf[2] * 256 + buf[3],
    ];
}

function ieee2reg_bb(buf)
{
    return [
        buf[1] * 256 + buf[0],
        buf[3] * 256 + buf[2],
    ];
}

function ieee2reg_l(buf)
{
    return [
        buf[3] * 256 + buf[2],
        buf[1] * 256 + buf[0],
    ];
}

function ieee2reg_lb(buf)
{
    return [
        buf[2] * 256 + buf[3],
        buf[0] * 256 + buf[1],
    ];
}

const reg2ieeeTable = {
    'b': reg2ieee_b,
    'bb': reg2ieee_bb,
    'l': reg2ieee_l,
    'lb': reg2ieee_lb,
};

const ieee2regTable = {
    'b': ieee2reg_b,
    'bb': ieee2reg_bb,
    'l': ieee2reg_l,
    'lb': ieee2reg_lb,
};

function reg2ieee(registers, fmt)
{
    var floats = [];

    for (var i = 0; i + 2 <= registers.length; i += 2) {
        floats.push(ieee754.read(reg2ieeeTable[fmt](registers[i], registers[i+1])
            , 0, false, 23, 4));
    }
    return floats;
}

function ieee2reg(float, fmt)
{
    var buf = Buffer.alloc(4);
    ieee754.write(buf, float, 0, false, 23, 4);
    return ieee2regTable[fmt](buf);
}

module.exports = {
    reg2ieee,
    ieee2reg,
};
