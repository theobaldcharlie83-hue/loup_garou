@echo off
setlocal
cd /d "%~dp0"

echo [Grimoire] Verification des dependances...
if not exist "node_modules" (
    echo [ERREUR] node_modules est manquant. Lancez 'npm install' d'abord.
    pause
    exit /b
)

echo [Grimoire] Lancement du Grimoire du Village...
:: Lancer le serveur vite en arrière-plan
start /b cmd /c "npm run dev -- --port 5173"

echo [Grimoire] Attente de l'initialisation du serveur...
:WAIT_LOOP
timeout /t 1 /nobreak >nul
netstat -aon | findstr ":5173 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [Grimoire] ...en attente...
    goto WAIT_LOOP
)

echo [Grimoire] Serveur pret ! Ouverture de la chronique.
:: Tenter de trouver Chrome
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if defined CHROME_PATH (
    start /wait "" "%CHROME_PATH%" --app="http://localhost:5173/loup_garou/" --user-data-dir="%TEMP%\LoupGarouChromeProfile"
) else (
    :: Fallback sur Edge
    start /wait msedge.exe --app="http://localhost:5173/loup_garou/" --user-data-dir="%TEMP%\LoupGarouEdgeProfile"
)
:: Dès que la fenêtre est fermée, on recherche le processus qui écoute sur le port 5173 pour le tuer
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo [Grimoire] Fin de session.
