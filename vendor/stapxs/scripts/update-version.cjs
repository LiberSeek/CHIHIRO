/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const rootPackagePath = path.join(rootDir, 'package.json');
const tauriCargoPath = path.join(rootDir, 'src/tauri/Cargo.toml');
const napcatPackagePath = path.join(rootDir, 'ssqq.napcat-plugin/package.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function updateTauriVersion(appVersion) {
    const cargoContent = fs.readFileSync(tauriCargoPath, 'utf8');
    const nextContent = cargoContent.replace(
        /(\[package\][\s\S]*?^version = ")([^"]+)(")/m,
        `$1${appVersion}$3`
    );

    if (nextContent === cargoContent) {
        return false;
    }

    fs.writeFileSync(tauriCargoPath, nextContent, 'utf8');
    return true;
}

function updateNapcatVersion(appVersion) {
    const packageInfo = readJson(napcatPackagePath);
    const currentVersion = packageInfo.version || '';
    const pluginSuffix = currentVersion.includes('-')? currentVersion.slice(currentVersion.indexOf('-')): '';
    const nextVersion = `${appVersion}${pluginSuffix}`;

    if (currentVersion === nextVersion) {
        return false;
    }

    packageInfo.version = nextVersion;
    fs.writeFileSync(
        napcatPackagePath,
        JSON.stringify(packageInfo, null, 4) + '\n',
        'utf8'
    );
    return true;
}

function runCapacitorSync(platforms) {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    execFileSync(
        npxCmd,
        ['@stapxs/capacitor-sync-version', ...platforms],
        {
            cwd: rootDir,
            stdio: 'inherit'
        }
    );
}

function main() {
    const appVersion = readJson(rootPackagePath).version;
    const platforms = process.argv.slice(2);
    const syncTargets = platforms.length > 0 ? platforms : ['android', 'ios'];

    console.log(`Syncing project version to ${appVersion}`);

    const tauriUpdated = updateTauriVersion(appVersion);
    console.log(
        tauriUpdated? `Updated src/tauri/Cargo.toml -> ${appVersion}`: 'src/tauri/Cargo.toml already up to date'
    );

    const napcatUpdated = updateNapcatVersion(appVersion);
    console.log(
        napcatUpdated? `Updated ssqq.napcat-plugin/package.json -> ${readJson(napcatPackagePath).version}`: 'ssqq.napcat-plugin/package.json already up to date'
    );

    runCapacitorSync(syncTargets);
}

main();
