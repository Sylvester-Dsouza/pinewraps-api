@echo off
:: Clean dist directory
if exist dist rd /s /q dist
mkdir dist

:: Run SWC build
call swc src -d dist

:: Run TypeScript for declarations
call tsc --emitDeclarationOnly

:: Run build script
call node scripts/build.js

:: Copy package.json
copy package.json dist\

:: Create types directory if it exists in src
if exist src\types (
    mkdir dist\types
    xcopy /E /I /Y src\types dist\types
)
