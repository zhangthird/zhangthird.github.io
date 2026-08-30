// Preserve legacy asset URLs and the original feed without shipping old HTML shells.
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const folder of ['images','post-images']) {
  // Git does not retain empty directories after placeholder articles are removed.
  if (existsSync(join(root,folder))) await cp(join(root,folder),join(root,'dist',folder),{recursive:true});
}
await cp(join(root,'atom.xml'),join(root,'dist/atom.xml'));
await cp(join(root,'favicon.ico'),join(root,'dist/favicon.ico'));
await writeFile(join(root,'dist/.nojekyll'),'');
const aliases={'tags/index.html':'essays/index.html','friends/index.html':'about/index.html'};
for(const [alias,target] of Object.entries(aliases)){
  await mkdir(join(root,'dist',alias,'..'),{recursive:true});
  // The original route remains readable; canonical points to the current content.
  await writeFile(join(root,'dist',alias),await readFile(join(root,'dist',target)));
}
console.log('Legacy article URLs, aliases, images and Atom feed preserved.');
