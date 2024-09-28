/**
 * Módulo representativo do problema de minimização do número máximo de cruzamentos
 * Estruturas de dados e funções adaptadas do código publicado com o artigo
 * A Variable Depth Neighborhood Search Algorithm for the Min-Max Arc Crossing Problem.
 * por Xinyun Wu, Caiquan Xiong, Na Deng, Dahai Xia
 * https://github.com/xavierwoo/I-VDNS
 */

import { readFileSync } from "fs";

/////////////////////// Estruturas de dados ///////////////////////

// export class HashTable<T> {
//     tabela: Array<Array<{ k: number; v: T }>>;
//     a = 5;
//     b = 8;
//     p = 5279;
//     m = 5087;
//     constructor() {
//         this.tabela = new Array<Array<{ k: number; v: T }>>(this.m);
//     }
//     private hashFn(k: number): number {
//         return ((this.a * k + this.b) % this.p) % this.m;
//     }
//     set(chave: number, valor: T) {
//         let pos = this.hashFn(chave);
//         if (this.tabela[pos] === undefined) {
//             // Não deu colisão
//             this.tabela[pos] = [{ k: chave, v: valor }];
//         } else {
//             // deu colisão - acrescenta no final
//             this.tabela[pos].push({ k: chave, v: valor });
//         }
//     }
//     get(chave: number): T | undefined {
//         let pos = this.hashFn(chave);
//         if (this.tabela[pos][0].k === chave) {
//             return this.tabela[pos][0].v;
//         }
//         let valor = this.tabela[pos].find((x) => (x.k = chave));
//         return valor ? valor.v : undefined;
//     }
//     clear() {
//         this.tabela = new Array<Array<{ k: number; v: T }>>(this.m);
//     }
// }

export class Edge {
    id: number = 0;
    originId: number;
    destinationId: number;
    numCross: number = 0;
    tmpCross: number = 0;
    tmpDeltaCross: number = 0;

    constructor(origin: Node, destination: Node) {
        this.originId = origin.id;
        this.destinationId = destination.id;
    }

    getId() {
        return `${this.originId}-${this.destinationId}`;
    }
    toString() {
        return `E[${this.id}, ${this.originId}->${this.destinationId} (${this.numCross})]`;
    }
}

export class Node {
    id: number = 0;
    layerIndex: number = 0;
    position: number = 0;
    numOutEdges: number = 0;
    numInEdges: number = 0;
    outEdges: Edge[] = [];
    inEdges: Edge[] = [];
    maxCross: number = Number.MAX_SAFE_INTEGER;
    totalCross: number = Number.MAX_SAFE_INTEGER;
    // Variaveis temporárias que não precisam ser copiadas
    tmp_position: number = 0;

    constructor(id: number, layerIndex: number) {
        this.id = id;
        this.layerIndex = layerIndex;
    }

    addOutEdge(edge: Edge) {
        this.outEdges[this.numOutEdges++] = edge;
    }
    addInEdge(edge: Edge) {
        this.inEdges[this.numInEdges++] = edge;
    }

    toString() {
        return `N[id:${this.id}, li:${this.layerIndex}, p:${this.position}, mc:${this.maxCross}]`;
    }
}

export class Layer {
    index: number;
    nodes: Node[];
    edges: Edge[];
    edgesAnt: Edge[];
    numNodes: number;
    numCross: number;

    constructor(index: number, nodes: Node[]) {
        let i: number = 0;
        let j: number = 0;

        this.index = index;
        this.nodes = nodes;
        this.numNodes = nodes.length;

        // Cria lista de arestas da camada e da camada anterior
        this.edges = [];
        this.edgesAnt = [];
        this.numCross = 0;
        for (i = 0; i < this.numNodes; i++) {
            for (j = 0; j < this.nodes[i].numOutEdges; j++) {
                this.edges.push(this.nodes[i].outEdges[j]);
                this.numCross += this.nodes[i].outEdges[j].numCross;
            }
            for (j = 0; j < this.nodes[i].numInEdges; j++) {
                this.edgesAnt.push(this.nodes[i].inEdges[j]);
            }
        }
    }

