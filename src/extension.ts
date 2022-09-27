// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HDevelopController } from './HDevelopController';
import { HDevelopSerializer } from './HDevelopSerializer';

export function activate(context: vscode.ExtensionContext) {
	const notebookSerializerSub = vscode.workspace.registerNotebookSerializer('halcon-hdevelop', new HDevelopSerializer())
	const notebookControllerSub = new HDevelopController();

	context.subscriptions.push(notebookSerializerSub);
	context.subscriptions.push(notebookControllerSub);
}

export function deactivate() {}
