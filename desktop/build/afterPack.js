// Pone ícono y datos de versión en "Pulso CX.exe" sin necesitar Wine (resedit es JS puro).
const fs = require('fs');
const path = require('path');
module.exports = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit').then((m) => m.default || m);
  const pkg = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, `${pkg.productFilename}.exe`);
  const data = fs.readFileSync(exe);
  const res = ResEdit.NtExecutableResource.from(ResEdit.NtExecutable.from(data, { ignoreCert: true }));
  const ne = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const r = ResEdit.NtExecutableResource.from(ne);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const grupos = ResEdit.Resource.IconGroupEntry.fromEntries(r.entries);
  const id = grupos.length ? grupos[0].id : 1;
  const lang = grupos.length ? grupos[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(r.entries, id, lang, ico.icons.map((i) => i.data));
  const vers = ResEdit.Resource.VersionInfo.fromEntries(r.entries);
  const v = vers.length ? vers[0] : ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split('.').map(Number);
  v.setFileVersion(a, b, c, 0, 1033); v.setProductVersion(a, b, c, 0, 1033);
  v.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Pulso CX', FileDescription: 'Pulso CX - Armado de presentación de indicadores',
    CompanyName: 'Piero Marcelo Mavila Peña', LegalCopyright: '© 2026 Piero Marcelo Mavila Peña',
    OriginalFilename: 'Pulso CX.exe', InternalName: 'Pulso CX',
  });
  v.outputToResourceEntries(r.entries);
  r.outputResource(ne);
  fs.writeFileSync(exe, Buffer.from(ne.generate()));
  void res;
  console.log('  • ícono y versión aplicados a', path.basename(exe));
};