    /**
     * Retorna uma copia superficial da camada
     * @returns Layer
     */
    getCopy(seekNodes: Node[]): Layer {
        let i: number = 0;
        let j: number = 0;
        let lr = new Layer(this.index, []);
        lr.numNodes = this.numNodes;
        for (i = 0; i < this.numNodes; i++) {
            lr.nodes[i] = seekNodes[this.nodes[i].id - 1];
            lr.nodes[i].layerIndex = this.index;
            lr.nodes[i].position = i;
            lr.nodes[i].maxCross = this.nodes[i].maxCross;

            for (j = 0; j < this.nodes[i].numOutEdges; j++) {
                lr.nodes[i].outEdges[j].numCross = this.nodes[i].outEdges[j].numCross;
                //console.log(this.nodes[i].outEdges[j].toString());
                //console.log(lr.nodes[i].outEdges[j].toString());
            }
        }
        return lr;
    }

    simulateCrossV2(node: Node, testPosition: number, solution: Solution) {
        let i: number = 0;
        let j: number = 0;
        let k: number = 0;
        let pEdge: Edge[] = [];
        let aEdge: Edge[] = [];
        let nodeMap = Array.from(this.nodes);
        let nodeTmp: Node;
        let crossEdge = new Array<number>(NUM_EDGES).fill(0);
        // let crossEdge2 = new Array<number>(NUM_EDGES).fill(0);
        // let crossEdge3 = new Array<number>(NUM_EDGES).fill(0);
        let iscross: boolean;
        let totalCross: number = 0;

        let count = 0;

        // console.log('node.layerIndex',node.layerIndex)

        if (node.layerIndex !== this.index) {
            throw new Error("simulateCrossV2: Nó pertence a outra camada!");
        }

        // Pega referência pra lista de arestas da camada atual e anterior
        if (node.layerIndex > 0) {
            pEdge = solution.layers[node.layerIndex - 1].edges;
        }
        if (node.layerIndex < NUM_LAYERS - 1) {
            aEdge = solution.layers[node.layerIndex].edges;
        }

        // muda posição pra teste
        nodeTmp = nodeMap.splice(node.position, 1)[0];
        nodeMap.splice(testPosition, 0, nodeTmp);

        // Atualiza posição temporária
        for (i = 0; i < this.numNodes; i++) {
            nodeMap[i].tmp_position = i;
            //console.log(nodeMap[i].tmp_position ,nodeMap[i].position )
            count++;
        }

        // Calcula cruzamentos da camada anterior
        if (pEdge.length > 0) {
            for (i = 0; i < pEdge.length - 1; i++) {
                for (j = i + 1; j < pEdge.length; j++) {
                    if (pEdge[i].originId !== pEdge[j].originId) {
                        iscross = isCross(
                            solution.getNodeById(pEdge[i].originId).position,
                            solution.getNodeById(pEdge[i].destinationId).tmp_position,
                            solution.getNodeById(pEdge[j].originId).position,
                            solution.getNodeById(pEdge[j].destinationId).tmp_position
                        );
                        if (iscross) {
                            crossEdge[pEdge[i].id - 1] += 1;
                            crossEdge[pEdge[j].id - 1] += 1;
                        }
                    }
                    count++;
                }
            }
        }

        // Calcula cruzamentos da camada atual
        if (aEdge.length > 0) {
            for (i = 0; i < aEdge.length - 1; i++) {
                for (j = i + 1; j < aEdge.length; j++) {
                    if (aEdge[i].originId !== aEdge[j].originId) {
                        iscross = isCross(
                            solution.getNodeById(aEdge[i].originId).tmp_position,
                            solution.getNodeById(aEdge[i].destinationId).position,
                            solution.getNodeById(aEdge[j].originId).tmp_position,
                            solution.getNodeById(aEdge[j].destinationId).position
                        );
                        if (iscross) {
                            crossEdge[aEdge[i].id - 1] += 1;
                            crossEdge[aEdge[j].id - 1] += 1;
                        }
                    }
                }
                count++;
            }
        }

        //console.log('crossEdge 1',crossEdge1)
        //console.log('crossEdge 2',crossEdge2)
        // console.log('ant')
        for (i = 0; i < pEdge.length; i++) {
            //console.log('E:',pEdge[i].id, 'c:',pEdge[i].numCross)
            totalCross += crossEdge[pEdge[i].id - 1];
            count++;
        }

        //console.log('atual')

        for (i = 0; i < aEdge.length; i++) {
            // console.log('E:',aEdge[i].id, 'c:',aEdge[i].numCross)
            totalCross += crossEdge[aEdge[i].id - 1];
            count++;
        }

        //console.log('totalCross',totalCross);
        //console.log(solution.toString(false))

        //console.log('count v2',count)

        return { totalCross, fracaoAvaliacao: (this.edges.length + this.edgesAnt.length) / NUM_EDGES };
    }

