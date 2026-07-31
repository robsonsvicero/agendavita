@echo off
setlocal

call npm.cmd run build
if errorlevel 1 exit /b 1

echo.
echo Build concluido em dist\
echo Envie o conteudo da pasta dist para public_html.
