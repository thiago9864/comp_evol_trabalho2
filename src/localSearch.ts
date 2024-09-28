import { rand } from "./aco";
import { calcNodeMaxCross, isCross, Layer, Node, Solution } from "./mmac";

const MAX_MOVE_DISTANCE_DENOMINATOR = 0.5;

class Move {
    node: Node | null;
    newPos: number;
    delta: number;

    constructor(n: Node | null, p: number, d: number) {
        this.node = n;
        this.newPos = p;
        this.delta = d;
    }

    toString() {
        return "Move Node: " + this.node?.id + ", " + this.node?.position + "->" + this.newPos + "/" + this.delta;
    }
}

let currentSol: Solution;
let moveMaxDistance: number;
const LAMBDA = 10000;

export function localSearch(solution: Solution): Solution {
    let iterationLS: number = 0;
    let wFlag: boolean = false;
    let bestLocalSol: Solution = solution;

    moveMaxDistance = Math.max(...solution.layers.map((x) => x.numNodes));
    moveMaxDistance *= MAX_MOVE_DISTANCE_DENOMINATOR;
    // Garante números inteiros
    moveMaxDistance = Math.floor(moveMaxDistance);

    currentSol = solution.clone();

    for (; ; ++iterationLS) {
        let mv: Move = findMove();
        if (!wFlag && mv.delta >= 0) {
            wFlag = true;
            if (bestLocalSol.getM() > currentSol.getM()) {
                bestLocalSol = currentSol.clone();
            }
        }

        if (mv.delta >= 0) {
            //console.log('break',mv.delta, iterationLS);
            iterationLS++;
            break;
        }

        makeMove(mv);
        let obj: number = currentSol.getM();

        //console.log('obj',obj)

        if (iterationLS % 1000 == 0) {
            //console.log("Iteration: " + iterationLS + ", Obj: " + obj + ", Best: " + bestLocalSol.getM());
        }
        if (wFlag && obj < bestLocalSol.getM()) {
            //console.log("Iteration: " + iterationLS + ", Obj: " + obj + ", Best: " + bestLocalSol.getM());
            bestLocalSol = currentSol.clone();
        }

        if (obj == 0) break;
    }

    if (currentSol.getM() < bestLocalSol.getM()) {
        bestLocalSol = solution.clone();
    }

    return bestLocalSol;
}

function findMove(): Move {
    let currM: number = currentSol.getM();
    let bestMv: Move = new Move(null, -1, Number.MAX_SAFE_INTEGER);
    let bestCount = 0;
    for (const n of currentSol.nodes) {
        if (bestMv.delta < 0) {
            break;
        }
        let lbIndex = Math.max(0, n.position - moveMaxDistance);
        let ubIndex = Math.min(n.position + moveMaxDistance, currentSol.layers[n.layerIndex].numNodes - 1);

        let move = tryMoveNeg(n, lbIndex, currM);
        if (move.delta < bestMv.delta) {
            bestMv = move;
            bestCount = 1;
        } else if (move.delta == bestMv.delta && rand(0, bestCount++) == 0) {
            bestMv = move;
        }
        move = tryMovePos(n, ubIndex, currM);
        if (move.delta < bestMv.delta) {
            bestMv = move;
            bestCount = 1;
        } else if (move.delta == bestMv.delta && rand(0, bestCount++) == 0) {
            bestMv = move;
        }
    }
    return bestMv;
}

