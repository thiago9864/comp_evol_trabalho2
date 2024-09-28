import prand from "pure-rand";
import {
    checkSolution,
    getBKSTermination,
    getCopyOfInstanceData,
    getTermination,
    getTimeElapsed,
    initTimerRun,
    Layer,
    Node,
    NUM_EDGES,
    NUM_LAYERS,
    NUM_NODES,
    Solution,
} from "./mmac";

let prandInstance: prand.RandomGenerator;

/**
 * Returns a random integer in the interval min <= x <= max
 * @param min Min value to return
 * @param max Max value to return
 * @returns random number
 */
export function rand(min: number, max: number) {
    if (max === 0) {
        return 0;
    }
    let [r, rng] = prand.uniformIntDistribution(min, max, prandInstance);
    prandInstance = rng;
    return r;
}

/****** Variaveis do algoritmo genético ********/

let population: Solution[];
let populationSelected: Solution[];
let bestSol: Solution | null;
let bestM: number = Number.MAX_SAFE_INTEGER;
let numIndividuosSelecionados: number = 0;
let p_id: number = 1;
let m: number;
let numAvaliacoes: number = 0;
let geracoesSemMelhora: number = 0;
let geracao: number = 0;
let limiteGeracoesSemMelhora: number = 0;
let limite1: boolean = false;

/****** Parâmetros  ********/

const Parameters = {
    populationSize: 200,
    selectedPopulationSize: 40,

    // Numero de gerações que considera preso em minimo local
    // quando o número de arcos é >= 5000
    minGeracoesSemMelhora: 1,

    // Numero de gerações que considera preso em minimo local
    // quando o número de arcos é <= 50
    maxGeracoesSemMelhora: 80,

    // Proporção das camadas com mais cruzamentos que vai passar
    // pela mutação do baricentro (mutação 1) (camadas * numLayers)
    camadasMutacaoBaricentro: 0.5,

    // Valor pra busca regular
    profundidadeMutacao2Inicial: 0.5,
    // Valor de busca quando está preso em um minimo local (profundidade * numNosCamada)
    profundidadeMutacao2Preso: 1.0,

    // Quantidade de nós perturbados em cada camada (porcentagem * numNosCamada)
    forcaPerturbacao: 0.1,
};

export function init_ga(seed: number) {
    // Inicia gerador pseudorandomico com a semente dada
    prandInstance = prand.xoroshiro128plus(seed);

    // Cria a população
    p_id = 1;
    numAvaliacoes = 0;
    population = geraSolucoesAleatorias(Parameters.populationSize);

    // inicializa população selecionada
    populationSelected = [];
    numIndividuosSelecionados = 0;
    geracoesSemMelhora = 0;
    geracao = 0;

    // Calcula limite de gerações p/ considerar preso no minimo local
    let a = (Parameters.maxGeracoesSemMelhora - Parameters.minGeracoesSemMelhora) / (50 - 2000);
    //let b = Parameters.maxGeracoesSemMelhora - a * 50;

    limiteGeracoesSemMelhora = Math.round(Math.exp(a * 0.35 * NUM_EDGES) * Parameters.maxGeracoesSemMelhora);

    // Mantem o limite em pelo menos 1 geração
    if (limiteGeracoesSemMelhora <= 0) {
        limiteGeracoesSemMelhora = 1;
    }

    console.log("limiteGeracoesSemMelhora:", limiteGeracoesSemMelhora);

    bestSol = null;
    bestM = Number.MAX_SAFE_INTEGER;
    initTimerRun();
}

export function run_ga() {
    while (getTermination() && bestM !== 0) {
    //while (getBKSTermination(bestM) && bestM !== 0) {
        if (geracoesSemMelhora > limiteGeracoesSemMelhora && !limite1) {
            limite1 = true;
            //console.log("Modo de mutação mais agressivo na geração", geracao);
        } else if (geracoesSemMelhora < limiteGeracoesSemMelhora && limite1) {
            limite1 = false;
            //console.log('Sai do modo mais agressivo');
        }

        avaliar();
        selecionar();
        crossover();
        mutacao();
        mutacao2();
        substituicao();
        geracao++;
        if(geracao % 10 === 0){
            console.log('geracao',geracao,'iniciada');
        }
    }
}

