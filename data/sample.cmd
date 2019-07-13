echo read holding registers 1 to 50
fc3 1 50
echo read holding registers 51 to 100
fc3 51 50
echo write holding register 18 to 22 with value 0x5a5a
fc16 18 0x5a5a 0x5a5a 0x5a5a 0x5a5a 0x5a5a
echo write holding register 23 with value 0xbeef
fc6 23 0xbeef
echo read holding registers 18 to 23
fc3 18 6
echo read holding registers 1 to 50 again
fc3 1 50