    // simulateCrossV1(node: Node, testPosition: number, solution: Solution) {
    //     let i: number = 0;
    //     let j: number = 0;
    //     let k: number = 0;
    //     let nodeMap = Array.from(this.nodes);
    //     let nodeTmp: Node;
    //     let cEdge: Edge;
    //     let dEdge: Edge;
    //     let iscross: boolean;
    //     //let crossMap: {[key: string]: number} ={};
    //     let totalCross: number = 0;

    //     let count = 0;

    //     // muda posição pra teste
    //     nodeTmp = nodeMap.splice(node.position, 1)[0];
    //     nodeMap.splice(testPosition, 0, nodeTmp);
    //     let lb = Math.min(node.position, testPosition);
    //     let ub = Math.max(node.position, testPosition);

    //     // Atualiza posição temporária
    //     for (i = 0; i < this.numNodes; i++) {
    //         nodeMap[i].tmp_position = i;
    //         count++;
    //     }

    //     for (i = 0; i < this.numNodes; i++) {
    //         // Testa as arestas de saida na camada atual
    //         for (j = 0; j < nodeMap[i].numOutEdges; j++) {
    //             cEdge = nodeMap[i].outEdges[j];
    //             //crossMap[`${cEdge.originId}-${cEdge.destinationId}`] = 0;
    //             for (k = 0; k < this.edges.length; k++) {
    //                 dEdge = this.edges[k];
    //                 if (cEdge.originId !== dEdge.originId) {
    //                     iscross = isCross(
    //                         solution.getNodeById(cEdge.originId).tmp_position,
    //                         solution.getNodeById(cEdge.destinationId).position,
    //                         solution.getNodeById(dEdge.originId).tmp_position,
    //                         solution.getNodeById(dEdge.destinationId).position
    //                     );
    //                     //crossMap[`${cEdge.originId}-${cEdge.destinationId}`] += iscross ? 1 : 0;
    //                     totalCross += iscross ? 1 : 0;
    //                 }
    //                 count++;
    //             }
    //         }

    //         // Testa arestas de entrada na camada anterior
    //         for (j = 0; j < nodeMap[i].numInEdges; j++) {
    //             cEdge = nodeMap[i].inEdges[j];
    //             //crossMap[`${cEdge.originId}-${cEdge.destinationId}`] = 0;
    //             for (k = 0; k < this.edgesAnt.length; k++) {
    //                 dEdge = this.edgesAnt[k];
    //                 if (cEdge.destinationId !== dEdge.destinationId) {
    //                     iscross = isCross(
    //                         solution.getNodeById(cEdge.originId).position,
    //                         solution.getNodeById(cEdge.destinationId).tmp_position,
    //                         solution.getNodeById(dEdge.originId).position,
    //                         solution.getNodeById(dEdge.destinationId).tmp_position
    //                     );
    //                     //crossMap[`${cEdge.originId}-${cEdge.destinationId}`] += iscross ? 1 : 0;
    //                     totalCross += iscross ? 1 : 0;
    //                 }
    //                 count++;
    //             }
    //         }
    //     }

