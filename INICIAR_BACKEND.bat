@echo off
cd /d %~dp0backend
if not exist node_modules (
  echo Instalando dependencias...
  npm install
)
echo Iniciando ZENKZONE...
npm run dev
pause
