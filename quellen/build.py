import os, sys
d = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(d, 'src')
tpl = open(os.path.join(src, 'template.html'), encoding='utf-8').read()
three = open(os.path.join(d, 'lib/package/build/three.min.js'), encoding='utf-8').read()
app = '\n'.join(open(os.path.join(src, f), encoding='utf-8').read() for f in ['core.js', 'stations.js', 'alltag.js'])
assert '</script' not in three and '</script' not in app
out = tpl.replace('/*__THREE__*/', three).replace('/*__APP__*/', app)
dst = sys.argv[1]
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'w', encoding='utf-8').write(out)
print('written', dst, len(out))
