#!/usr/bin/env python3
"""Шифрование закрытых страниц сайта (pravila/, finansy/) и файлов к ним.

Формат совпадает с assets/lock.js: ключ = PBKDF2-SHA-256(пароль, соль 'ipoteka-secure-v1', 200 000 итераций, 32 байта),
шифр = AES-256-GCM, данные = 12 байт IV + шифртекст с тегом. В странице шифр лежит в <script id="payload"> в base64.

Пароль берётся из переменной окружения IPOTEKA_PASS или спрашивается. Открытые тексты держим в _private/ (в .gitignore).

  python3 tools/secure.py check                          – проверить пароль по хешу расстановки мебели
  python3 tools/secure.py decrypt-page finansy/index.html _private/finansy.html
  python3 tools/secure.py encrypt-page finansy/index.html _private/finansy.html
  python3 tools/secure.py encrypt-file in.webp pravila/scan/x.bin
  python3 tools/secure.py decrypt-file pravila/scan/x.bin out.webp
"""
import base64, getpass, hashlib, os, re, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SALT, IT = b'ipoteka-secure-v1', 200000
RASST_SALT = b'ipoteka-rasstanovka-v1'
RASST_HASH = 'd78644491c7af05d52f9b720d542bd5d175df86c757a01fdc78da1993264fe75'
PAYLOAD = re.compile(r'(<script type="application/octet-stream" id="payload">)(.*?)(</script>)', re.S)


def password():
    pw = os.environ.get('IPOTEKA_PASS') or getpass.getpass('Пароль: ')
    if hashlib.pbkdf2_hmac('sha256', pw.encode(), RASST_SALT, IT).hex() != RASST_HASH:
        sys.exit('Пароль не совпадает с паролем расстановки мебели')
    return pw


def key(pw):
    return hashlib.pbkdf2_hmac('sha256', pw.encode(), SALT, IT, 32)


def enc(k, data):
    iv = os.urandom(12)
    return iv + AESGCM(k).encrypt(iv, data, None)


def dec(k, blob):
    return AESGCM(k).decrypt(blob[:12], blob[12:], None)


def main(a):
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); return
    cmd = a[0]
    if cmd == 'check':
        password(); print('Пароль верный'); return
    k = key(password())
    if cmd == 'encrypt-page':
        page, src = a[1], a[2]
        html = open(page, encoding='utf-8').read()
        data = base64.b64encode(enc(k, open(src, 'rb').read())).decode()
        data = '\n'.join(data[i:i + 120] for i in range(0, len(data), 120))
        html, n = PAYLOAD.subn(lambda m: m.group(1) + '\n' + data + '\n' + m.group(3), html)
        if n != 1: sys.exit('В странице нет <script type="application/octet-stream" id="payload">')
        open(page, 'w', encoding='utf-8').write(html)
    elif cmd == 'decrypt-page':
        m = PAYLOAD.search(open(a[1], encoding='utf-8').read())
        open(a[2], 'wb').write(dec(k, base64.b64decode(re.sub(r'\s+', '', m.group(2)))))
    elif cmd == 'encrypt-file':
        open(a[2], 'wb').write(enc(k, open(a[1], 'rb').read()))
    elif cmd == 'decrypt-file':
        open(a[2], 'wb').write(dec(k, open(a[1], 'rb').read()))
    else:
        sys.exit('Неизвестная команда: ' + cmd)


if __name__ == '__main__':
    main(sys.argv[1:])
