@echo off
setlocal
cd /d "%~dp0"

echo [DEBUG] Demarrage en mode verbeux...
if not exist "node_modules" (
    echo [ERREUR] node_modules est manquant. Installation recommandee : npm install
    pause
    exit /b
)

echo [DEBUG] Lancement du serveur...
:: On ne lance PAS en arrière-plan pour voir les logs
npm run dev -- --port 5173
pause
