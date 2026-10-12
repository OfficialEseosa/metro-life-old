@echo off
setlocal
cd /d "%~dp0"
if defined JAVA_HOME ("%JAVA_HOME%\bin\java.exe" tools\RunMetro.java) else (java tools\RunMetro.java)
if errorlevel 1 exit /b 1
