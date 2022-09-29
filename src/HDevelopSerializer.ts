/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { HDevelopFormatter } from "./HDevelopFormatter";

interface ProcedureParameter {
  ':@': {'@_base_type': string, '@_dimension': number; '@_name': string};
  par: [];
}

type ProcedureAPI = [
  {io: ProcedureParameter[]},
  {oo: ProcedureParameter[]},
  {ic: ProcedureParameter[]},
  {oc: ProcedureParameter[]}
];

type TextNode = [{ "#text"?: string }];

interface CommentNode {
  c: TextNode;
}

interface StatementNode {
  l: TextNode;
}

type ProcedureBody = (StatementNode | CommentNode)[];

interface ProcedureDocuParameter {
  'parameter': [];
  ':@': {'@_id': string};
}

type ProcedureDocu = [{parameters: ProcedureDocuParameter[]}];

type Procedure = [
  { interface: ProcedureAPI },
  { body: ProcedureBody },
  { docu: ProcedureDocu, ':@': {'@_id': string} }
];

type HDevelopData = [{ procedure: Procedure }];

type XMLHeader = {
  '?xml': [{'#text': string}],
  ':@': {'@_version': string, '@_encoding': string}
};

type XMLData = [XMLHeader, {hdevelop: HDevelopData}];

interface HDevelopNotebookMetadata {
  originalContent: XMLData;
}

interface HDevelopNotebookData extends vscode.NotebookData {
  metadata: HDevelopNotebookMetadata;
}