function avaliar() {
    let maxCross: number = 0;
    let bestSolLocal: Solution | null = null;
    let bestMLocal: number = Number.MAX_SAFE_INTEGER;

    // Calcula função objetivo, se necessário e obtem a melhor solução
    // até esse ponto
    for (m = 0; m < Parameters.populationSize; m++) {
        if (population[m].calcM) {
            population[m].calcAllNodeMaxCross();
            population[m].calcM = false;
            population[m].modified = false;
            numAvaliacoes++;
        }
        if (population[m].getM() < bestMLocal) {
            bestSolLocal = population[0].clone();
            bestMLocal = population[m].getM();
        }
        // checkSolution(
        //     population[m],
        //     `geração [${geracao}] checagem de solução (antes da perturbação) de id: ${population[m].id}`
        // );
    }

    // Aplica perturbação na população
    perturbarPopulacao();

    // Calcula a função objetivo pra toda a população
    for (m = 0; m < Parameters.populationSize; m++) {
        // population[m].calcAllNodeMaxCross();
        // population[m].calcM = false;
        // population[m].modified = false;
        // numAvaliacoes++;

        if (population[m].totalCross > maxCross) {
            maxCross = population[m].totalCross;
        }
    }

    // Normaliza total cross da solução pra ser usado como termo de penalização
    for (m = 0; m < Parameters.populationSize; m++) {
        population[m].normalizeTotalCross(maxCross);
        //checkSolution(population[m], `geração [${geracao}] checagem de solução de id: ${population[m].id}`);
    }

    // Ordena população com base na penalização
    population.sort((a, b) => a.getMPenalizado() - b.getMPenalizado());

    // Armazena melhor solução
    if (!bestSol || population[0].getM() < bestSol.getM()) {
        if (bestMLocal < population[0].getM()) {
            // A solução anterior a perturbação é melhor
            bestSol = bestSolLocal;
            bestM = bestMLocal;
        } else {
            // A solução depois da perturbação é melhor
            bestSol = population[0].clone();
            bestM = bestSol.getM();
        }
        console.log(`melhorMLocal (ga)[${geracao}]`, bestM, `em: ${Math.round(getTimeElapsed() * 10) / 10} segundos`);
        geracoesSemMelhora = -1;
    }
    geracoesSemMelhora++;
}

/**
 * Faz uma seleção por torneio pegando individuos de 3 em 3
 * em toda a população. Os vencedores não voltam a ser chamados
 */
function selecionar() {
    let j = 0;
    let s = 0;
    let c_sel: number[] = [];
    let c_win: number;
    let visited = new Array<boolean>(Parameters.populationSize).fill(false);

    // Inicializa lista de selecionados
    populationSelected = new Array<Solution>(Parameters.selectedPopulationSize);
    numIndividuosSelecionados = 0;

    while (s < Parameters.selectedPopulationSize) {
        // Seleciona três individuos em toda a população que
        // ainda não foram visitados
        c_sel = [];
        while (c_sel.length < 3) {
            j = rand(0, Parameters.populationSize - 1);
            if (!c_sel.includes(j) && !visited[j]) {
                c_sel.push(j);
            }
        }

        // Compara 0 e 1
        if (population[c_sel[0]].getMPenalizado() <= population[c_sel[1]].getMPenalizado()) {
            c_win = c_sel[0];
        } else {
            c_win = c_sel[1];
        }
        // Comparara o vendedor entre 0 e 1 com 2
        if (population[c_sel[2]].getMPenalizado() <= population[c_win].getMPenalizado()) {
            c_win = c_sel[2];
        }

        // salva cópia do individuo vencedor do torneio
        populationSelected[numIndividuosSelecionados++] = population[c_win].clone();
        populationSelected[numIndividuosSelecionados - 1].modified = true;

        // Marca vencedor como visitado
        visited[c_win] = true;
        s++;
    }
}

/**
 * Crossover que pega dois individuos, define um ponto de corte na lista de camadas
 * e cria uma solução filha com informações dos dois pais;
 */