function makeMove(mv: Move) {
    if (!mv || !mv.node) {
        throw new Error("mv.node não pode ser nulo");
    }
    let layer = currentSol.layers[mv.node.layerIndex];
    let lbIndex: number;
    let ubIndex: number;
    if (mv.newPos > mv.node.position) {
        lbIndex = mv.node.position;
        ubIndex = mv.newPos;
    } else {
        lbIndex = mv.newPos;
        ubIndex = mv.node.position;
    }

    for (let index = lbIndex; index < ubIndex; ++index) {
        let node = layer.nodes[index];
        for (let e of node.outEdges) {
            let iO = node.position;
            let iN = calcNewPos(mv.node.position, mv.newPos, node.position);
            let j = currentSol.getNodeById(e.destinationId).position;
            for (let indexP = index + 1; indexP <= ubIndex; ++indexP) {
                let nodeP = layer.nodes[indexP];
                for (let eP of nodeP.outEdges) {
                    let kO = nodeP.position;
                    let kN = calcNewPos(mv.node.position, mv.newPos, nodeP.position);
                    let l = currentSol.getNodeById(eP.destinationId).position;
                    if (j == l) continue;
                    let delta = (isCross(iN, j, kN, l) ? 1 : 0) - (isCross(iO, j, kO, l) ? 1 : 0);
                    e.numCross += delta;
                    eP.numCross += delta;
                }
            }
        }
    }

    for (let index = lbIndex; index < ubIndex; ++index) {
        let node = layer.nodes[index];
        for (let e of node.inEdges) {
            let i = currentSol.getNodeById(e.originId).position;
            let jO = node.position;
            let jN = calcNewPos(mv.node.position, mv.newPos, node.position);
            for (let indexP = index + 1; indexP <= ubIndex; ++indexP) {
                let nodeP = layer.nodes[indexP];
                for (let eP of nodeP.inEdges) {
                    let k = currentSol.getNodeById(eP.originId).position;
                    if (k == i) continue;
                    let lO = nodeP.position;
                    let lN = calcNewPos(mv.node.position, mv.newPos, nodeP.position);
                    let delta = (isCross(i, jN, k, lN) ? 1 : 0) - (isCross(i, jO, k, lO) ? 1 : 0);
                    e.numCross += delta;
                    eP.numCross += delta;
                }
            }
        }
    }

    //resort nodes in layer
    if (mv.newPos > mv.node.position) {
        for (let i = mv.node.position; i < mv.newPos; ++i) {
            layer.nodes[i] = layer.nodes[i + 1];
            layer.nodes[i].position -= 1;
        }
    } else {
        for (let i = mv.node.position; i > mv.newPos; --i) {
            layer.nodes[i] = layer.nodes[i - 1];
            layer.nodes[i].position += 1;
        }
    }

    layer.nodes[mv.newPos] = mv.node;
    mv.node.position = mv.newPos;

    recalcNodeMaxCross(layer, lbIndex, ubIndex);
    currentSol.nodes.sort((a, b) => b.maxCross - a.maxCross);
}

function recalcNodeMaxCross(layer: Layer, lbIndex: number, ubIndex: number) {
    let recalcedNode = new Map<number, Node>();
    for (let i = lbIndex; i <= ubIndex; ++i) {
        let node = layer.nodes[i];
        calcNodeMaxCross(node);

        for (let e of node.outEdges) {
            let nodeP: Node = currentSol.getNodeById(e.destinationId);
            if (recalcedNode.has(nodeP.id)) continue;
            calcNodeMaxCross(nodeP);
            recalcedNode.set(nodeP.id, nodeP);
        }

        for (let e of node.inEdges) {
            let nodeP: Node = currentSol.getNodeById(e.originId);
            if (recalcedNode.has(nodeP.id)) continue;
            calcNodeMaxCross(nodeP);
            recalcedNode.set(nodeP.id, nodeP);
        }
    }
}

function tryMoveNeg(node: Node, lbIndex: number, currM: number) {
    let bestMv = new Move(null, -1, Number.MAX_SAFE_INTEGER);
    let bestCount = 0;
    let layer = currentSol.layers[node.layerIndex];
    resetTmpCross(layer, lbIndex, node.position);

    let delta = 0;
    let nodeOldPos = node.position;
    for (let newIndex = node.position - 1; newIndex >= lbIndex; --newIndex) {
        let prevNode = layer.nodes[newIndex];

        delta += calcSwapDelta(
            prevNode,
            node,
            prevNode.position,
            prevNode.position + 1,
            nodeOldPos,
            prevNode.position,
            currM
        );

        if (delta < bestMv.delta) {
            bestMv = new Move(node, newIndex, delta);
            bestCount = 1;
        } else if (delta == bestMv.delta && rand(0, bestCount++) == 0) {
            bestMv = new Move(node, newIndex, delta);
        }
        updateTmpCross(node);
        updateTmpCross(prevNode);
        nodeOldPos = newIndex;
    }

    return bestMv;
}

function tryMovePos(node: Node, ubIndex: number, currM: number) {
    let bestMv = new Move(null, -1, Number.MAX_SAFE_INTEGER);
    let bestCount = 0;
    let layer = currentSol.layers[node.layerIndex];
    resetTmpCross(layer, node.position, ubIndex);

    let delta = 0;
    let nodeOldPos = node.position;
    for (let newIndex = node.position + 1; newIndex <= ubIndex; ++newIndex) {
        let nextNode = layer.nodes[newIndex];

        delta += calcSwapDelta(node, nextNode, nodeOldPos, newIndex, nextNode.position, nextNode.position - 1, currM);
        if (delta < bestMv.delta) {
            bestMv = new Move(node, newIndex, delta);
            bestCount = 1;
        } else if (delta == bestMv.delta && rand(0, bestCount++) == 0) {
            bestMv = new Move(node, newIndex, delta);
        }
        updateTmpCross(node);
        updateTmpCross(nextNode);
        nodeOldPos = newIndex;
    }
    return bestMv;
}

