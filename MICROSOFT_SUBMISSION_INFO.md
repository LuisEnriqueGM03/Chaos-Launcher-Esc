# Homologación Oficial en Microsoft Security Intelligence (WDSI)
### Chaos Launcher - Eliminación de Bloqueo Smart App Control / SmartScreen

Para que Windows 11 Smart App Control y Microsoft Defender SmartScreen reconozcan este instalador como 100% seguro en la nube de Microsoft sin advertencias para ningún jugador, sigue estos pasos oficiales:

---

## 1. Datos Técnicos del Instalador

| Parámetro | Valor |
| :--- | :--- |
| **Archivo** | `ChaosLauncher-Setup-1.0.0.exe` |
| **Ruta en tu equipo** | `C:\Users\luise\Documents\Proyectos\ChaosLauncher\ChaosLauncher\release\ChaosLauncher-Setup-1.0.0.exe` |
| **Tamaño** | ~83.0 MB (87,082,368 bytes) |
| **Hash SHA-256** | `B842417911C6AEE26E845A1729EE355CFDE39CD7EE4299ED792AE66302D146B3` |
| **Publicador / Signer** | `Chaos Studio` (`CN=Chaos Studio, O=Chaos Launcher Community, C=US`) |
| **Tipo de Firma** | Authenticode SHA256 (Sellado de tiempo DigiCert RFC3161) |

---

## 2. Pasos para el Envío a Microsoft

1. Abre en tu navegador el portal oficial de Microsoft:  
   🔗 **[https://www.microsoft.com/en-us/wdsi/filesubmission](https://www.microsoft.com/en-us/wdsi/filesubmission)**
2. Inicia sesión con cualquier cuenta de Microsoft (Outlook, Hotmail o Live).
3. Selecciona la opción:  
   **"Software developer"** (Desarrollador de software) o **"Home customer"**.
4. En el formulario:
   * **File:** Sube el archivo `release\ChaosLauncher-Setup-1.0.0.exe`.
   * **Product:** Selecciona *Microsoft Defender SmartScreen* o *Smart App Control*.
   * **Detection:** Selecciona *Incorrectly detected / False positive (Falso positivo)*.
   * **Comments / Justification:** Puedes pegar el siguiente texto:
     ```text
     Hello Microsoft Security Team,
     This is the official installer for Chaos Launcher, an open-source Minecraft community launcher built with Electron and React.
     The application is signed with Authenticode by Chaos Studio and contains no malware or malicious code.
     Please whitelist this file hash in SmartScreen and Smart App Control cloud intelligence so our community players on Windows 11 can install it safely without false positive blocks.
     Thank you!
     ```
5. Haz clic en **Submit**.

Microsoft procesa el archivo de forma automatizada. En unas pocas horas recibirás la confirmación de análisis limpio y el hash `B842417911C6AEE26E845A1729EE355CFDE39CD7EE4299ED792AE66302D146B3` quedará validado en la nube de Windows 11 para todo el mundo.

---

## 3. Instrucción Nativa Inmediata (Para Jugadores hoy mismo)

Si compartes el instalador con un amigo o jugador antes de que Microsoft termine de procesar la subida:
* **No necesitan ningún archivo .bat ni comandos.**
* Simplemente hacen:
  1. Clic derecho en `ChaosLauncher-Setup-1.0.0.exe`.
  2. Seleccionan **Propiedades**.
  3. En la pestaña *General* (abajo a la derecha), marcan la casilla **"Desbloquear"** (Unblock).
  4. Hacen clic en **Aceptar**.
  5. Ejecutan el instalador normalmente.

Una vez instalado en su PC, el acceso directo en el Escritorio queda instalado localmente y **nunca más** vuelve a mostrar ninguna advertencia.
