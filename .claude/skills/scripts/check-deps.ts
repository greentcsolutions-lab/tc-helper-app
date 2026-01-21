import fs from 'fs';
import { execSync } from 'child_process';

console.log('=== Dependency Analysis (real-time) ===\n');

try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  console.log('Project name:', pkg.name || '(unknown)');
  console.log('Dependencies:', Object.entries(pkg.dependencies || {}).map(([k, v]) => `${k}@${v}`).join(', '));
  console.log('Dev Dependencies:', Object.entries(pkg.devDependencies || {}).map(([k, v]) => `${k}@${v}`).join(', '));

  console.log('\nOutdated packages:');
  try {
    const outdated = JSON.parse(execSync('npm outdated --json', { encoding: 'utf-8' }));
    console.log(JSON.stringify(outdated, null, 2));
  } catch (e) {
    console.log('(npm outdated failed — maybe run npm install first?)');
  }

  console.log('\nVulnerabilities (npm audit):');
  try {
    const audit = JSON.parse(execSync('npm audit --json', { encoding: 'utf-8' }));
    console.log('Total vulns:', audit.metadata?.vulnerabilities?.total || 0);
    if (audit.metadata?.vulnerabilities?.high > 0) {
      console.log('HIGH severity issues found!');
    }
  } catch (e) {
    console.log('(npm audit failed)');
  }

  console.log('\nTop-level tree (npm ls --depth=0):');
  try {
    console.log(execSync('npm ls --depth=0 --json', { encoding: 'utf-8' }));
  } catch (e) {
    console.log('(npm ls failed)');
  }

} catch (err) {
  console.error('Error during analysis:', err.message);
}