    //     return { totalCross, fracaoAvaliacao: (this.edges.length + this.edgesAnt.length) / NUM_EDGES };
    // }
}

export class Solution {
    id: number;
    nodes: Node[] = [];
    edges: Edge[] = [];
    layers: Layer[] = [];
    acoLayers: Layer[] = [];
    seek_nodes: Node[] = [];
    calcM: boolean = true;
    modified: boolean = true;
    totalCross: number = 0;
    totalCrossNormalized: number = 0;

    constructor(id: number, instanceData: InstanceData) {
        this.id = id;
        this.nodes = instanceData.nodes;
        this.edges = instanceData.edges;
        this.layers = instanceData.layers;
        this.acoLayers = Array.from(instanceData.layers);
        this.seek_nodes = Array.from(this.nodes);
        //this.calcAllNodeMaxCross();
    }

    clone(): Solution {
        let i: number;
        let j: number;
        let node: Node;
        let cloned = new Solution(this.id, getCopyOfInstanceData());
        // Copia ordem dos nós nas camadas
        for (i = 0; i < NUM_LAYERS; i++) {
            for (j = 0; j < this.layers[i].numNodes; j++) {
                node = this.layers[i].nodes[j];
                cloned.layers[i].nodes[j] = cloned.getNodeById(node.id);
                cloned.layers[i].nodes[j].position = j;
                cloned.layers[i].nodes[j].maxCross = node.maxCross;
            }
        }
        // Copia informação das arestas
        for (i = 0; i < NUM_EDGES; i++) {
            cloned.edges[i].numCross = this.edges[i].numCross;
        }

        // Ordena os nós do clone
        cloned.nodes.sort((a, b) => b.maxCross - a.maxCross);
        cloned.modified = this.modified;
        cloned.calcM = this.calcM;
        cloned.totalCross = this.totalCross;
        cloned.totalCrossNormalized = this.totalCrossNormalized;

        cloned.updateCrossInfo(this);

        return cloned;
    }

    /**
     * Calcula numero de cruzamentos para todos os nós
     * Complexidade estimada: O(N*E^2)
     */
    calcAllNodeMaxCross() {
        let i: number;
        let j: number;
        let node: Node;
        let edge: Edge;

        // Calcula valor de M da solução
        for (i = 0; i < NUM_NODES; i++) {
            node = this.nodes[i];
            for (j = 0; j < node.numOutEdges; j++) {
                edge = node.outEdges[j];
                calcCross(edge, this.layers[node.layerIndex], this);
            }
        }
        for (i = 0; i < NUM_NODES; i++) {
            // Calcula cruzamento máximo pra cada nó
            node = this.nodes[i];
            calcNodeMaxCross(node);
        }

        this.updateTotalCross();

        this.nodes.sort((a, b) => b.maxCross - a.maxCross);
    }

    updateTotalCross() {
        let i: number = 0;
        let j: number = 0;
        let k: number = 0;
        this.totalCross = 0;
        let layerCross: number;
        for (i = 0; i < NUM_LAYERS; i++) {
            layerCross = 0;
            for (j = 0; j < this.layers[i].nodes.length; j++) {
                this.layers[i].nodes[j].totalCross = 0;
                for (k = 0; k < this.layers[i].nodes[j].numOutEdges; k++) {
                    this.totalCross += this.layers[i].nodes[j].outEdges[k].numCross;
                    layerCross += this.layers[i].nodes[j].outEdges[k].numCross;
                    this.layers[i].nodes[j].totalCross += this.layers[i].nodes[j].outEdges[k].numCross;
                }
                for (k = 0; k < this.layers[i].nodes[j].numInEdges; k++) {
                    this.layers[i].nodes[j].totalCross += this.layers[i].nodes[j].inEdges[k].numCross;
                }
            }
            this.layers[i].numCross = layerCross;
        }
    }

