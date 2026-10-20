@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Run npm install and npm start first to prepare DeskHelper.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Run npm run build first to prepare DeskHelper.
  pause
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE="
set "DESKHELPER_DATA_DIR=%~dp0.local-data\user"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
