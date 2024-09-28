import { getBestSolAco, getColonias, init_aco, run_aco } from "./aco";
import { getBestSolGa, getGeracao, init_ga, run_ga } from "./ga";
import { InstanceItemType, testDevelopment, testProduction, testUniform } from "./instanceMap";
import { checkSolution, readInstance, setBKS } from "./mmac";
import {
    close_csv_stats,
    close_stats,
    getACODistanceFromBKS,
    getGADistanceFromBKS,
    MAX_TRIALS,
    mean,
    open_stats,
    setValorACO,
    setValorGA,
} from "./stats";
import { basename } from "path";

console.log("\n////////// Trabalho 2 de Computação Evolucionista //////////\n");
console.log("UFJF PPGMC 2024.2");
console.log("Aluno: Thiago de Almeida\n");
let distGeralGA = [];
let distGeralACO = [];
let instances: InstanceItemType[] = testProduction();

if (process.argv.length > 2 && process.argv[2]?.trim() === "dev") {
    console.log("** Modo de desenvolvimento **");
    console.log("Carregando instâncias de teste e rodando as heuristicas");
    instances = testDevelopment();
} else {
    console.log("Carregando instâncias de produção e rodando as heuristicas");
}
let algoritmo = "";
if (process.argv[3]?.trim() === "aco") {
    algoritmo = "aco";
} else if (process.argv[3]?.trim() === "genetico") {
    algoritmo = "genetico";
}

let seed = 51;
for (const instancia of instances) {
    console.log("\nLendo instância", basename(instancia.arq));
    readInstance(instancia.arq);

    // Inclui bks como possível condição de termino
    setBKS(instancia.bks);

    // Abre gerador de dados estatísticos
    open_stats(instancia, seed);

    for (let run = 0; run < MAX_TRIALS; run++) {
        console.log(`Execução ${run + 1},`, "com seed", seed, "iniciando em", new Date().toISOString());

        // Execução com algoritmo genético
        if (algoritmo === "" || algoritmo === "genetico") {
            init_ga(seed);
            run_ga();
            let bestGA = getBestSolGa();
            if (bestGA) {
                checkSolution(bestGA, "Checa best GA");
                setValorGA(run, bestGA);
                console.log("=======> bestGA:", bestGA.getM(), "com", getGeracao(), "geracoes");
                console.log(bestGA.toString(false));
                console.log("");
            }
        }

        // Execução com ACO
        if (algoritmo === "" || algoritmo === "aco") {
            init_aco(seed);
            run_aco();
            let bestACO = getBestSolAco();
            if (bestACO) {
                checkSolution(bestACO, "Checa best ACO");
                setValorACO(run, bestACO);
                console.log("=======> bestACO:", bestACO.getM(), "com", getColonias(), "colonias");
                console.log(bestACO.toString(false));
                console.log("");
            }
        }

        seed++;
    }

    distGeralGA.push(getGADistanceFromBKS());
    distGeralACO.push(getACODistanceFromBKS());

    close_stats();
}

console.log("\n====== Distância média dos algoritmos pra melhor solução da literatura ========");
console.log("GA:", mean(distGeralGA, distGeralGA.length));
console.log("ACO:", mean(distGeralACO, distGeralACO.length));

close_csv_stats();

//node --prof-process isolate-0000027A468BF1D0-4940-v8.log > processed.txt
/*
====== Distância média dos algoritmos pra melhor solução da literatura ========
GA: 32.6
ACO: 4.6

====== Distância média dos algoritmos pra melhor solução da literatura ========
GA: 31.2
ACO: 3.8

====== Distância média dos algoritmos pra melhor solução da literatura ========
GA: 30.6
ACO: 3.8

====== Distância média dos algoritmos pra melhor solução da literatura ========
GA: 32
ACO: 3.8

====== Distância média dos algoritmos pra melhor solução da literatura ========
GA: 33.2
ACO: 3.8
*/