    normalizeTotalCross(maxCross: number) {
        this.totalCrossNormalized = this.totalCross / (maxCross + 1.0);
    }

    updateLayer(layerIndex: number) {
        let i: number;
        let j: number;
        let node: Node;
        let edge: Edge;
        let inEdgeIndex: number = -1;

        if (!this.layers[layerIndex]) {
            console.log("layerIndex", layerIndex, "numLayers", this.layers.length);
            throw new Error("indice de camada inválido");
        }

        // Calcula valor de M da solução
        for (i = 0; i < this.layers[layerIndex].numNodes; i++) {
            node = this.layers[layerIndex].nodes[i];
            for (j = 0; j < node.numOutEdges; j++) {
                edge = node.outEdges[j];
                calcCross(edge, this.layers[layerIndex], this);
                inEdgeIndex = this.getNodeById(edge.destinationId).layerIndex;
            }
            // Calcula cruzamento máximo pra cada nó
            calcNodeMaxCross(node);
        }

        // Atualiza valores pra camada de entrada
        for (i = 0; i < this.layers[inEdgeIndex].numNodes; i++) {
            node = this.layers[inEdgeIndex].nodes[i];
            calcNodeMaxCross(node);
        }

        this.nodes.sort((a, b) => b.maxCross - a.maxCross);

        // retorna uma proporção do numero de nós pra contar na avaliação
        return this.layers[layerIndex].numNodes / NUM_NODES;
    }

    updateCrossInfo(fromSolution: Solution) {
        let i: number;
        for (i = 0; i < NUM_EDGES; i++) {
            this.edges[i].numCross = fromSolution.edges[i].numCross;
        }
        // Atualiza valores pra camada de entrada
        for (i = 0; i < NUM_NODES; i++) {
            this.seek_nodes[i].maxCross = fromSolution.seek_nodes[i].maxCross;
        }
        this.updateTotalCross();
    }

    getNodeById(nodeId: number): Node {
        if (nodeId <= 0 || nodeId > NUM_NODES) {
            throw new Error("getNodeById: nodeId out of range");
        }
        return this.seek_nodes[nodeId - 1];
    }

    getM(): number {
        return this.nodes[0].maxCross;
    }

    getMPenalizado(): number {
        return this.nodes[0].maxCross + this.totalCrossNormalized;
    }

    toString(showMaxCross: boolean = true) {
        let i: number;
        let str: string = "";
        str += "----" + this.id + "----\n";
        str += `M=${this.getM()}\n`;
        str += `Nodes=[${this.nodes.map((x) => x.id).join(", ")}]\n`;
        str += "Layers: <no(maxCross)>\n";
        for (i = 0; i < NUM_LAYERS; i++) {
            if (showMaxCross) {
                str += `${i}: [${this.layers[i].nodes.map((x) => `${x.id}(${x.maxCross})`).join(", ")}]\n`;
            } else {
                str += `${i} \t ${this.layers[i].nodes.map((x) => `${x.id}`).join(",")}\n`;
            }
        }
        return str;
    }
}

/////////////////////// Constantes ///////////////////////

export let NUM_NODES: number; // Número de nós da instância
export let NUM_EDGES: number; // Numero de arcos da instância
export let NUM_LAYERS: number; // Número de camadas da instância

/////////////////////// Dados da instância ///////////////////////

let instanceNodes: Node[];
let instanceLayers: Layer[];
let layersSizes: number[];

export interface InstanceData {
    nodes: Node[];
    edges: Edge[];
    layers: Layer[];
    layersSizes: number[];
}