export class HDevelopSerializer implements vscode.NotebookSerializer {
  private static readonly parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    parseAttributeValue: true,
  });
  private static readonly serializer = new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    suppressEmptyNode: true,
  });
  private static readonly textDecoder = new TextDecoder();
  private static readonly textEncoder = new TextEncoder();
  private static readonly formatter = new HDevelopFormatter();

  private static parseData(fileContent: Uint8Array): XMLData {
    const decodedContent = HDevelopSerializer.textDecoder.decode(fileContent);
    const data = HDevelopSerializer.parser.parse(decodedContent) as XMLData;

    if (data.length < 1 || data[0][":@"] === undefined || data[0][":@"]["@_version"] === undefined) {
      throw new Error("Invalid file: Could not find XML header and version!");
    }

    if (data.length < 2 || data[1].hdevelop === undefined) {
      throw new Error("Invalid file: Could not find hdevelop element!");
    }

    if (data[1].hdevelop[0].procedure === undefined || data[1].hdevelop[0].procedure.length < 3
      || data[1].hdevelop[0].procedure[0].interface === undefined || data[1].hdevelop[0].procedure[1].body === undefined || data[1].hdevelop[0].procedure[2].docu === undefined) {
      throw new Error("Invalid file: Could not find procedure elements!");
    }

    data[0][":@"]["@_version"] = "1.0";

    return data;
  }

  private deserializeBody(body: ProcedureBody): string {
    return HDevelopSerializer.formatter
    .formatRawLines(
      body.map(
        (node) =>
          ("l" in node
            ? node.l.length === 1
              ? node.l[0]["#text"]
              : undefined
            : node.c.length === 1
            ? node.c[0]["#text"]
            : undefined) || ""
      )
    )
    .join("\n");
  }

  private deserializeCodeCell(data: XMLData): vscode.NotebookCellData {
    const procedure = data[1].hdevelop[0].procedure;
    const codeCellData = this.deserializeBody(procedure[1].body);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, codeCellData, 'hdevelop');
  }

  private static deserializeAPIParameters(parameters: ProcedureParameter[]): string {
    return parameters.map((parameter) => {
      const baseType = parameter[":@"]["@_base_type"];
      const dimension = parameter[":@"]["@_dimension"];
      const name = parameter[":@"]["@_name"];

      const dimensionSuffix = (dimension !== 0) ? `[${dimension}]` : '';

      return `${baseType} ${name}${dimensionSuffix}`;
    }).join('\n');
  }

  private deserializeInputObjectCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const inputObjects = api[0].io;
    const code = HDevelopSerializer.deserializeAPIParameters(inputObjects);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeOutputObjectCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const outputObjects = api[1].oo;
    const code = HDevelopSerializer.deserializeAPIParameters(outputObjects);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeInputControlCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const inputControls = api[2].ic;
    const code = HDevelopSerializer.deserializeAPIParameters(inputControls);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  private deserializeOutputControlCell(data: XMLData): vscode.NotebookCellData {
    const api = data[1].hdevelop[0].procedure[0].interface;
    const outputControls = api[3].oc;
    const code = HDevelopSerializer.deserializeAPIParameters(outputControls);

    return new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, 'hdevelop.api')
  }

  async deserializeNotebook(
    content: Uint8Array,
    token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const hdevelopData = HDevelopSerializer.parseData(content);

    const cells: vscode.NotebookCellData[] = [
      this.deserializeInputObjectCell(hdevelopData),
      this.deserializeOutputObjectCell(hdevelopData),
      this.deserializeInputControlCell(hdevelopData),
      this.deserializeOutputControlCell(hdevelopData),
      this.deserializeCodeCell(hdevelopData),
    ];

    const data = new vscode.NotebookData(cells) as HDevelopNotebookData;

    data.metadata = { originalContent: hdevelopData };

    return data;
  }

  private static serializeCodeCell(cell: vscode.NotebookCellData): ProcedureBody {
    return cell.value.split('\n').map((line) => {
        return line.length === 0 || line.startsWith('*') ? {c: [{'#text': line}]} : {l: [{'#text': line}]};
    });
  }

  private static serializeAPIParameters(cell: vscode.NotebookCellData): ProcedureParameter[] {
    return cell.value.split('\n').map((line) => {
      const groups = line.match("^\\s*(iconic|ctrl)\\s+([$_a-zA-Z][$_a-zA-Z0-9]*)\\s*(?:\\[(\\d+)\\])?\\s*$")

      if (groups === null) {
        throw new Error(`Cannot save file: Invalid API format at: '${line}'!`);
      }

      const [_, baseType, name, dimension] = groups;

      const dimensionCount = dimension !== undefined ? Number(dimension) : 0;

      return {":@": {"@_base_type": baseType, "@_dimension": dimensionCount, "@_name": name}, par: []};
    })
  }

  private static serializeAPI(cells: vscode.NotebookCellData[]): ProcedureAPI {
    return [
      {io: HDevelopSerializer.serializeAPIParameters(cells[0])},
      {oo: HDevelopSerializer.serializeAPIParameters(cells[1])},
      {ic: HDevelopSerializer.serializeAPIParameters(cells[2])},
      {oc: HDevelopSerializer.serializeAPIParameters(cells[3])},
    ];
  }

  private static getAPIParameterNames(api: ProcedureAPI): string[] {
    return [
      ...api[0].io.map((parameter) => parameter[":@"]["@_name"]),
      ...api[1].oo.map((parameter) => parameter[":@"]["@_name"]),
      ...api[2].ic.map((parameter) => parameter[":@"]["@_name"]),
      ...api[3].oc.map((parameter) => parameter[":@"]["@_name"]),
    ];
  }

  private static generateDocu(api: ProcedureAPI): ProcedureDocu {
    const parameterNames = HDevelopSerializer.getAPIParameterNames(api).sort();

    return [{
      parameters: parameterNames.map(name => ({":@": {"@_id": name}, parameter: []}))
    }];
  }
 
  serializeNotebook(
    data: HDevelopNotebookData,
    token: vscode.CancellationToken
  ): Uint8Array {
    const content = data.metadata.originalContent;

    const api: ProcedureAPI = HDevelopSerializer.serializeAPI(data.cells);
    const body: ProcedureBody = HDevelopSerializer.serializeCodeCell(data.cells[4]);
    const docu: ProcedureDocu = HDevelopSerializer.generateDocu(api);

    content[1].hdevelop[0].procedure[0].interface = api;
    content[1].hdevelop[0].procedure[1].body = body;
    // TODO: Preserve existing docu and extend using docstring comments
    content[1].hdevelop[0].procedure[2].docu = docu;

    //console.debug(content[1].hdevelop[0].procedure[2])

    const fileContents = HDevelopSerializer.serializer.build(content);

    return HDevelopSerializer.textEncoder.encode(fileContents);
  }
}
