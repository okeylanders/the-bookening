import * as vscode from 'vscode';
import { execFile, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const debugging = true;

export function activate(context: vscode.ExtensionContext) {
  const provider = new DictionaryViewProvider(context.extensionUri);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DictionaryViewProvider.viewType,
      provider
    )
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('dictionary.lookupSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const word = editor.document.getText(editor.selection).trim();
      if (!word) {
        vscode.window.showInformationMessage('No text selected for lookup');
        return;
      }
      vscode.commands.executeCommand('workbench.view.extension.dictionary').then(() => {
        provider.notifyWebviewOfWordLookup(word);
        provider.lookupWord(word);
      });
    })
  );
}

export function deactivate() {}

class DictionaryViewProvider implements vscode.WebviewViewProvider {

  public static readonly viewType = 'dictionary.dictionaryView';
  
  private _view?: vscode.WebviewView;
  private _pythonPath: string | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
  ) {
    
    this._view = webviewView;

    // Allow scripts in the webview
    webviewView.webview.options = {
			enableScripts: true,
      // Restrict the webview to only loading resources from the extension's 'dist' directory
			localResourceRoots: [
				vscode.Uri.parse(path.join(this.extensionUri.fsPath, 'dist'))
			]
		};

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      debugging && console.log('Extension received message:', message);
      switch (message.type) {
        case 'lookup':
          this.lookupWord(message.word);
          break;
        case 'check_python':
          await this.checkPythonAvailability();
          break;
        case 'install_dependencies':
          this.installDependencies();
          break;
      }
    });

    this.checkPythonAvailability(); 
  }

  private async checkPythonAvailability(): Promise<void> {
    if (!this._view) return;
    const webview = this._view.webview;

    try {
      await new Promise<void>((resolve, reject) => {
        execFile('python3', ['--version'], (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            debugging && console.log('python3 found:', stdout || stderr);
            this._pythonPath = 'python3';
            resolve();
          }
        });
      });
      debugging && console.log('Python 3 check successful.');
    } catch (err) {
      try {
        await new Promise<void>((resolve, reject) => {
          execFile('python', ['--version'], (err, stdout, stderr) => {
            if (err) {
              reject(err);
            } else {
              debugging && console.log('python found:', stdout || stderr);
              if ((stdout || stderr).includes('Python 3')) {
                this._pythonPath = 'python';
                resolve();
              } else {
                reject(new Error('Python found but is not Python 3'));
              }
            }
          });
        });
        debugging && console.log('Python (v3) check successful.');
      } catch (finalErr) {
        debugging && console.error('Python 3 check failed:', finalErr);
        this._pythonPath = null;
        webview.postMessage({ type: 'error', error_type: 'python_missing', message: 'Python 3 executable not found in PATH. Please install Python 3 and ensure it is added to your system\'s PATH.' });
      }
    }
  }

  private installDependencies(): void {
    if (!this._view || !this._pythonPath) {
      this._view?.webview.postMessage({ type: 'install_status', status: 'error', message: 'Python path not configured or view not available.' });
      return;
    }
    const webview = this._view.webview;
    const requirementsPath = path.join(this.extensionUri.fsPath, 'dist', 'scripts', 'requirements.txt');

    if (!fs.existsSync(requirementsPath)) {
      debugging && console.error('requirements.txt not found at:', requirementsPath);
      webview.postMessage({ type: 'install_status', status: 'error', message: 'Installation files (requirements.txt) not found. Please try rebuilding the extension.' });
      return;
    }

    webview.postMessage({ type: 'install_status', status: 'installing', message: 'Installing dependencies using pip...' });
    debugging && console.log(`Running: ${this._pythonPath} -m pip install -r ${requirementsPath}`);

    const pipInstall = spawn(this._pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath]);

    let stdout = '';
    let stderr = '';

    pipInstall.stdout.on('data', (data) => {
      const msg = data.toString();
      stdout += msg;
      debugging && console.log('pip install stdout:', msg);
      webview.postMessage({ type: 'install_status', status: 'installing', message: msg });
    });

    pipInstall.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      debugging && console.error('pip install stderr:', msg);
      webview.postMessage({ type: 'install_status', status: 'installing', message: msg });
    });

    pipInstall.on('close', (code) => {
      debugging && console.log(`pip install process exited with code ${code}`);
      if (code === 0) {
        webview.postMessage({ type: 'install_status', status: 'success', message: 'Dependencies installed successfully. You can now search for words.' });
      } else {
        webview.postMessage({ type: 'install_status', status: 'error', message: `Failed to install dependencies. Exit code: ${code}. Error: ${stderr || stdout}` });
      }
    });

    pipInstall.on('error', (err) => {
      debugging && console.error('Failed to start pip install process:', err);
      webview.postMessage({ type: 'install_status', status: 'error', message: `Failed to start installation process: ${err.message}` });
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get the path to the script on disk
    const scriptPathOnDisk = vscode.Uri.parse(path.join(this.extensionUri.fsPath, 'dist', 'webview.js'));

    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    const nonce = getNonce();
    debugging && console.log("scriptUri for webview:", scriptUri.toString());

    // Updated CSP to include style-src for inline styles if needed, and script-src with nonce
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Dictionary</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  notifyWebviewOfWordLookup(word: string) {
    if (!this._view) {
      return;
    }
    const webview = this._view.webview;
    debugging && console.log(`notifyWebviewOfWordLookup called with: ${word}`);
    webview.postMessage({ type: 'word', word: word});
  }

  async lookupWord(word: string) {
    if (!this._view) {
      return;
    }
    const webview = this._view.webview;

    if (!this._pythonPath) {
      await this.checkPythonAvailability();
      if (!this._pythonPath) {
        debugging && console.log('lookupWord aborted: Python not available.');
        return;
      }
    }
    
    debugging && console.log(`lookupWord called with: ${word}`);
    const scriptPath = path.join(this.extensionUri.fsPath, 'dist', 'scripts', 'lookup.py');
    debugging && console.log(`Executing python script at: ${scriptPath} using ${this._pythonPath}`);

    execFile(this._pythonPath, [scriptPath, '--word', word], { encoding: 'utf8' }, (err, stdout, stderr) => {
      debugging && console.log('lookupWord callback err:', err);
      debugging && console.log('lookupWord callback stdout:', stdout);
      debugging && console.log('lookupWord callback stderr:', stderr);

      if (err || stderr) {
        try {
          const potentialJsonError = JSON.parse(stdout);
          if (potentialJsonError.error === 'missing_dependencies') {
            debugging && console.log('Detected missing dependencies error from script.');
            webview.postMessage({ type: 'error', error_type: 'missing_dependencies', message: potentialJsonError.message });
            return;
          }
        } catch (parseErr) {}

        const message = stderr || stdout || err?.message || 'Unknown script error';
        debugging && console.error('Script execution error:', message);
        webview.postMessage({ type: 'error', error_type: 'script_error', message: message });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        if (stdout.startsWith("No entries found for")) {
           webview.postMessage({ type: 'error', error_type: 'no_results', message: stdout });
        } else {
           webview.postMessage({ type: 'results', word: word, data });
        }
      } catch (e: any) {
        debugging && console.error('Failed to parse script output:', e);
        webview.postMessage({ type: 'error', error_type: 'parse_error', message: `Failed to parse results: ${e.message}` });
      }
    });
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