export function getCopyOfInstanceData(): InstanceData {
    let i: number;
    let j: number = 0;
    let e: number = 0;
    let nodes: Node[] = new Array<Node>(NUM_NODES);
    let layers: Layer[] = new Array<Layer>(NUM_LAYERS);
    let edges: Edge[] = new Array<Edge>(NUM_EDGES);
    let tmpNode: Node;
    let tmpNodes: Node[];
    let tmpEdge: Edge;
    let originInd: number;
    let destinationInd: number;
    let edgeMap: number[][] = new Array<number[]>(NUM_EDGES);

    // Copia nós
    for (i = 0; i < NUM_NODES; i++) {
        tmpNode = instanceNodes[i];
        nodes[i] = new Node(tmpNode.id, -1);
        for (const edge of tmpNode.inEdges) {
            edgeMap[j++] = [edge.originId, edge.destinationId, edge.numCross];
        }
    }

    // Copia arestas
    for (i = 0; i < j; i++) {
        originInd = edgeMap[i][0] - 1;
        destinationInd = edgeMap[i][1] - 1;
        tmpEdge = new Edge(nodes[originInd], nodes[destinationInd]);
        tmpEdge.id = i + 1;
        nodes[originInd].addOutEdge(tmpEdge);
        nodes[destinationInd].addInEdge(tmpEdge);
        edges[e++] = tmpEdge;
    }

    // Copia camadas
    for (i = 0; i < NUM_LAYERS; i++) {
        tmpNodes = new Array<Node>(instanceLayers[i].numNodes);
        for (j = 0; j < instanceLayers[i].numNodes; j++) {
            originInd = instanceLayers[i].nodes[j].id - 1;
            tmpNodes[j] = nodes[originInd];
            tmpNodes[j].position = j;
            tmpNodes[j].layerIndex = i;
        }
        layers[i] = new Layer(i, tmpNodes);
        layers[i].numNodes = instanceLayers[i].numNodes;
    }

    return {
        nodes,
        edges,
        layers,
        layersSizes,
    };
}

/////////////////////// funções do problema ///////////////////////

export function readInstance(path: string) {
    let i: number;
    let j: number;
    let init: number;
    let end: number;
    let layerSize: number;
    let tmpNodes: Node[];
    let tmpEdge: Edge;

    let f = readFileSync(path);
    let linha = f.toString().split(/[\r\n]/);
    if (linha.length === 0) {
        throw new Error("file error");
    }

    let instanceInfo = linha[0].split(" ");
    NUM_NODES = parseInt(instanceInfo[0]);
    NUM_EDGES = parseInt(instanceInfo[1]);
    NUM_LAYERS = parseInt(instanceInfo[2]);

    // Inicializa nós
    instanceNodes = new Array(NUM_NODES);
    for (i = 0; i < NUM_NODES; i++) {
        instanceNodes[i] = new Node(i + 1, -1);
    }

    // Inicializa camadas
    let layerInfo = linha[1].split(" ");
    init = 0;
    instanceLayers = Array<Layer>(NUM_LAYERS);
    layersSizes = Array<number>(NUM_LAYERS);

    for (i = 0; i < NUM_LAYERS; i++) {
        layerSize = parseInt(layerInfo[i]);
        end = init + layerSize;
        tmpNodes = Array<Node>(layerSize);
        // pega referência dos nós da camada
        for (j = 0; j < layerSize; j++) {
            tmpNodes[j] = instanceNodes[init + j];
            tmpNodes[j].layerIndex = i;
            tmpNodes[j].position = j;
        }
        // Inicializa a camada
        layersSizes[i] = layerSize;
        instanceLayers[i] = new Layer(i, tmpNodes);
        init = end;
    }

    // Inicializa arestas (arcos)
    for (i = 0; i < NUM_EDGES; i++) {
        let edgeInfo = linha[i + 2].split(" ");
        // Obtem indices
        let originInd = parseInt(edgeInfo[0]) - 1;
        let destinationInd = parseInt(edgeInfo[1]) - 1;
        // Cria a aresta
        tmpEdge = new Edge(instanceNodes[originInd], instanceNodes[destinationInd]);
        tmpEdge.id = i + 1;
        // Atualiza nós
        instanceNodes[originInd].addOutEdge(tmpEdge);
        instanceNodes[destinationInd].addInEdge(tmpEdge);
    }

    //console.log(JSON.stringify(instanceNodes, null, 4));
}

