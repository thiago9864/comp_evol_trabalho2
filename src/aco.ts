import prand from "pure-rand";
import {
    checkSolution,
    getBKSTermination,
    getCopyOfInstanceData,
    getTermination,
    getTimeElapsed,
    initTimerRun,
    InstanceData,
    Layer,
    Node,
    NUM_LAYERS,
    NUM_NODES,
    Solution,
} from "./mmac";
import { localSearch } from "./localSearch";

let prandInstance: prand.RandomGenerator;
/**
 * Returns a random integer in the interval min <= x <= max
 * @param min Min value to return
 * @param max Max value to return
 * @returns random number
 */
export function rand(min: number, max: number) {
    if (max === 0 || max - min === 0) {
        return 0;
    }

    if (min < 0) {
        console.error("min", min, "max", max);
        throw new Error("função rand não pode ter minimo negativo");
    }
    if (max < 0) {
        console.error("min", min, "max", max);
        throw new Error("função rand não pode ter máximo negativo");
    }
    if (min > max) {
        console.error("min", min, "max", max);
        throw new Error("função rand não pode ter máximo menor ou igual ao mínimo");
    }

    if (max > Number.MAX_SAFE_INTEGER) {
        console.error("min", min, "max", max);
        throw new Error("função rand: max é maior que Number.MAX_SAFE_INTEGER");
    }

    if (max > 1000000) {
        console.error("min", min, "max", max);
        throw new Error("teste");
    }

    let [r, rng] = prand.uniformIntDistribution(min, max, prandInstance);
    prandInstance = rng;
    return r;
}

/****** Variaveis do ACO ********/

let matrizFeromonio: number[][];
let matrizHeuristica: number[][];
let instaceDataRef: InstanceData;
let layerOffsetMap: number[];
let numAvaliacoes: number = 0;
let formigas: Formiga[];
let f_id: number = 1;
let bestSol: Solution | null;
let betaCalculado: number = 0;
let colonias: number = 0;

/****** Parâmetros  ********/

const Parametros = {
    // Taxa de decaimento do beta, que diminui a influência da heuristica com o tempo
    taxa_decai_beta: 0.05,
    //numero de formigas
    numeroDeFormigas: 60,
    // Feromonio
    feromonioInicial: 1.1,
    // Função de probabilidade
    alpha: 1.0, // Altera força do feromônio
    beta: 0.5, // Altera força da heurística
    // Atualizacao do feromônio
    gamma: 0.05, // Pega 5% das melhores soluções pra mandar pra atualização da matriz
    // Evaporação
    rho: 0.08,
    // Número de vezes que se aceita iterar sem melhora
    num_semMelhora: 20,
    // Número de formigas a serem perturbadas na metade pior da colônia quando
    // o numero de iterações sem melhora for alcançado
    numFormigasPerturbadas: 60,
    // Quantidade de nós perturbados em cada camada
    forcaPerturbacao: 0.1,
};

export function init_aco(seed: number) {
    let i: number;
    let j: number;

    // Inicia gerador pseudorandomico com a semente dada
    prandInstance = prand.xoroshiro128plus(seed);

    instaceDataRef = getCopyOfInstanceData();

    // Inicia matriz de feromônios e heuristica
    matrizFeromonio = new Array<number[]>(NUM_NODES);
    matrizHeuristica = new Array<number[]>(NUM_NODES);
    for (i = 0; i < NUM_NODES; i++) {
        matrizFeromonio[i] = new Array(NUM_NODES);
        matrizHeuristica[i] = new Array(NUM_NODES);
        for (j = 0; j < NUM_NODES; j++) {
            matrizFeromonio[i][j] = Parametros.feromonioInicial;
            matrizHeuristica[i][j] = Parametros.feromonioInicial;
        }
    }

    // Inicia indices de offset de posição das matrizes
    layerOffsetMap = new Array<number>(NUM_LAYERS).fill(0);
    for (i = 1; i < NUM_LAYERS; i++) {
        layerOffsetMap[i] = layerOffsetMap[i - 1] + instaceDataRef.layersSizes[i - 1];
    }

    // Inicia sem melhor solução
    bestSol = null;

    // Calcula heuristica
    heuristica();

    // inicia o array de formigas
    formigas = new Array<Formiga>(Parametros.numeroDeFormigas);

    betaCalculado = Parametros.beta;
    numAvaliacoes = 0;
    colonias = 0;
    initTimerRun();
}

