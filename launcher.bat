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
:: Ouvrir Chrome en mode App (fenêtre isolée) avec un profil temporaire 
start /wait chrome.exe --app="http://localhost:5173" --user-data-dir="%TEMP%\LoupGarouChromeProfile"

:: Dès que la fenêtre est fermée, on recherche le processus qui écoute sur le port 5173 pour le tuer
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo [Grimoire] Fin de session.