function crossover() {
    let i = 0;
    let j = 0;
    let pai_a: Solution;
    let pai_b: Solution;
    let filho_a: Solution;
    let filho_b: Solution;
    let l_sel: number;
    let destLayerA: number = -1;
    let destLayerB: number = -1;
    let outLayer: number = -1;
    let inLayer: number = -1;

    let numIndividuosTorneio = numIndividuosSelecionados;

    for (i = 0; i < Math.floor(numIndividuosTorneio / 2); i += 1) {
        pai_a = populationSelected[i];
        pai_b = populationSelected[numIndividuosTorneio - 1 - i];

        if (pai_a.id === pai_b.id) {
            break;
        }

        // Cria solução filha
        filho_a = new Solution(p_id++, getCopyOfInstanceData());
        filho_b = new Solution(p_id++, getCopyOfInstanceData());

        // Ponto de corte, aproximadamente no meio
        l_sel = Math.floor(NUM_LAYERS / 2);

        // Copia camadas para o filho
        for (j = 0; j < NUM_LAYERS; j++) {
            if (j < l_sel) {
                filho_a.layers[j] = pai_a.layers[j].getCopy(filho_a.seek_nodes);
                filho_b.layers[j] = pai_b.layers[j].getCopy(filho_b.seek_nodes);
            } else {
                filho_a.layers[j] = pai_b.layers[j].getCopy(filho_a.seek_nodes);
                filho_b.layers[j] = pai_a.layers[j].getCopy(filho_b.seek_nodes);
            }
        }

        // Obtem a camada de destino da camada anterior a selecionada
        for (const n of filho_a.layers[l_sel - 1].nodes) {
            if (n.numOutEdges > 0) {
                for (const edge of n.outEdges) {
                    if (edge.destinationId) {
                        destLayerA = filho_a.getNodeById(edge.destinationId).layerIndex;
                        break;
                    }
                }
                break;
            }
        }

        // Obtem a camada de destino da camada selecionada
        for (const n of filho_a.layers[l_sel].nodes) {
            if (n.numOutEdges > 0) {
                for (const edge of n.outEdges) {
                    if (edge.destinationId) {
                        destLayerB = filho_a.getNodeById(edge.destinationId).layerIndex;
                        break;
                    }
                }
                break;
            }
        }

        // Verifica qual é a camada de destino, se é a camada selecionada ou a anterior a ela
        if (l_sel === destLayerA) {
            outLayer = l_sel - 1;
            inLayer = l_sel;
        } else if (l_sel - 1 === destLayerB) {
            outLayer = l_sel;
            inLayer = l_sel - 1;
        }

        // Atualiza a camada de saída (a camada de onde os arcos saem)
        numAvaliacoes += filho_a.updateLayer(outLayer);
        filho_a.calcM = false;
        filho_a.updateTotalCross();

        numAvaliacoes += filho_b.updateLayer(outLayer);
        filho_b.calcM = false;
        filho_b.updateTotalCross();

        // inclui o filho gerado na lista de soluções
        populationSelected[numIndividuosSelecionados++] = filho_a;
        populationSelected[numIndividuosSelecionados++] = filho_b;
    }
}

/**
 * Mutação com heurística do baricentro. Pra cada solução escolhe um nó aleatório com base em
 * uma lista de candidatos construida com as 'n' camadas com mais cruzamentos, onde 'n' é dado
 * por um parâmetro
 */