function calcSwapDelta(
    node: Node,
    nextNode: Node,
    nodeOldPos: number,
    nodeNewPos: number,
    nextNodeOldPos: number,
    nextNodeNewPos: number,
    currM: number
) {
    clearTmpDeltaCross(node);
    clearTmpDeltaCross(nextNode);
    for (let nE of nextNode.outEdges) {
        let nextNodeToPos = currentSol.getNodeById(nE.destinationId).position;
        for (let E of node.outEdges) {
            let nodeToPos = currentSol.getNodeById(E.destinationId).position;
            if (nextNodeToPos == nodeToPos) continue;

            let deltaCross = isCross(nodeOldPos, nodeToPos, nextNodeOldPos, nextNodeToPos) ? -1 : 1;
            E.tmpDeltaCross += deltaCross;
            nE.tmpDeltaCross += deltaCross;
        }
    }
    for (let nE of nextNode.inEdges) {
        let nextNodeFromPos = currentSol.getNodeById(nE.originId).position;
        for (let E of node.inEdges) {
            let nodeFromPos = currentSol.getNodeById(E.originId).position;
            if (nextNodeFromPos == nodeFromPos) continue;

            let deltaCross = isCross(nodeFromPos, nodeOldPos, nextNodeFromPos, nextNodeOldPos) ? -1 : 1;
            E.tmpDeltaCross += deltaCross;
            nE.tmpDeltaCross += deltaCross;
        }
    }

    return countTmpDelta(node, nextNode, currM);
}

function resetTmpCross(layer: Layer, lbIndex: number, ubIndex: number) {
    for (let index = lbIndex; index <= ubIndex; ++index) {
        let node = layer.nodes[index];
        if (!node) {
            console.log("lbIndex", lbIndex);
            console.log("ubIndex", ubIndex);
            console.log(
                "layer.nodes",
                layer.nodes.map((x) => x.id)
            );
            throw new Error("Nó nulo");
        }
        for (const e of node.outEdges) {
            e.tmpCross = e.numCross;
        }
        for (const e of node.inEdges) {
            e.tmpCross = e.numCross;
        }
    }
}

function updateTmpCross(n: Node) {
    for (let E of n.outEdges) {
        E.tmpCross += E.tmpDeltaCross;
    }
    for (let E of n.inEdges) {
        E.tmpCross += E.tmpDeltaCross;
    }
}

function clearTmpDeltaCross(n: Node) {
    for (let e of n.inEdges) {
        e.tmpDeltaCross = 0;
    }
    for (let e of n.outEdges) {
        e.tmpDeltaCross = 0;
    }
}

function countTmpDelta(node1: Node, node2: Node, currM: number) {
    let delta = 0;
    for (let E of node1.outEdges) {
        delta += calcDelta(E.tmpDeltaCross, E.tmpCross, currM);
    }
    for (let E of node1.inEdges) {
        delta += calcDelta(E.tmpDeltaCross, E.tmpCross, currM);
    }
    for (let E of node2.outEdges) {
        delta += calcDelta(E.tmpDeltaCross, E.tmpCross, currM);
    }
    for (let E of node2.inEdges) {
        delta += calcDelta(E.tmpDeltaCross, E.tmpCross, currM);
    }
    return delta;
}

function calcDelta(deltaCross: number, oriCross: number, currM: number) {
    let delta = 0;
    let newCross = oriCross + deltaCross;
    if (oriCross < currM && newCross == currM) {
        delta += 1;
    } else if (oriCross <= currM && newCross > currM) {
        delta += LAMBDA * (newCross - currM);
    } else if (oriCross == currM && newCross < currM) {
        delta -= 1;
    }
    return delta;
}

function calcNewPos(mvNodePos: number, mvNodeNewPos: number, pos: number) {
    if (mvNodePos == pos) {
        return mvNodeNewPos;
    } else if (mvNodePos < mvNodeNewPos) {
        if (pos < mvNodePos || pos > mvNodeNewPos) {
            return pos;
        } else {
            return pos - 1;
        }
    } else {
        if (pos < mvNodeNewPos || pos > mvNodePos) {
            return pos;
        } else {
            return pos + 1;
        }
    }
}
