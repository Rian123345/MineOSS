#!/bin/bash
# MineOS starten – Doppelklick (Mac) bzw. "bash MineOS-starten.command" (Linux)
cd "$(dirname "$0")" || exit 1
pause_end() { echo; read -r -p "  Enter drücken zum Schließen …" _; }
if [ ! -f dist/server.js ]; then
  echo "  FEHLER: dist/server.js fehlt – bitte die ZIP-Datei zuerst vollständig entpacken."
  pause_end; exit 1
fi
echo
echo "  ============================================="
echo "     MineOS - Minecraft Store"
echo "  ============================================="
echo

node_ok() {
  "$1" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" >/dev/null 2>&1
}

if [ -x runtime/node/bin/node ]; then
  NODE="$PWD/runtime/node/bin/node"
elif command -v node >/dev/null 2>&1 && node_ok node; then
  NODE="node"
else
  echo "  Beim ersten Start wird Node.js einmalig heruntergeladen (ca. 30 MB)."
  echo "  Es wird nichts installiert – alles bleibt in diesem Ordner."
  echo
  case "$(uname -s)" in Darwin) P=darwin ;; Linux) P=linux ;; *) echo "  Betriebssystem nicht unterstützt."; exit 1 ;; esac
  case "$(uname -m)" in x86_64|amd64) A=x64 ;; arm64|aarch64) A=arm64 ;; *) echo "  Prozessor nicht unterstützt."; exit 1 ;; esac
  V=$(curl -fsSL https://nodejs.org/dist/index.json | grep -o '"version":"v22\.[0-9.]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$V" ]; then echo "  Download fehlgeschlagen. Bitte Internetverbindung prüfen."; pause_end; exit 1; fi
  NAME="node-$V-$P-$A"
  mkdir -p runtime
  curl -fL --progress-bar "https://nodejs.org/dist/$V/$NAME.tar.gz" -o "runtime/$NAME.tar.gz" || { echo "  Download fehlgeschlagen."; pause_end; exit 1; }
  EXPECTED=$(curl -fsSL "https://nodejs.org/dist/$V/SHASUMS256.txt" | grep " $NAME.tar.gz\$" | awk '{print $1}')
  ACTUAL=$( (shasum -a 256 "runtime/$NAME.tar.gz" 2>/dev/null || sha256sum "runtime/$NAME.tar.gz") | awk '{print $1}')
  if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$ACTUAL" ]; then
    rm -f "runtime/$NAME.tar.gz"; echo "  Prüfsumme stimmt nicht – Download beschädigt."; pause_end; exit 1
  fi
  rm -rf runtime/node
  tar -xzf "runtime/$NAME.tar.gz" -C runtime && mv "runtime/$NAME" runtime/node && rm -f "runtime/$NAME.tar.gz"
  NODE="$PWD/runtime/node/bin/node"
fi

export MINEOS_OPEN_BROWSER=1
echo "  MineOS startet und öffnet sich gleich im Browser ..."
"$NODE" --disable-warning=ExperimentalWarning dist/server.js
echo
echo "  MineOS wurde beendet. Hinweise zur Fehlersuche: data/mineos-log.txt"
pause_end