function mutacao() {
    let i = 0;
    let j = 0;
    let k = 0;
    let p = 0;
    let sol: Solution;
    let node: Node;
    let nodeLayer: Layer;
    let b_out: number;
    let b_in: number;
    let nova_posicao: number = -1;
    let encontrouInsercao: boolean = false;
    let visitados: boolean[];
    let indEscolhido: number;
    let numVisitados: number = 0;
    let camadasPorCruzamentos: Layer[];
    let candidatos: Node[];
    let numCamadas: number = Math.round(Parameters.camadasMutacaoBaricentro * NUM_LAYERS);
    let cont = 0;

    // sempre escolhe pelo menos uma camada
    if (numCamadas < 1) {
        numCamadas = 1;
    }

    for (i = 0; i < numIndividuosSelecionados; i++) {
        sol = populationSelected[i];
        visitados = new Array<boolean>(NUM_NODES).fill(false);
        candidatos = new Array<Node>(NUM_NODES);
        cont = 0;
        encontrouInsercao = false;
        numVisitados = 0;
        camadasPorCruzamentos = Array.from(sol.layers);
        camadasPorCruzamentos.sort((a, b) => b.numCross - a.numCross);

        // Define como candidatos os nós das n camadas com mais cruzamentos
        p = 0;
        for (j = 0; j < numCamadas; j++) {
            if (camadasPorCruzamentos[j].numCross === 0) {
                // Ignora camadas onde não há cruzamentos
                continue;
            }
            for (k = 0; k < camadasPorCruzamentos[j].numNodes; k++) {
                candidatos[p++] = camadasPorCruzamentos[j].nodes[k];
            }
        }

        // Se não passar nenhum nó como candidato, não aplica a mutação a essa solução
        if (p === 0) {
            continue;
        }
        k = 0;

        while (!encontrouInsercao && numVisitados < p) {
            // Escolhe um nó aleatório na lista de candidatos
            indEscolhido = rand(0, p - 1);
            node = candidatos[indEscolhido];

            cont++;

            if (cont > NUM_NODES * 2) {
                throw new Error("Loop infinito!");
            }
            //console.log('numVisitados',numVisitados)

            if (visitados[node.id - 1]) {
                // Se esse nó já tiver sido visitado, ignora e tenta ir pro próximo
                continue;
            }

            // E pega qual camanda esse nó pertence
            nodeLayer = sol.layers[node.layerIndex];

            b_out = 0;
            if (node.numOutEdges > 0) {
                // Calcula baricentro com a camada na direção de saída fixada
                for (j = 0; j < node.numOutEdges; j++) {
                    b_out += sol.getNodeById(node.outEdges[j].destinationId).position;
                }
                b_out /= node.numOutEdges;
            } else {
                b_out = -1;
            }

            b_in = 0;
            if (node.numInEdges > 0) {
                // Calcula baricentro com a camada na direção de entrada fixada
                for (j = 0; j < node.numInEdges; j++) {
                    b_in += sol.getNodeById(node.inEdges[j].originId).position;
                }
                b_in /= node.numInEdges;
            } else {
                b_in = -1;
            }

            if (b_out >= 0 && b_in >= 0) {
                // Consolida as medias
                nova_posicao = Math.round((b_out + b_in) / 2);
            } else if (b_out >= 0) {
                // Usa a media da camada de saída
                nova_posicao = Math.round(b_out);
            } else {
                // Usa a média da camada de entrada
                nova_posicao = Math.round(b_in);
            }

            if (nova_posicao >= 0 && nova_posicao !== node.position) {
                // Faz a inserção do nó na nova posição
                node = nodeLayer.nodes.splice(node.position, 1)[0];
                nodeLayer.nodes.splice(nova_posicao, 0, node);
                encontrouInsercao = true;
                let layerEnt: number = -1;

                // atualiza posições da camada
                for (j = 0; j < nodeLayer.numNodes; j++) {
                    nodeLayer.nodes[j].position = j;
                    if (nodeLayer.nodes[j].numInEdges > 0) {
                        layerEnt = sol.getNodeById(nodeLayer.nodes[j].inEdges[0].originId).layerIndex;
                    }
                }

                if (nodeLayer.index === 0) {
                    // só atualiza a própria camada
                    numAvaliacoes += sol.updateLayer(nodeLayer.index);
                } else if (nodeLayer.index === NUM_LAYERS - 1) {
                    // só atualiza a camada de entrada (anterior)
                    numAvaliacoes += sol.updateLayer(layerEnt);
                } else {
                    // atualiza a atual e de entrada
                    numAvaliacoes += sol.updateLayer(nodeLayer.index);
                    numAvaliacoes += sol.updateLayer(layerEnt);
                }
                sol.calcM = false;
                sol.updateTotalCross();
            }

            // E se for a mesma posição, escolhe outro nó aleatoriamente
            visitados[node.id - 1] = true;
            numVisitados++;
        }

        if (!encontrouInsercao) {
            console.log("Não fez a mutação");
        }
    }
}

/**
 * Mutação que pega um nó aleatório de uma camada que tenha algum cruzamento de nós
 * e tenta mover ele dentro até achar uma posição que reduza a contagem de cruzamentos
 */
