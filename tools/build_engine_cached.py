#!/usr/bin/env python3
"""Offline fallback: compile using read-only cached GWT jars, without Gradle locks.

Normal builds should use makeEngineSite. This fallback requires an already populated
Gradle dependency cache; it neither downloads nor updates dependencies.
"""
import argparse
import os
import re
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home', type=Path, default=os.environ.get('JAVA_HOME'))
    parser.add_argument('--cache', type=Path, default=Path.home() / '.gradle/caches/modules-2/files-2.1')
    args = parser.parse_args()
    java_home = args.java_home
    if not java_home and Path('/usr/libexec/java_home').exists():
        java_home = Path(subprocess.check_output(['/usr/libexec/java_home', '-v', '1.8'], text=True).strip())
    if not java_home:
        parser.error('Set JAVA_HOME or pass --java-home for a Java 8 JDK')
    jars = sorted(args.cache.glob('*/*/*/*/*.jar'))
    if not all(any(p.name == name for p in jars) for name in ['gwt-dev-2.8.2.jar', 'gwt-user-2.8.2.jar']):
        parser.error('Cached GWT 2.8.2 dependencies are required')
    classes = ROOT / 'build/cached-engine-classes'
    classes.mkdir(parents=True, exist_ok=True)
    classpath = os.pathsep.join(map(str, jars))
    sources = sorted((ROOT / 'src').rglob('*.java'))
    subprocess.run([str(java_home / 'bin/javac'), '-source', '8', '-target', '8', '-encoding', 'UTF-8',
                    '-cp', classpath, '-d', str(classes), *map(str, sources)], cwd=ROOT, check=True)
    classpath = os.pathsep.join([str(classes), str(ROOT / 'src'), classpath])
    for module, target in [('engine', 'engine'), ('worker', 'engine-worker')]:
        subprocess.run([str(java_home / 'bin/java'), '-Xmx1024m', '-Dgwt.persistentunitcache=false',
                        '-cp', classpath, 'com.google.gwt.dev.Compiler', '-war', str(ROOT / 'build' / target),
                        '-localWorkers', '2', '-sourceLevel', '1.8', '-style', 'PRETTY',
                        'com.lushprojects.circuitjs1.' + module], cwd=ROOT, check=True)
    site = ROOT / 'build/engine-site'
    # Reassemble from sources so retired editor assets cannot survive a rebuild.
    if site.exists():
        shutil.rmtree(site)
    for folder in ['build/engine', 'build/engine-worker', 'packages/circuit-runtime', 'tools/engine-harness']:
        shutil.copytree(ROOT / folder, site, dirs_exist_ok=True)
    shutil.copytree(ROOT / 'packages/circuit-core', site / 'core', dirs_exist_ok=True)
    modules = re.findall(r"^import './([^']+)';$", (ROOT / 'packages/circuit-core/index.mjs').read_text(), re.M)
    (site / 'core/browser.js').write_text('// Generated from packages/circuit-core; edit the source modules.\n' +
        '\n'.join('// ' + name + '\n' + (ROOT / 'packages/circuit-core' / name).read_text() for name in modules))
    shutil.copytree(ROOT / 'docs/new-simulator/examples', site / 'examples', dirs_exist_ok=True)
    print('Built editor-free engine, worker and frontend from cached dependencies.')


if __name__ == '__main__':
    main()
