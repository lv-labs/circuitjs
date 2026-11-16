#!/usr/bin/env python3
"""Generate the prototype's menu names/order from the bundled Falstad menu."""
import json
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
def extract_menu():
    source = (ROOT/'src/com/lushprojects/circuitjs1/client/Menus.java').read_text()
    source = source.split('public void composeMainMenu(',1)[1].split('void makeClassCheckItems(',1)[0]
    source = re.sub(r'//[^\n]*', '', source)
    blocks = {}
    for menu, contents in re.findall(r'makeClassCheckItems\((\w+), new String\[\]\s*\{(.*?)\}\);',source,re.S):
        strings = re.findall(r'"([^"\n]*)"',contents)
        assert len(strings)%2 == 0
        blocks[menu] = [{'label':strings[i], 'legacyClass':strings[i+1]} for i in range(0,len(strings),2)]
    result = blocks['mainMenuBar'][:]
    for label, menu in re.findall(r'mainMenuBar.addItem\(SafeHtmlUtils.*?Locale.LS\("&nbsp;</div>([^"\n]*)"\)\),\s*(\w+)(?:\[num\])?\);',source):
        children = blocks.get(menu, [])
        if menu == 'otherMenuBar':
            children = [{'label':label,'legacyClass':kind} for label,kind in re.findall(r'getClassCheckItem\(Locale.LS\("([^"]*)"\), "([^"]*)"\)',source)]
            children = [x for x in children if x['legacyClass'] != 'Select']
        result.append({'label':label,'children':children})
    result.append({'label':'Select/Drag Sel','legacyClass':'Select'})
    return result
if __name__ == '__main__':
    tree = extract_menu()
    (ROOT/'experiments/engine/legacy-component-menu.js').write_text("'use strict';\n// Generated from Menus.composeMainMenu; run tools/generate_component_menu.py.\nglobalThis.CircuitLegacyComponentMenu = "+json.dumps(tree,indent=2)+';\n')
    print(f'Generated {len(tree)} root entries and {sum(len(e.get("children",[])) for e in tree)} submenu entries.')
