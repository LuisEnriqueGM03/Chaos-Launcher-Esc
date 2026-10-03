import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

export class JavaDetector {
  public static detectJavaInstallations(): JavaInstallation[] {
    const installations: JavaInstallation[] = [];
    const scannedPaths = new Set<string>();

    const checkAndAdd = (javawPath: string) => {
      if (scannedPaths.has(javawPath.toLowerCase())) return;
      scannedPaths.add(javawPath.toLowerCase());

      if (fs.existsSync(javawPath)) {
        try {
          const output = execSync(`"${javawPath}" -version 2>&1`, { encoding: 'utf8', timeout: 3000 });
          const versionMatch = output.match(/version "([^"]+)"/);
          if (versionMatch) {
            const versionStr = versionMatch[1];
            let major = 8;
            if (versionStr.startsWith('1.')) {
              major = parseInt(versionStr.split('.')[1], 10);
            } else {
              major = parseInt(versionStr.split('.')[0], 10);
            }
            installations.push({
              path: javawPath,
              version: versionStr,
              majorVersion: major,
            });
          }
        } catch {
          // Ignore failures
        }
      }
    };

    // 1. Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      checkAndAdd(path.join(process.env.JAVA_HOME, 'bin', 'javaw.exe'));
    }

    // 2. Check System PATH javaw
    try {
      const whereOutput = execSync('where javaw.exe 2>nul', { encoding: 'utf8' }).trim();
      const lines = whereOutput.split('\r\n');
      for (const line of lines) {
        if (line && fs.existsSync(line)) {
          checkAndAdd(line);
        }
      }
    } catch {
      // Ignore
    }

    // 3. Scan Common Program Files Directories
    const candidateDirs = [
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files (x86)\\Java',
    ];

    for (const baseDir of candidateDirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const subdirs = fs.readdirSync(baseDir);
          for (const sub of subdirs) {
            const javaw = path.join(baseDir, sub, 'bin', 'javaw.exe');
            checkAndAdd(javaw);
          }
        } catch {
          // Ignore
        }
      }
    }

    return installations;
  }

  public static getBestJava(requiredMajor: number = 21): string {
    const list = this.detectJavaInstallations();
    // Prioritize exact match
    const exact = list.find(j => j.majorVersion === requiredMajor);
    if (exact) return exact.path;

    // Prioritize newer
    const newer = list.find(j => j.majorVersion >= requiredMajor);
    if (newer) return newer.path;

    // Fallback to any found
    if (list.length > 0) return list[0].path;

    // Default fallback
    return 'javaw.exe';
  }
}
