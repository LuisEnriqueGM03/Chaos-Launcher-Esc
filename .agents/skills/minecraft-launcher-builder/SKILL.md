---
name: minecraft-launcher-builder
description: Comprehensive knowledge for building Minecraft launchers with Electron, MCLC, Microsoft OAuth (MSMC), Offline UUIDs, and automated Modpack distribution.
---

# Minecraft Launcher Builder Skill

## 1. Authentication
### A. No Premium (Offline)
- UUID Generation: Standard offline player UUID in Java is MD5 based:
  ```js
  const crypto = require('crypto');
  function getOfflineUUID(username) {
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
    hash[8] = (hash[8] & 0x3f) | 0x80; // IETF variant
    return hash.toString('hex').replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5');
  }
  ```
- Player Skin Avatar:
  `https://minotar.net/helm/${username}/128.png` or `https://mc-heads.net/avatar/${username}/128`

### B. Premium (Microsoft)
- Uses `msmc` (`msmc.fastLaunch('electron', ...)` or popup)
- Converts token to MCLC auth format (`auth.getMclc()`).
- Saves refresh token in secure persistent store.

## 2. Modpack Sync and Mandatory Updates
- A remote `modpack.json` contains:
  ```json
  {
    "name": "Chaos Pack",
    "version": "1.0.0",
    "minecraftVersion": "1.20.1",
    "loader": {
      "type": "fabric",
      "version": "0.15.11"
    },
    "downloadUrl": "https://.../pack.zip",
    "forceUpdate": true,
    "changelog": ["..."]
  }
  ```
- If `remoteVersion !== localVersion`, the play button MUST be locked until downloaded and extracted.