/**
 * Seleciona entre as arestas de entrada e saída a aresta com o maior numero de
 * cruzamentos e define esse valor como o número máximo de cruzamentos do nó
 * @param node
 */
export function calcNodeMaxCross(node: Node) {
    let maxOutEdge: Edge | null = node.outEdges.reduce(
        (prev: Edge | null, current: Edge) => (prev && prev.numCross > current.numCross ? prev : current),
        null
    );
    let maxInEdge: Edge | null = node.inEdges.reduce(
        (prev: Edge | null, current: Edge) => (prev && prev.numCross > current.numCross ? prev : current),
        null
    );

    if (maxOutEdge && maxInEdge) {
        node.maxCross = Math.max(maxOutEdge.numCross, maxInEdge.numCross);
    } else if (maxInEdge) {
        node.maxCross = maxInEdge.numCross;
    } else if (maxOutEdge) {
        node.maxCross = maxOutEdge.numCross;
    } else {
        console.warn("Isolated Node!");
    }

    return node.outEdges.length + node.inEdges.length;
}

/***
 * check if (i,j) and (k, l) is a cross
 * @param i pos of the layer 1
 * @param j pos of the layer 1
 * @param k pos of the layer 2
 * @param l pos of the layer 2
 * @return whether is a cross
 */
export function isCross(i: number, j: number, k: number, l: number): boolean {
    return (i < k && j > l) || (i > k && j < l);
}

/**
 * Calcula o número máximo de cruzamentos de uma aresta em uma camada
 * e atualiza o valor na aresta
 * @param edge Aresta
 * @param layer Camada onde o nó de origem da aresta está
 */
export function calcCross(edge: Edge, layer: Layer, solution: Solution) {
    let lam: number = 0;
    let i: number;
    let j: number;
    let nodeTmp: Node;
    let edgeTmp: Edge;
    let iscross: boolean;

    for (i = 0; i < layer.numNodes; i++) {
        nodeTmp = layer.nodes[i];
        if (nodeTmp.id === edge.originId) continue;
        for (j = 0; j < nodeTmp.numOutEdges; j++) {
            edgeTmp = nodeTmp.outEdges[j];
            if (edgeTmp.destinationId === edge.destinationId) continue;
            iscross = isCross(
                solution.getNodeById(edge.originId).position,
                solution.getNodeById(edge.destinationId).position,
                solution.getNodeById(edgeTmp.originId).position,
                solution.getNodeById(edgeTmp.destinationId).position
            );
            lam += iscross ? 1 : 0;
        }
    }

    edge.numCross = lam;
}

/**
 * Checa se a solução é válida
 * @param solution
 */
