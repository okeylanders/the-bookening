import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating DictionaryViewProvider');
  const provider = new DictionaryViewProvider(context.extensionUri);
  console.log("context.extensionUri:", context.extensionUri);
  console.log('Registering webview view provider for dictionaryView');
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dictionaryView', provider)
  );
  // register context menu command to lookup selected word
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
      // ensure the dictionary view is visible
      vscode.commands.executeCommand('workbench.view.explorer');
      // perform lookup
      provider.lookupWord(word);
    })
  );
}

export function deactivate() {}

class DictionaryViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {
    console.log('DictionaryViewProvider constructor called');
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    console.log('resolveWebviewView called');
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.extensionUri.fsPath, 'dist'))
      ]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(message => {
      console.log('Extension received message:', message);
      if (message.type === 'lookup' && this._view) {
        this.lookupWord(message.word);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'dist', 'webview.js'))
    );
    console.log("scriptUri:", scriptUri.toString());

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Dictionary</title></head><body><div id="root"></div><script src="${scriptUri}" nonce="${webview.cspSource}"></script></body></html>`;
  }

  lookupWord(word: string) {
    if (!this._view) {
      return;
    }
    const webview = this._view.webview;
    console.log(`lookupWord called with: ${word}`);
    const python = 'python3';
    const scriptPath = path.join(this.extensionUri.fsPath, 'dist', 'scripts', 'lookup.py');
    console.log(`Executing python script at: ${scriptPath}`);

    execFile(python, [scriptPath, '--word', word], { encoding: 'utf8' }, (err, stdout, stderr) => {
      console.log('lookupWord callback err:', err);
      console.log('lookupWord callback stdout:', stdout);
      console.log('lookupWord callback stderr:', stderr);
      if (err) {
        // use stderr or stdout (which contains suggestion messages) or err.message
        const message = stderr || stdout || err.message;
        webview.postMessage({ type: 'error', error: message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        webview.postMessage({ type: 'results', data });
      } catch (e: any) {
        webview.postMessage({ type: 'error', error: e.message });
      }
    });
  }
}
