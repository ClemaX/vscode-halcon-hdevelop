import * as vscode from 'vscode';

export class HDevelopController {
    readonly controllerId = 'halcon-hdevelop-controller';
    readonly notebookType = 'halcon-hdevelop';
    readonly label = 'Halcon HDevelop';
    readonly supportedLanguages = ['hdevelop'];

    private readonly _controller: vscode.NotebookController;
/* 
    private _executionOrder = 0;
 */
    constructor() {
        this._controller = vscode.notebooks.createNotebookController(this.controllerId, this.notebookType, this.label);

        this._controller.supportedLanguages = this.supportedLanguages;
/* 
        this._controller.supportsExecutionOrder = true;
        this._controller.executeHandler = this._execute.bind(this);
 */
    }

    dispose(): void {
        this._controller.dispose();
    }
/* 
    private _execute(cells: vscode.NotebookCell[], _notebook: vscode.NotebookDocument, _controller: vscode.NotebookController): void {
        for (const cell of cells) {
            this._doExecution(cell);
        }
    }

    private async _doExecution(cell: vscode.NotebookCell) {

    }
 */

    
}