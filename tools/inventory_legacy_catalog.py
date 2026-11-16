#!/usr/bin/env python3
"""Generate a source inventory, not a runtime compatibility certification."""
import collections
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'src/com/lushprojects/circuitjs1/client'
PUBLIC = CLIENT.parent / 'public'
OUT = ROOT / 'docs/new-simulator'


def main():
    menu_text = (CLIENT / 'Menus.java').read_text()
    menu_classes = sorted(set(re.findall(r'"(\w+Elm)"', menu_text)))
    classes = {}
    for path in sorted(CLIENT.glob('*Elm.java')):
        source = re.sub(r'/\*.*?\*/|//[^\n]*', '', path.read_text(), flags=re.S)
        match = re.search(r'class\s+(\w+)\s+extends\s+(\w+)', source)
        if not match:
            continue
        dump = re.search(r'int\s+getDumpType\s*\(\s*\)\s*\{\s*return\s+(\d+|\x27.\x27)\s*;', source)
        token = dump[1].strip("'") if dump else None
        classes[match[1]] = {'parent': match[2], 'ownDumpType': token,
                             'menuEntry': match[1] in menu_classes,
                             'source': str(path.relative_to(ROOT))}

    def dump_type(name, seen=None):
        seen = set() if seen is None else seen
        if name not in classes or name in seen:
            return None
        seen.add(name)
        return classes[name]['ownDumpType'] or dump_type(classes[name]['parent'], seen)

    for name, item in classes.items():
        item['dumpType'] = dump_type(name)
    type_classes = collections.defaultdict(list)
    for name, item in classes.items():
        if item['dumpType']:
            type_classes[item['dumpType']].append(name)

    entries, categories = [], []
    for line in (PUBLIC / 'setuplist.txt').read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('+'):
            categories.append(line[1:])
        elif line.startswith('-'):
            if categories:
                categories.pop()
        else:
            filename, _, title = line.lstrip('>').partition(' ')
            entries.append({'file': filename, 'title': title, 'categories': list(categories)})
    by_file = collections.defaultdict(list)
    for entry in entries:
        by_file[entry['file']].append(entry)
    examples, usage = [], collections.Counter()
    # Catalog record types are not an import whitelist or support for every variant.
    adapter = (ROOT / 'experiments/engine/document-adapter.js').read_text()
    catalog = adapter.split('const catalog = new Map([', 1)[1].split(']);', 1)[0]
    editor_types = set(re.findall(r"type:\s*'([^']+)'", catalog)) | {'w'}
    model_count = len(re.findall(r"\['[^']+',\s*\{pins:", catalog))
    for path in sorted((PUBLIC / 'circuits').rglob('*.txt')):
        records = collections.Counter(line.split()[0] for line in path.read_text(errors='replace').splitlines()
                                      if line.strip() and not line.lstrip().startswith('#'))
        types = sorted(t for t in records if t in type_classes)
        for t in types:
            usage[t] += 1
        filename = str(path.relative_to(PUBLIC / 'circuits'))
        examples.append({'file': filename, 'menuEntries': by_file[filename], 'recordCounts': dict(sorted(records.items())),
                         'elementTypes': types, 'missingEditorTypes': sorted(set(types) - editor_types),
                         'otherRecordTypes': sorted(set(records) - set(type_classes)),
                         'importStatus': 'not implemented'})
    files = {e['file'] for e in examples}
    missing = sorted(set(by_file) - files)
    data = {'scope': 'Bundled fork source; no claim of current upstream parity or runtime support.',
            'classes': classes, 'menuClasses': menu_classes, 'menuEntries': entries,
            'missingMenuFiles': missing, 'examples': examples}
    (OUT / 'LEGACY-CATALOG.json').write_text(json.dumps(data, indent=2) + '\n')
    lines = ['# Bundled Falstad catalog inventory', '',
             'Generated with `python3 tools/inventory_legacy_catalog.py`. This is a static source inventory,',
             'not a runtime compatibility result. Full parity targets the bundled fork first;',
             'matching newer upstream releases requires a separate upstream comparison.', '',
             f'- {len(menu_classes)} distinct element class names referenced by the legacy menu.',
             f'- {len(classes)} element subclasses found in source (includes base classes and aliases).',
             f'- {len(type_classes)} statically resolved serialized element types.',
             f'- {len(examples)} bundled circuit text files; {len(entries)} menu entries.',
             f'- {len(missing)} menu files missing from the bundled circuit directory.', '',
             f'The new editor has {model_count} component models plus wires. No legacy text importer exists yet.',
             'Even examples whose record types have editor equivalents need parameter, flags, geometry,',
             'junction, model-definition and scope conversion. Type coverage alone is not loadability.',
             'Aliases sharing a dump type may use different flags and parameters. Records not resolved',
             'to element classes are retained verbatim in the inventory for separate classification.', '',
             '## Component types by example usage', '',
             '| Record type | Bundled examples using it | Source classes / variants | New editor equivalent |',
             '| --- | ---: | --- | --- |']
    for t in sorted(type_classes, key=lambda t: (-usage[t], t)):
        lines.append(f"| `{t}` | {usage[t]} | {', '.join(type_classes[t])} | {'Base model only' if t in editor_types else 'Pending'} |")
    lines += ['', '## Scope and migration order', '',
              '1. Components first: retain the verified models and expand remaining component families.',
              '   Legacy text import is explicitly deferred by user direction (2026-11-14).',
              '2. Polarized capacitors, remaining switch variants, tapped/saturating transformers and other analog devices.',
              '3. Broader transistor variants, named model data and configurable model options.',
              '4. Logic gates, sequential devices, chips and mixed-signal elements.',
              '5. Custom/composite devices, behavioral sources, specialized and interactive devices.',
              '6. Deferred: legacy import and example chooser preserving all category paths; retain unavailable entries with explicit',
              '   reasons until their dependencies are supported. Restore saved scopes/annotations where possible.', '',
              'Each family needs document schema, symbol/pin geometry, properties, compiler/result mapping',
              'and worker-safe initialization. Keep the existing numerical implementations. Do not remove',
              'the worker loader whitelist wholesale: constructors may still depend on the old UI.', '',
              'Full example-level record counts, categories and dependencies are in `LEGACY-CATALOG.json`.']
    if missing:
        lines += ['', 'Missing menu files: ' + ', '.join(missing)]
    (OUT / 'LEGACY-CATALOG.md').write_text('\n'.join(lines) + '\n')
    print(f'Inventoried {len(menu_classes)} menu classes, {len(type_classes)} serialized types, '
          f'{len(examples)} circuit files and {len(entries)} example menu entries; {len(missing)} missing files.')


if __name__ == '__main__':
    main()
