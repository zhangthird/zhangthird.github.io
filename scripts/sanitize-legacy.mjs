// One-time mechanical removal of obsolete credential-bearing comment code.
// Keeps all article text intact. Git history still requires credential revocation.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const paths=execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'ls-files','*.html'],{encoding:'utf8'}).trim().split('\n');
let count=0;
for(const path of paths){
  if(!path)continue;
  const original=readFileSync(path,'utf8');
  const cleaned=original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,block=>/clientSecret\s*:|new Gitalk\(/.test(block)?'<!-- Obsolete Gitalk credential configuration removed. -->':block);
  if(cleaned!==original){writeFileSync(path,cleaned);count++;}
}
console.log(`Removed obsolete credential-bearing comment blocks from ${count} historical HTML files. Article bodies unchanged.`);
