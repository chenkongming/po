@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
set "LOG=%~dp0build.log"
> "%LOG%" echo Build started at %date% %time%

echo [1/3] Sync web assets to Android...
call npm run cap:sync >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Sync failed. See %LOG%
  exit /b 1
)

if not defined JAVA_HOME (
  for %%J in (
    "D:\androidStudio\jbr"
    "C:\Program Files\Android\Android Studio\jbr"
    "%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"
    "D:\Android\Android Studio\jbr"
    "C:\Program Files\Java\jdk-21"
    "C:\Program Files\Java\jdk-17"
  ) do (
    if exist "%%~J\bin\java.exe" (
      set "JAVA_HOME=%%~J"
      goto :java_found
    )
  )
  echo.
  echo ERROR: JDK not found. Set JAVA_HOME to Android Studio jbr, e.g.:
  echo   set JAVA_HOME=D:\androidStudio\jbr
  exit /b 1
)

:java_found
echo Using JAVA_HOME=%JAVA_HOME%
echo Using JAVA_HOME=%JAVA_HOME%>> "%LOG%"

cd android
echo [2/3] Stop old Gradle daemons...
call gradlew.bat --stop >> "%LOG%" 2>&1

echo [3/3] Build debug APK...
call gradlew.bat assembleDebug --no-daemon >> "%LOG%" 2>&1
set BUILD_EXIT=!ERRORLEVEL!

if !BUILD_EXIT! neq 0 (
  echo.
  echo Build failed. Last lines from log:
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 40"
  echo.
  echo Full log: %LOG%
  exit /b !BUILD_EXIT!
)

echo.
echo Build succeeded.
echo APK: %CD%\app\build\outputs\apk\debug\app-debug.apk
echo Build succeeded.>> "%LOG%"
exit /b 0
