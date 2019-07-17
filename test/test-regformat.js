const regfmt = require('../src/regfmt');
const expect = require('chai').expect;

var assert = require('assert');
describe('reg format', function() {
    describe('IEEE FB B', function() {
        it('should fullfil book case 1', function() {
            expect(regfmt.reg2ieee([0x42c8, 0x0000], 'b')[0]).to.be.closeTo(100, 0.01);
        });
        it('should fullfil book case 2', function() {
            expect(regfmt.reg2ieee([0x425d, 0x47ae], 'b')[0]).to.be.closeTo(55.32, 0.01);
        });
        it('should work for reverted book case 1', function() {
            expect(regfmt.ieee2reg(100.0, 'b')).to.eql([0x42c8, 0x0000]);
        });
    });
});
