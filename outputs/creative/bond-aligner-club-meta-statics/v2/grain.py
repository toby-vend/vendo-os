import zlib, struct, random
def write_png(p,w,h,rows):
    raw=b''.join(b'\x00'+bytes(r) for r in rows)
    def ch(t,c): return struct.pack('>I',len(c))+t+c+struct.pack('>I',zlib.crc32(t+c)&0xffffffff)
    open(p,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(raw,9))+ch(b'IEND',b''))
random.seed(7); N=320
for name,val in (('grain-light.png',255),('grain-dark.png',0)):
    rows=[]
    for y in range(N):
        r=bytearray()
        for x in range(N):
            a=int(max(0,min(255,random.gauss(0,1)*70+10))) if random.random()<0.55 else 0
            r+=bytes((val,val,val,a))
        rows.append(r)
    write_png('uploads/'+name,N,N,rows)
