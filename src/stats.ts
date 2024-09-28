import { closeSync, openSync, writeFileSync } from "fs";
import { basename } from "path";
import { NUM_LAYERS, Solution } from "./mmac";
import { InstanceItemType } from "./instanceMap";

export const MAX_TRIALS = 10;

let log_performance: number = -1;
let csv_performance: number = -1;
let perf_filename: string;
let perf_csv_filename: string;
let perfTrialsGA: number[];
let perfTrialsACO: number[];
let startDate: Date;
let seedAtual: number;
let instancia: string;
let bestGASolution: Solution | null;
let bestACOSolution: Solution | null;
let instanceBKS: number;

export function open_stats(problem_instance: InstanceItemType, seed: number) {
    //Initialize
    perfTrialsGA = new Array(MAX_TRIALS);
    perfTrialsACO = new Array(MAX_TRIALS);

    startDate = new Date();
    seedAtual = seed;
    bestGASolution = null;
    bestACOSolution = null;
    instanceBKS = problem_instance.bks;

    for (let i = 0; i < MAX_TRIALS; i++) {
        perfTrialsGA[i] = 0.0;
        perfTrialsACO[i] = 0.0;
    }

    //initialize and open output files
    instancia = basename(problem_instance.arq).replace(".txt", "");
    perf_filename = `stats.${instancia}.txt`;
    perf_csv_filename = `stats.execucoes.csv`;

    log_performance = openSync(perf_filename, "a");
    if (csv_performance === -1) {
        csv_performance = openSync(perf_csv_filename, "w");
        writeFileSync(csv_performance, "instancia,ga_mean,ga_min,ga_max,ga_std,aco_mean,aco_min,aco_max,aco_std\n");
    }
}

export function setValorGA(r: number, sol: Solution) {
    perfTrialsGA[r] = sol.getM();
    if (!bestGASolution || sol.getM() < bestGASolution.getM()) {
        bestGASolution = sol;
    }
}

export function setValorACO(r: number, sol: Solution) {
    perfTrialsACO[r] = sol.getM();
    if (!bestACOSolution || sol.getM() < bestACOSolution.getM()) {
        bestACOSolution = sol;
    }
}

export function mean(values: number[], size: number): number {
    let i: number;
    let m = 0.0;
    for (i = 0; i < size; i++) {
        m += values[i];
    }
    m = m / size;
    return m; //mean
}

export function stdev(values: number[], size: number, average: number): number {
    let i: number;
    let dev = 0.0;

    if (size <= 1) return 0.0;

    for (i = 0; i < size; i++) {
        dev += (values[i] - average) * (values[i] - average);
    }
    return Math.sqrt(dev / (size - 1)); //standard deviation
}

export function best_of_vector(values: number[], l: number): number {
    let min: number;
    let k: number;
    k = 0;
    min = values[k];
    for (k = 1; k < l; k++) {
        if (values[k] < min) {
            min = values[k];
        }
    }
    return min;
}

export function worst_of_vector(values: number[], l: number): number {
    let max: number;
    let k: number;
    k = 0;
    max = values[k];
    for (k = 1; k < l; k++) {
        if (values[k] > max) {
            max = values[k];
        }
    }
    return max;
}

export function getGADistanceFromBKS() {
    let ga_perf_min = best_of_vector(perfTrialsGA, MAX_TRIALS);
    return ga_perf_min - instanceBKS;
}

export function getACODistanceFromBKS() {
    let aco_perf_min = best_of_vector(perfTrialsACO, MAX_TRIALS);
    return aco_perf_min - instanceBKS;
}

function writeStats(perfTrials: number[], best: Solution | null, label: string) {
    let i: number;
    writeFileSync(log_performance, `\n${label}\n`);

    for (i = 0; i < MAX_TRIALS; i++) {
        writeFileSync(log_performance, perfTrials[i].toFixed(2));
        writeFileSync(log_performance, "\n");
    }

    let perf_mean_value = mean(perfTrials, MAX_TRIALS);
    let perf_stdev_value = stdev(perfTrials, MAX_TRIALS, perf_mean_value);
    let perf_min = best_of_vector(perfTrials, MAX_TRIALS);
    let perf_max = worst_of_vector(perfTrials, MAX_TRIALS);

    writeFileSync(log_performance, `Mean ${perf_mean_value}\t `);
    writeFileSync(log_performance, `\tStd Dev ${perf_stdev_value}\t `);
    writeFileSync(log_performance, `\n`);
    writeFileSync(log_performance, `Min: ${perf_min}\t `);
    writeFileSync(log_performance, `\n`);
    writeFileSync(log_performance, `Max: ${perf_max}\t `);
    writeFileSync(log_performance, `\n`);
    writeFileSync(log_performance, `Dist BKS: ${perf_min - instanceBKS}\t `);
    writeFileSync(log_performance, `\n`);

    writeFileSync(log_performance, "\nMelhor solução\n");
    for (i = 0; i < NUM_LAYERS; i++) {
        if (best) {
            writeFileSync(log_performance, `${i + 1} \t ${best.layers[i].nodes.map((x) => x.id).join(",")}\n`);
        }
    }

    return {
        perf_mean_value,
        perf_stdev_value,
        perf_min,
        perf_max,
    };
}

export function close_stats() {
    writeFileSync(
        log_performance,
        `\n##### Execução iniciada em ${startDate.toString()} e concluida em ${Math.round(
            (new Date().getTime() - startDate.getTime()) / 1000
        )} segundos #####\n`
    );

    writeFileSync(log_performance, `Instância: ${instancia}, seed inicial: ${seedAtual}\n`);

    let ga = writeStats(perfTrialsGA, bestGASolution, "Algoritmo genético");
    let aco = writeStats(perfTrialsACO, bestACOSolution, "ACO");

    closeSync(log_performance);

    let csvLine = `${instancia},${ga.perf_mean_value},${ga.perf_min},${ga.perf_max},${ga.perf_stdev_value},`;
    csvLine += `${aco.perf_mean_value},${aco.perf_min},${aco.perf_max},${aco.perf_stdev_value},\n`;
    writeFileSync(csv_performance, csvLine);
}

export function close_csv_stats() {
    closeSync(csv_performance);
}
