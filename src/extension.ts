// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HDevelopController } from './HDevelopController';
import { HDevelopFormatter } from './HDevelopFormatter';
import { HDevelopSerializer } from './HDevelopSerializer';

export function activate(context: vscode.ExtensionContext) {
	const notebookSerializerSub = vscode.workspace.registerNotebookSerializer('halcon-hdevelop', new HDevelopSerializer());
	const notebookControllerSub = new HDevelopController();
	const hdevelopFormatterSub = vscode.languages.registerDocumentFormattingEditProvider('hdevelop', new HDevelopFormatter());

	context.subscriptions.push(notebookSerializerSub, notebookControllerSub, hdevelopFormatterSub);

}

export function deactivate() {}