function mutacao2() {
    let i = 0;
    let j = 0;
    let k = 0;
    let p = 0;
    let sol: Solution;
    let p_sel: number = -1;
    let layer: Layer | null;
    let numIteracoes: number;
    let node: Node | null;
    let simResult: { totalCross: number; fracaoAvaliacao: number };
    let baseCross: number;
    let totalAvaliacao: number = 0;
    let maxSizeLayer: number;
    let numVisitados: number;
    let numCandidatos: number;
    let encontrouInsercao: boolean = false;
    let visitados: boolean[];
    let profundidade: number; // Raio de ação da mutação
    let test_dir: number;
    let test_esq: number;
    let tmp_cross: number;
    let p_dir: number;
    let p_esq: number;

    for (i = 0; i < numIndividuosSelecionados; i++) {
        sol = populationSelected[i];

        numVisitados = 0;
        numCandidatos = NUM_NODES - 1;
        visitados = new Array(NUM_NODES).fill(false);
        encontrouInsercao = false;
        p_sel = -1;
        numIteracoes = 0;
        node = null;
        layer = null;

        if (sol.totalCross === 0) {
            continue;
        }

        // Pega o maior tamanho de camada presente na solução
        maxSizeLayer = sol.layers[0].numNodes;
        for (j = 1; j < NUM_LAYERS; j++) {
            if (sol.layers[j].numNodes > maxSizeLayer) {
                maxSizeLayer = sol.layers[j].numNodes;
            }
        }
        j = 0;

        // Profundidade de ação da busca em modo de busca local fina
        profundidade = Math.floor(maxSizeLayer * Parameters.profundidadeMutacao2Inicial);

        if (limite1) {
            // Se estiver preso em um minimo local, deixa a busca mais agressiva
            profundidade = Math.floor(maxSizeLayer * Parameters.profundidadeMutacao2Preso);
        }

        while (!encontrouInsercao && numVisitados < numCandidatos) {
            numIteracoes++;

            // Escolhe um nó baseado numa roleta onde a probabilidade
            // é dada pelo total de cruzamentos de cada nó
            p = rand(0, sol.totalCross * 2 + NUM_NODES);
            k = 0;
            for (j = 0; j < NUM_NODES; j++) {
                k += sol.nodes[j].totalCross + 1;
                if (k >= p) {
                    node = sol.nodes[j];
                    layer = sol.layers[node.layerIndex];
                    break;
                }
            }
            j = 0;

            if (!node || !layer) {
                throw new Error("roleta da mutação 2 não encontrou um nó");
            }

            // Pula os nós já visitados
            if (visitados[node.id - 1]) {
                continue;
            }

            // Calcula total de cruzamentos antes da mutação
            simResult = layer.simulateCrossV2(node, node.position, sol);
            baseCross = simResult.totalCross;
            totalAvaliacao += simResult.fracaoAvaliacao;

            // Se não tiver nenhum cruzamento, ignora e vai pra próxima solução
            if (baseCross === 0) {
                break;
            }

            test_dir = baseCross;
            test_esq = baseCross;
            tmp_cross = baseCross;

            // Procura a esquerda e a direita em profundidade a melhor posição pra colocar o nó
            for (j = 1; j <= profundidade; j++) {
                p_esq = node.position - j;
                p_dir = node.position + j;
                if (p_esq >= 0) {
                    // Testa pra esquerda
                    simResult = layer.simulateCrossV2(node, p_esq, sol);
                    totalAvaliacao += simResult.fracaoAvaliacao;
                    test_esq = simResult.totalCross;
                }
                if (p_dir <= layer.numNodes - 1) {
                    // Testa pra direita
                    simResult = layer.simulateCrossV2(node, p_dir, sol);
                    totalAvaliacao += simResult.fracaoAvaliacao;
                    test_dir = simResult.totalCross;
                }
                if (test_esq < test_dir) {
                    tmp_cross = test_esq;
                    p_sel = p_esq;
                } else if (test_esq > test_dir) {
                    tmp_cross = test_dir;
                    p_sel = p_dir;
                } else {
                    tmp_cross = test_dir;
                    p_sel = p_dir;
                }
            }

            // Se não conseguiu diminuir o numero de cruzamentos, não move o nó
            if (tmp_cross >= baseCross) {
                p_sel = -1;
            }

            if (p_sel >= 0) {
                // Faz a inserção do nó na nova posição
                node = layer.nodes.splice(node.position, 1)[0];
                layer.nodes.splice(p_sel, 0, node);
                encontrouInsercao = true;

                // atualiza posições da camada
                for (j = 0; j < layer.numNodes; j++) {
                    layer.nodes[j].position = j;
                }

                numAvaliacoes += totalAvaliacao;

                if (layer.index === 0) {
                    // só atualiza a própria camada
                    numAvaliacoes += sol.updateLayer(layer.index);
                } else if (layer.index === NUM_LAYERS - 1) {
                    // só atualiza a camada de entrada (anterior)
                    numAvaliacoes += sol.updateLayer(layer.index - 1);
                } else {
                    // atualiza a atual e de entrada
                    numAvaliacoes += sol.updateLayer(layer.index);
                    numAvaliacoes += sol.updateLayer(layer.index - 1);
                }

                sol.modified = true;
                sol.calcM = false;
                sol.updateTotalCross();
            }
            visitados[node.id - 1] = true;
            numVisitados++;
        }
    }
}

