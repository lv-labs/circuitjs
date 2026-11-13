#!/usr/bin/env python3
"""Verify the compiled engine in headless Chrome, optionally against a baseline site."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=Path('build/engine-site'))
    parser.add_argument('--baseline', type=Path, help='Unchanged makeSite output copied before edits')
    parser.add_argument('--chrome', default=shutil.which('google-chrome') or shutil.which('chromium') or
                        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    parser.add_argument('--capture', action='store_true', help='Capture live reference traces; requires --baseline')
    parser.add_argument('--output', type=Path, help='Optional JSON result file')
    args = parser.parse_args()
    if not (args.site / 'circuitjsengine/circuitjsengine.nocache.js').is_file():
        parser.error('Build the engine first: ./gradlew makeEngineSite --console plain')
    if args.capture and not args.baseline:
        parser.error('--capture requires --baseline')
    if args.baseline and not (args.baseline / 'index.html').is_file():
        parser.error('--baseline must contain the unchanged site index.html')

    # Route the reference app from a separate, unchanged directory.
    class Handler(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path):
            original = self.directory
            try:
                if args.baseline and path.startswith('/baseline/'):
                    self.directory = str(args.baseline.resolve())
                    path = path[len('/baseline'):]
                return super().translate_path(path)
            finally:
                self.directory = original

        def log_message(self, *_):
            pass

    with http.server.ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(Handler, directory=str(args.site.resolve()))) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory(prefix='circuitjs-chrome-') as profile:
                url = f'http://127.0.0.1:{server.server_port}/verify.html'
                if args.baseline:
                    url += '?baseline=1' + ('&capture=1' if args.capture else '')
                result = subprocess.run(['node', str(Path(__file__).with_name('run_engine_browser.mjs')),
                    args.chrome, profile, url],
                    capture_output=True, text=True, timeout=90)
        finally:
            server.shutdown()
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        report = None
    if report is None or result.returncode:
        raise SystemExit(f'Browser verification did not finish.\n{result.stderr[-3000:]}\n{result.stdout[-3000:]}')
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items()
                      if key not in ('traces', 'referenceTraces')}, indent=2))
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