export function run_aco() {
    let i: number;
    let melhorMLocal: number = Number.MAX_SAFE_INTEGER;
    let iteracoesSemMelhora: number = 0;
    let maxCross: number = 0;

    while (getTermination() && melhorMLocal !== 0) {
    //while (getBKSTermination(bestSol?.getM() ?? Number.MAX_SAFE_INTEGER) && melhorMLocal !== 0) {
        // Cria formigas
        maxCross = 0;
        for (i = 0; i < Parametros.numeroDeFormigas; i++) {
            formigas[i] = new Formiga();

            // Calcula função objetivo
            formigas[i].solucao.calcAllNodeMaxCross();
            //checkSolution(formigas[i].solucao);
            numAvaliacoes++;

            // Atualiza melhor formiga
            if (formigas[i].solucao.getM() < melhorMLocal) {
                melhorMLocal = formigas[i].solucao.getM();
                bestSol = formigas[i].solucao;
                console.log(
                    `melhorMLocal (aco)[${colonias}]`,
                    melhorMLocal,
                    `em: ${Math.round(getTimeElapsed() * 10) / 10} segundos`
                );
                iteracoesSemMelhora = -1;
                //checkSolution(bestSol,'na criação da colonia');
            }
        }

        if (iteracoesSemMelhora >= Parametros.num_semMelhora) {
            // decai a força da heuristica
            betaCalculado *= 1 - Parametros.taxa_decai_beta;
        }

        // Obtem a solução com o maior numero de cruzamentos
        for (i = 0; i < Parametros.numeroDeFormigas; i++) {
            if (formigas[i].solucao.totalCross > maxCross) {
                maxCross = formigas[i].solucao.totalCross;
            }
        }
        // Normaliza todas as formigas com o maior numero de cruzamentos
        for (i = 0; i < Parametros.numeroDeFormigas; i++) {
            formigas[i].solucao.normalizeTotalCross(maxCross);
        }

        // atualiza matriz de feromônios
        if (bestSol) {
            formigas.sort((a, b) => a.solucao.getMPenalizado() - b.solucao.getMPenalizado());
            atualizaFeromonio(formigas, bestSol);
        }

        aplicaPerturbacao();

        // Aplica busca local
        for (i = 0; i < Parametros.numeroDeFormigas; i++) {
            formigas[i].solucao = localSearch(formigas[i].solucao);

            // Atualiza melhor formiga
            if (formigas[i].solucao.getM() < melhorMLocal) {
                melhorMLocal = formigas[i].solucao.getM();
                bestSol = formigas[i].solucao;
                console.log(
                    `melhorMLocal (aco)[${colonias}]`,
                    melhorMLocal,
                    `em: ${Math.round(getTimeElapsed() * 10) / 10} segundos`
                );
                iteracoesSemMelhora = -1;
            }
        }

        iteracoesSemMelhora++;
        colonias++;
        if(colonias % 10 === 0){
            console.log('colonia',colonias,'iniciada');
        }
    }
}

class Formiga {
    solucao: Solution;

    constructor() {
        this.solucao = new Solution(f_id++, getCopyOfInstanceData());
        this.criarSolucao();
    }

    criarSolucao() {
        let i: number;
        let j: number;
        let k: number;
        let p: number;
        let mi: IndicesMatrizType;
        let pMax: number;
        let pBaixo: number;
        let prob: number;
        let tmp: number;

        let layer: Layer;
        let layerNodes: Node[];
        let node: Node;
        let pAcc: number[] = [];
        let posicoes: number[];

        for (i = 0; i < NUM_LAYERS; i++) {
            layer = this.solucao.acoLayers[i];
            layerNodes = new Array<Node>(layer.numNodes);
            posicoes = new Array<number>(layer.numNodes);
            for (j = 0; j < layer.numNodes; j++) {
                posicoes[j] = j;
            }
            for (j = 0; j < layer.numNodes; j++) {
                node = layer.nodes[j];
                pMax = 0;
                pBaixo = 0;
                pAcc = [0];

                // calcula parte de baixo da função da roleta
                for (k = j; k < layer.numNodes; k++) {
                    mi = geraIndicesMatriz(layer.nodes[k].id, k, i);
                    tmp = Math.pow(matrizFeromonio[mi.i][mi.j], Parametros.alpha);
                    tmp *= Math.pow(matrizHeuristica[mi.i][mi.j], betaCalculado);
                    pBaixo += tmp;
                }

                // calcula a parte de cima da probabilidade pra todos os nós que ainda não entraram
                for (k = j; k < layer.numNodes; k++) {
                    mi = geraIndicesMatriz(layer.nodes[k].id, k, i);
                    tmp = Math.pow(matrizFeromonio[mi.i][mi.j], Parametros.alpha);
                    tmp *= Math.pow(matrizHeuristica[mi.i][mi.j], betaCalculado);
                    if (pBaixo > 0) {
                        pMax += tmp / pBaixo;
                    } else {
                        pMax += 1;
                    }
                    // arredonda pra 3 casas decimais antes de colocar no array acumulado
                    pAcc.push(Math.round(pMax * 1000) / 1000);
                }

                // sorteia um numero no intervalo de [0, pMax]
                prob = (rand(0, 10000) / 10001) * pMax;

                // Faz uma busca binaria no array acumulado
                p = 0;
                k = pAcc.length;
                while (k - p > 1) {
                    tmp = Math.floor((k + p) / 2);
                    if (prob > pAcc[tmp]) {
                        // item está na metade maior
                        p = tmp;
                    } else if (prob < pAcc[tmp]) {
                        // item está na metade menor
                        k = tmp;
                    } else {
                        // por acaso achou igual
                        break;
                    }
                }

                // insere o nó na posição escolhida
                node.position = posicoes[p];
                layerNodes[posicoes[p]] = node;
                posicoes.splice(p, 1);
            }

            if (posicoes.length !== 0) {
                console.log("pAcc", pAcc);
                console.log("posicoes", posicoes);
                console.log("layerNodes", layerNodes.map((x) => x.id).join(","));
                throw new Error("Nem todas as posições foram alocadas");
            }

            this.solucao.layers[i].nodes = layerNodes;
        }
    }
}

