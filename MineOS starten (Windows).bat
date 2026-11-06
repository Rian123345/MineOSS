@echo off
setlocal EnableExtensions
title MineOS
cd /d "%~dp0"

echo.
echo   =============================================
echo      MineOS - Minecraft Store
echo   =============================================
echo.

if not exist "dist\server.js" goto notextracted

rem 1) Portable Version im Ordner "runtime" verwenden (falls schon geladen)
if exist "runtime\node\node.exe" goto useruntime

rem 2) Installiertes Node.js verwenden (mindestens 22.13)
where node >nul 2>nul
if errorlevel 1 goto download
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" >nul 2>nul
if errorlevel 1 goto download
set "NODE=node"
goto start

:useruntime
set "NODE=%CD%\runtime\node\node.exe"
goto start

:download
echo   Beim ersten Start wird Node.js einmalig heruntergeladen (ca. 30 MB).
echo   Es wird nichts installiert - alles bleibt in diesem Ordner.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\get-node.ps1"
if errorlevel 1 goto downloadfailed
if not exist "runtime\node\node.exe" goto downloadfailed
goto useruntime

:start
set "MINEOS_OPEN_BROWSER=1"
echo   MineOS startet und oeffnet sich gleich im Browser ...
echo   (Falls nicht: im Browser http://localhost:3000 eingeben)
echo.
"%NODE%" --disable-warning=ExperimentalWarning dist\server.js
echo.
echo   MineOS wurde beendet. Hinweise zur Fehlersuche: data\mineos-log.txt
echo.
pause
exit /b 0

:notextracted
echo   FEHLER: Die Datei dist\server.js wurde nicht gefunden.
echo.
echo   Wahrscheinlich wurde die ZIP-Datei nicht entpackt.
echo   So geht's: Rechtsklick auf mineos.zip - "Alle extrahieren..." - Extrahieren.
echo   Danach im entpackten Ordner "MineOS starten (Windows).bat" doppelklicken.
echo.
pause
exit /b 1

:downloadfailed
echo.
echo   Download von Node.js fehlgeschlagen.
echo   Bitte Internetverbindung pruefen oder Node.js 22 von https://nodejs.org
echo   installieren und diese Datei danach erneut starten.
echo.
pause
exit /b 1
