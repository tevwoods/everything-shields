import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(rootDir, 'package');

// Run tests
console.log('Running tests...');
try {
    const { execSync } = await import('child_process');
    execSync('npm test', { stdio: 'inherit', cwd: rootDir });
    console.log('✓ All tests passed');
} catch (error) {
    console.error('Tests failed:', error);
    process.exit(1);
}

// Run TypeScript build
console.log('Building TypeScript...');
try {
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
    console.log('✓ TypeScript build completed successfully');
} catch (error) {
    console.error('TypeScript build failed:', error);
    process.exit(1);
}

// Read module.json
const moduleJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'module.json'), 'utf8'));
const moduleId = moduleJson.id;
const moduleVersion = moduleJson.version;

// Create package directory
if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true });
}
fs.mkdirSync(packageDir);

// Create module directory
const moduleDir = path.join(packageDir, moduleId);
fs.mkdirSync(moduleDir);

// Copy dist files to package
fs.cpSync(distDir, moduleDir, { recursive: true });

// Copy packs (including nested folders) to package if present
const packsDir = path.join(rootDir, 'packs');
if (fs.existsSync(packsDir)) {
    fs.cpSync(packsDir, path.join(moduleDir, 'packs'), { recursive: true });
}

// Copy and update module.json
fs.writeFileSync(
    path.join(moduleDir, 'module.json'),
    JSON.stringify(moduleJson, null, 2)
);

// Copy to Foundry modules directory if it exists
const foundryModulesDir = path.join(process.env.LOCALAPPDATA, 'FoundryVTT', 'Data', 'modules');
if (fs.existsSync(foundryModulesDir)) {
    const foundryModuleDir = path.join(foundryModulesDir, moduleId);
    // Remove existing module if present
    if (fs.existsSync(foundryModuleDir)) {
        try {
            fs.rmSync(foundryModuleDir, { recursive: true });
        } catch (error) {
            console.warn('Could not remove existing module (Foundry VTT might be running):', error.message);
            console.warn('Please close Foundry VTT and try again, or manually copy the files from the package directory.');
        }
    }
    
    // Copy new version if we successfully removed the old one
    if (!fs.existsSync(foundryModuleDir)) {
        try {
            fs.cpSync(moduleDir, foundryModuleDir, { recursive: true });
            console.log(`Copied package to Foundry modules directory: ${foundryModuleDir}`);
        } catch (error) {
            console.warn('Could not copy to Foundry modules directory:', error.message);
            console.warn('Please manually copy the files from the package directory after closing Foundry VTT.');
        }
    }
} else {
    console.log('Foundry modules directory not found at:', foundryModulesDir);
}

// Create zip file
const archiver = (await import('archiver')).default;
const output = fs.createWriteStream(path.join(rootDir, `${moduleId}-v${moduleVersion}.zip`));
const archive = archiver('zip', { zlib: { level: 9 }});

await new Promise((resolve, reject) => {
    output.on('close', () => {
        console.log(`✓ Created package: ${moduleId}-v${moduleVersion}.zip`);
        console.log(`${archive.pointer()} total bytes`);
        resolve();
    });

    archive.on('error', (err) => {
        reject(err);
    });

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            console.warn('Archive warning:', err);
        } else {
            reject(err);
        }
    });

    archive.pipe(output);
    archive.directory(moduleDir, moduleId);
    archive.finalize();
});