interface IndicesMatrizType {
    i: number;
    j: number;
}

function geraIndicesMatriz(nodeId: number, nodePosition: number, layerIndex: number): IndicesMatrizType {
    let mi = {
        i: nodeId - 1,
        j: nodePosition + layerOffsetMap[layerIndex],
    };
    if (mi.i < 0 || mi.i >= NUM_NODES) {
        throw new Error("Indice i da matriz de feromônio fora da matriz");
    }
    if (mi.j < 0 || mi.j >= NUM_NODES) {
        throw new Error("Indice j da matriz de feromônio fora da matriz");
    }
    return mi;
}

function atualizaFeromonio(formigas: Formiga[], bestSol: Solution) {
    let i: number;
    let j: number;
    let k: number;
    let layer: Layer;
    let node: Node;
    let mi: IndicesMatrizType;

    // Evaporação
    for (i = 0; i < NUM_NODES; i++) {
        for (j = 0; j < NUM_NODES; j++) {
            matrizFeromonio[i][j] = (1 - Parametros.rho) * matrizFeromonio[i][j];
            matrizFeromonio[i][j] += Parametros.rho * Parametros.feromonioInicial;
        }
    }

    // Pega informações das 'gamma' melhores formigas
    let ref = 1 / bestSol.getM();
    let posicoes: IndicesMatrizType[] = [];
    for (k = 0; k < Math.round(Parametros.gamma * Parametros.numeroDeFormigas); k++) {
        // Calcula o quanto vai reforçar o feromônio
        ref += 1.0 / (formigas[k].solucao.getM() * 2.0);
        // Salva posições unicas visitadas por essas formigas
        for (i = 0; i < NUM_LAYERS; i++) {
            layer = formigas[k].solucao.layers[i];
            for (j = 0; j < layer.numNodes; j++) {
                node = layer.nodes[j];
                mi = geraIndicesMatriz(node.id, node.position, i);
                if (posicoes.findIndex((x) => x.i == mi.i && x.j == mi.j) === -1) {
                    posicoes.push(mi);
                }
            }
        }
    }
    ref /= 2;

    // Reforço nas posições escolhidas pelas melhores formigas
    for (j = 0; j < posicoes.length; j++) {
        mi = posicoes[j];
        matrizFeromonio[mi.i][mi.j] += ref;
    }
}

/**
 * Gera perturbação em todas as soluções da população dependendo da força
 * definida por parâmetro
 */
function aplicaPerturbacao() {
    let i: number;
    let j: number;
    let ini: number;
    let fim: number;
    let layer: Layer;

    for (i = 0; i < Parametros.numeroDeFormigas; i++) {
        for (j = 0; j < NUM_LAYERS; j++) {
            layer = formigas[i].solucao.layers[j];
            ini = rand(0, Math.round(layer.numNodes * (1 - Parametros.forcaPerturbacao)));
            fim = ini + Math.floor(layer.numNodes * Parametros.forcaPerturbacao);
            shuffleNodes(layer.nodes, ini, fim);
        }
        formigas[i].solucao.calcAllNodeMaxCross();
    }
}

/**
 * Usa a melhor solução inicial como informação heurística, se não houver uma
 * melhor solução, usa a padrão
 */
function heuristica() {
    let i: number;
    let j: number;
    let node: Node;
    let mi: IndicesMatrizType;

    if (!bestSol) {
        bestSol = new Solution(f_id++, instaceDataRef);
        bestSol.calcAllNodeMaxCross();
        bestSol = localSearch(bestSol);
    }

    for (i = 0; i < NUM_LAYERS; i++) {
        for (j = 0; j < bestSol.layers[i].numNodes; j++) {
            node = bestSol.layers[i].nodes[j];
            mi = geraIndicesMatriz(node.id, node.position, i);
            matrizHeuristica[mi.i][mi.j] += Parametros.feromonioInicial;
        }
    }
}

/**
 * Permuta um intervalo especifico num array de nós
 * @param arr
 * @param inicio
 * @param fim
 * @returns
 */
function shuffleNodes(arr: Node[], inicio: number, fim: number) {
    let i: number;
    let rndIndex: number;
    let tmp: Node;

    for (i = inicio; i < fim - 1; i++) {
        rndIndex = rand(0, fim - i - 1);
        // Armazena posição A
        tmp = arr[i];
        // Substitui nó A pelo B
        arr[i] = arr[i + rndIndex];
        arr[i].position = i;
        // Substitui nó B pelo A armazenado
        arr[i + rndIndex] = tmp;
        arr[i + rndIndex].position = i + rndIndex;
    }

    return arr;
}

export function getBestSolAco(): Solution | null {
    return bestSol;
}

export function getColonias(): number {
    return colonias;
}
