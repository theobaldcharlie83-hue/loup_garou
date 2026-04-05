@echo off
cd /d "%~dp0"
:: Lancer le serveur vite en arrière-plan
start /b cmd /c "npm run dev -- --port 5173"

:: Attendre 3 secondes que le serveur s'initialise
timeout /t 3 /nobreak >nul

:: Ouvrir Chrome en mode App (fenêtre isolée) avec un profil temporaire 
:: Cela permet au script d'attendre (start /wait) la fermeture de LA fenêtre spécifique.
start /wait chrome.exe --app="http://localhost:5173" --user-data-dir="%TEMP%\LoupGarouChromeProfile"

:: Dès que la fenêtre est fermée, on recherche le processus qui écoute sur le port 5173 pour le tuer
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