/**
 * Faz a substituição das soluções que passaram por recombinação e mutação
 * Primeiro tenta substituir as repetidas, se ainda tiver soluções pra substituir
 * coloca aleatoriamente na parte inferior (a parte das piores soluções)
 */
function substituicao() {
    let i = 0;
    let j = 0;
    let p: number | undefined;
    let prevM: number;
    let sol: Solution | undefined;
    let indRepetidos: number[] = [];
    let numIndRepetidos: number = 0;
    let visited = new Array<boolean>(Parameters.populationSize).fill(false);

    // Detecta intervalos onde 2 soluções não modificadas ou mais tem valores de M iguais
    prevM = population[0].getM();
    for (i = 1; i < Parameters.populationSize; i++) {
        sol = population[i];
        if (!sol.modified && sol.getM() - prevM < 0.1) {
            indRepetidos.push(i);
            numIndRepetidos++;
            visited[i] = true;
        }
        prevM = sol.getM();
    }

    // Substitui soluções modificadas pelas que estão repetidas na população
    while (numIndRepetidos > 0 && numIndividuosSelecionados > 0) {
        p = indRepetidos.shift();
        if (p) {
            sol = populationSelected.shift();
            if (sol) {
                population[p] = sol;
                numIndividuosSelecionados--;
                numIndRepetidos--;
            }
        }
    }

    // Ainda tem soluções pra substituir, escolhe pontos aleatórios na metade
    // inferior da população
    while (numIndividuosSelecionados > 0) {
        j = rand(Math.floor(Parameters.populationSize / 2), Parameters.populationSize - 1);
        if (!visited[j]) {
            sol = populationSelected.shift();
            if (sol) {
                population[j] = sol;
                visited[j] = true;
                numIndividuosSelecionados--;
            }
        }
    }
}

/**
 * Gera perturbação em todas as soluções da população dependendo da força
 * definida por parâmetro
 */
function perturbarPopulacao() {
    let i = 0;
    let j = 0;
    let ini: number;
    let fim: number;
    let layer: Layer;
    let sol: Solution;
    for (i = 0; i < Parameters.populationSize; i++) {
        sol = population[i];
        for (j = 0; j < NUM_LAYERS; j++) {
            layer = sol.layers[j];
            ini = rand(0, Math.round((layer.numNodes - 1) * (1 - Parameters.forcaPerturbacao)));
            fim = ini + Math.floor((layer.numNodes - 1) * Parameters.forcaPerturbacao);
            shuffleNodes(layer.nodes, ini, fim);
        }
        sol.calcAllNodeMaxCross();
        sol.calcM = false;
        sol.modified = false;
    }
}

////////////////////////////////////////////////////////////////////
//////////////////////// funções auxiliares ////////////////////////
////////////////////////////////////////////////////////////////////

/**
 * Gera uma quantidade de soluções aleatórias
 * @param numSolucoes
 * @returns
 */
function geraSolucoesAleatorias(numSolucoes: number): Solution[] {
    let i: number;
    let j: number;
    let solucoes: Solution[] = new Array<Solution>(numSolucoes);

    for (i = 0; i < numSolucoes; i++) {
        solucoes[i] = new Solution(p_id++, getCopyOfInstanceData());
        for (j = 0; j < NUM_LAYERS; j++) {
            shuffleLayer(solucoes[i].layers[j]);
        }
    }

    return solucoes;
}

/**
 * Permuta todos os nós de uma camada
 * @param layer
 * @returns
 */
function shuffleLayer(layer: Layer) {
    let i: number;
    let rndIndex: number;
    let tmp: Node;

    for (i = 0; i < layer.numNodes - 1; i++) {
        rndIndex = rand(0, layer.numNodes - i - 1);
        // Armazena posição A
        tmp = layer.nodes[i];
        // Substitui nó A pelo B
        layer.nodes[i] = layer.nodes[i + rndIndex];
        layer.nodes[i].position = i;
        // Substitui nó B pelo A armazenado
        layer.nodes[i + rndIndex] = tmp;
        layer.nodes[i + rndIndex].position = i + rndIndex;
    }

    return layer;
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

export function getBestSolGa(): Solution | null {
    return bestSol;
}

export function getGeracao(): number {
    return geracao;
}
