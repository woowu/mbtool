#!/usr/bin/node --harmony
"use strict";
const ModbusRTU = require("modbus-serial");

const nInputRegisters = 2000;
const nHoldingRegisters = 2000;
const bitsOfRegister = 16;
const regMaxValue = 65535;
const nRegValues = 2 ** bitsOfRegister;

const deviceMemory = {
    inputRegisters: [],
    holdingRegisters: [],
};

const vector = {
    getInputRegister: (addr) => {
        return deviceMemory.inputRegisters[addr];
    },
    getDiscreteInput: (addr) => {
        const reg = deviceMemory.inputRegisters[parseInt(addr / bitsOfRegister)];
        const mask = 1 << (addr % bitsOfRegister);
        return (reg & mask) != 0;
    },
    getHoldingRegister: (addr) => {
        return deviceMemory.holdingRegisters[addr];
    },
    getMultipleInputRegisters: (startAddr, length) => {
        var values = [];
        for (var i = 0; i < length; i++)
            values[i] = deviceMemory.inputRegisters[startAddr + i];
        return values;
    },
    getMultipleHoldingRegisters: (startAddr, length) => {
        var values = [];
        for (var i = 0; i < length; i++)
            values[i] = deviceMemory.holdingRegisters[startAddr + i];
        return values;
    },
    getCoil: (addr) => {
        const reg = deviceMemory.holdingRegisters[parseInt(addr / bitsOfRegister)];
        const mask = 1 << (addr % bitsOfRegister);
        return (reg & mask) != 0;
    },
    setRegister: (addr, value) => {
        console.log("set register", addr, value);
        deviceMemory.holdingRegisters[addr] = value;
        return;
    },
    setCoil: function(addr, value) {
        console.log("set coil", addr, value);
        const mask1 = 1 << (addr % bitsOfRegister);
        const mask0 = (~ mask1) & regMaxValue;
        var reg = deviceMemory.holdingRegisters[parseInt(addr / bitsOfRegister)];
        if (value == 0)
            reg &= mask0;
        else
            reg |= mask1;
        deviceMemory.holdingRegisters[parseInt(addr / bitsOfRegister)] = reg;
        return;
    },
    readDeviceIdentification: function(addr) {
        return {
            0x00: "Holywell",
            0x01: "UDC",
            0x02: "1.2.3",
            0x05: "1000",
            0x97: "ExtendedObject1",
            0xAB: "ExtendedObject2"
        };
    }
};

function initDeviceMemory()
{
    for (var i = 0; i < nInputRegisters; ++i)
        deviceMemory.inputRegisters.push(parseInt(Math.random() * nRegValues));
    for (var i = 0; i < nHoldingRegisters; ++i)
        deviceMemory.holdingRegisters.push(parseInt(Math.random() * nRegValues));
}

initDeviceMemory();

console.log("ModbusTCP listening on modbus://0.0.0.0:502");
const serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: 502, debug: true, unitID: 1 });

serverTCP.on("initialized", function() {
    console.log("initialized");
});

serverTCP.on("socketError", function(err) {
    console.error(err);
    serverTCP.close(() => {
        console.log("server closed");
    });
});
