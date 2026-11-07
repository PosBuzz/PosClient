#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
dotnet build "$project_root/PrintingFromWebToPOSPrinter/Source/Printer/Printer.CrossBuild.csproj" -c Release "$@"
python3 - "$project_root" <<'PY'
from pathlib import Path
import shutil, sys, zipfile
root = Path(sys.argv[1])
agent = root / 'PrintingFromWebToPOSPrinter'
output = agent / 'Source/Printer/bin/Release/net462'
dist = agent / 'Distribution/PosBuzz-Print-Server'
for name in ['Printer.exe', 'Printer.pdb', 'Printer.exe.config', 'Newtonsoft.Json.dll', 'zxing.dll', 'zxing.presentation.dll']:
    shutil.copy2(output / name, dist / name)
shutil.copy2(agent / 'Source/PosBuzz_Print_Server.postman_collection.json', dist / 'Documentation/PosBuzz_Print_Server.postman_collection.json')
archive = agent / 'Distribution/PosBuzz-Print-Server.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for path in sorted(dist.rglob('*')):
        if path.is_file() and not path.name.startswith('.'):
            package.write(path, path.relative_to(dist.parent))
consumer = root / 'consumer/public/print-server/PosBuzz-Print-Server.zip'
consumer.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(archive, consumer)
print('Updated distribution and consumer download:', archive)
PY