export function checkSolution(solution: Solution, label: string = "") {
    let i: number;
    let j: number;
    let k: number;
    let l: number;
    let M: number = 0;
    let layerTmp: Layer;
    let nodeTmp: Node;
    let nodeP: Node;
    let edgeTmp: Edge;
    let edgeP: Edge;
    let currCross: number;
    let layerNodeIds: number[] = [];

    if (solution.nodes.length !== NUM_NODES) {
        console.log(label, solution.toString());
        throw new Error("Node length is different from instance");
    }

    // Checa a ordem dos nós na lista de nós da solução
    for (i = 0; i < NUM_NODES - 1; i++) {
        if (solution.nodes[i].maxCross < solution.nodes[i + 1].maxCross) {
            console.log(label, solution.toString());
            throw new Error("Nodes order error!");
        }
    }

    // Checa posição dos nós dentro da camada
    for (layerTmp of solution.layers) {
        i = 0;
        for (nodeTmp of layerTmp.nodes) {
            layerNodeIds.push(nodeTmp.id);
            if (nodeTmp.position !== i) {
                console.log(label, solution.toString());
                throw new Error("Node position error!");
            }
            i++;
        }
    }

    if (layerNodeIds.length !== NUM_NODES) {
        console.log(label, solution.toString());
        throw new Error("Node count on layers is different from instance");
    }

    // checa se todos os nós estão sendo atendidos nas camadas
    layerNodeIds.sort((a, b) => a - b);
    for (i = 0; i < NUM_NODES; i++) {
        if (layerNodeIds[i] !== i + 1) {
            let lb = i - 5;
            if (lb < 0) {
                lb = 0;
            } else if (lb + 10 >= NUM_NODES) {
                lb = NUM_NODES - 11;
            }
            console.log(label, solution.toString());
            throw new Error(`Node order error! [${layerNodeIds.splice(lb, 10).join(",")}]`);
        }
    }

    for (layerTmp of solution.layers) {
        for (nodeTmp of layerTmp.nodes) {
            for (edgeTmp of nodeTmp.outEdges) {
                i = solution.getNodeById(edgeTmp.originId).position;
                j = solution.getNodeById(edgeTmp.destinationId).position;
                currCross = 0;
                for (nodeP of layerTmp.nodes) {
                    if (nodeP.id === nodeTmp.id) continue;
                    for (edgeP of nodeP.outEdges) {
                        k = solution.getNodeById(edgeP.originId).position;
                        l = solution.getNodeById(edgeP.destinationId).position;
                        if (j == l) continue;
                        currCross += isCross(i, j, k, l) ? 1 : 0;
                    }
                }
                if (currCross !== edgeTmp.numCross) {
                    console.log(label, "-----------------");
                    console.error(
                        "Edge: " + edgeTmp.toString() + " currCross: " + currCross + ", e.cross: " + edgeTmp.numCross
                    );
                    //console.log(label, solution.toString());
                    console.log(solution.toString(false));
                    throw new Error("Cross error!");
                }
                if (
                    edgeTmp.numCross > solution.getNodeById(edgeTmp.originId).maxCross ||
                    edgeTmp.numCross > solution.getNodeById(edgeTmp.destinationId).maxCross
                ) {
                    console.log(label, "-----------------");
                    console.log(solution.toString(false));
                    console.error(
                        "Edge: " + edgeTmp.toString(),
                        "originMaxCross",
                        solution.getNodeById(edgeTmp.originId).maxCross,
                        "destinationMaxCross",
                        solution.getNodeById(edgeTmp.destinationId).maxCross
                    );
                    throw new Error("Cross consistency error!");
                }

                if (M < currCross) {
                    M = currCross;
                }
            }
        }
    }

    if (solution.nodes[0].maxCross !== M) {
        console.log(label, solution.toString());
        throw new Error("allNodes cross record error!");
    }
}

export function getNumMaxAvaliacoes(metodo: string) {
    if (metodo === "ga") {
        return 1000000; //NUM_NODES * NUM_EDGES / 10;
    } else {
        // aco
        return 10000; //NUM_NODES * NUM_EDGES / 10;
    }
}

const timeLimitRun = 78; // segundos
let timer: Date;
let bks: number = 0;
export function setBKS(inst_bks: number){
    bks = inst_bks;
}
export function initTimerRun() {
    timer = new Date();
}
export function getTimeElapsed() {
    let current: Date = new Date();
    return (current.getTime() - timer.getTime()) / 1000;
}
export function getTermination() {
    return getTimeElapsed() <= timeLimitRun;
}
/**
 * Termina a execução se a melhor solução da literatura for superada ou passarem 24h
 * @param bestM Melhor solução em andamento
 * @returns 
 */
export function getBKSTermination(bestM: number) {
    return bestM <= bks || getTimeElapsed() <= 20*60*60;
}

// tj   -  tjs
// 60   -   x

// 60 tjs = x tj

// 60 tjs / tj = x

// 60*11.8960766 / 9,151836 = 77.9914102482 ~= 78s
