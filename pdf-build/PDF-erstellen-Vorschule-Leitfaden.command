#!/bin/bash
#
# EDULEO – Leitfaden "Vorschule & Konzentration" als PDF erzeugen
# Einfach doppelklicken. Erstellt das PDF in assets/downloads/.
#
# Braucht nur Google Chrome (ist installiert). Keine weitere Installation nötig.

# In den Ordner wechseln, in dem dieses Skript liegt
cd "$(dirname "$0")" || exit 1

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
QUELLE="vorschule-konzentration-leitfaden.html"
ZIEL="../assets/downloads/vorschule-konzentration-leitfaden.pdf"

echo ""
echo "=== EDULEO: Leitfaden-PDF wird erstellt ==="
echo ""

if [ ! -f "$CHROME" ]; then
  echo "FEHLER: Google Chrome wurde nicht gefunden unter:"
  echo "  $CHROME"
  echo "Bitte Google Chrome installieren und Skript erneut starten."
  echo ""
  read -n 1 -s -r -p "Zum Schliessen eine Taste druecken..."
  exit 1
fi

if [ ! -f "$QUELLE" ]; then
  echo "FEHLER: Vorlage '$QUELLE' nicht gefunden."
  read -n 1 -s -r -p "Zum Schliessen eine Taste druecken..."
  exit 1
fi

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --allow-file-access-from-files \
  --print-to-pdf="$ZIEL" \
  "$QUELLE" 2>/dev/null

if [ -f "$ZIEL" ]; then
  echo "Fertig! PDF gespeichert unter:"
  echo "  assets/downloads/vorschule-konzentration-leitfaden.pdf"
  echo ""
  echo "Oeffne das PDF zur Kontrolle..."
  open "$ZIEL"
else
  echo "FEHLER: PDF konnte nicht erstellt werden."
fi

echo ""
read -n 1 -s -r -p "Zum Schliessen eine Taste druecken..."
echo ""
