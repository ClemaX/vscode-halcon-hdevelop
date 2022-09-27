import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

interface RawNotebookCell {
    language: string;
    value: string;
    kind: vscode.NotebookCellKind;
}

interface ProcedureParameter {

}

interface ProcedureAPI {

}

type TextNode = [{'#text'?: string}];

interface CommentNode {
    c: TextNode;
}

interface StatementNode {
    l: TextNode;
}

type ProcedureBody = (StatementNode | CommentNode)[];

interface ProcedureDocu {
    
}

type Procedure = [{interface: ProcedureAPI}, {body: ProcedureBody}, {docu: ProcedureDocu}];

type HDevelopData = [{procedure: Procedure}];

export class HDevelopSerializer implements vscode.NotebookSerializer {
    private static readonly parser = new XMLParser({preserveOrder: true});
    private static readonly serializer = new XMLBuilder({});
    private static readonly textDecoder = new TextDecoder();

    async deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): Promise<vscode.NotebookData> {
        const contents = HDevelopSerializer.textDecoder.decode(content);

        const parsedContent = <Array<any>>HDevelopSerializer.parser.parse(contents);
        var codeCellData: string = '';


        if (parsedContent.length >= 2) {
            const hdevelop = <HDevelopData>parsedContent[1].hdevelop;

            if (hdevelop.length === 1) {
                const procedure = hdevelop[0].procedure;
                console.debug(procedure.length)

                const body = procedure[1].body;
                const lines = body.map(node => (('l' in node) ? (node.l.length === 1) ? node.l[0]['#text'] : undefined : (node.c.length === 1) ? node.c[0]['#text'] : undefined) || '');

                codeCellData = lines.join('\n');
            }
        }

        var rawCells: RawNotebookCell[] = [
            {
                kind: vscode.NotebookCellKind.Code,
                language: 'hdevelop',
                value: codeCellData
            }
        ];

        const cells = rawCells.map(item =>
            new vscode.NotebookCellData(item.kind, item.value, item.language)
        );

        return new vscode.NotebookData(cells);
    }

    serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
        throw new Error('Method not implemented.');
    }
}