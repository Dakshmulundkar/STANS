import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { kruskalAlgorithm, type Edge } from "@/utils/kruskal";
import { primAlgorithm } from "@/utils/prim";
import { dijkstraAlgorithm } from "@/utils/dijkstra";

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface AlgorithmComparisonProps {
  nodes?: Node[];
  edges?: Edge[];
}

const AlgorithmComparison = ({ nodes: propNodes, edges: propEdges }: AlgorithmComparisonProps) => {
  const [hasRun, setHasRun] = useState(false);
  const [kruskalResult, setKruskalResult] = useState<Record<string, unknown>>(null);
  const [primResult, setPrimResult] = useState<Record<string, unknown>>(null);
  const [dijkstraResult, setDijkstraResult] = useState<Record<string, unknown>>(null);

  // Use provided nodes/edges or fallback to sample data
  const defaultNodes: Node[] = [
    { id: "A", x: 100, y: 150, label: "A" },
    { id: "B", x: 300, y: 100, label: "B" },
    { id: "C", x: 500, y: 150, label: "C" },
    { id: "D", x: 200, y: 300, label: "D" },
    { id: "E", x: 400, y: 300, label: "E" },
  ];

  const defaultEdges: Edge[] = [
    { from: "A", to: "B", weight: 5, traffic: "low", isBlocked: false },
    { from: "A", to: "D", weight: 8, traffic: "medium", isBlocked: false },
    { from: "B", to: "C", weight: 6, traffic: "high", isBlocked: false },
    { from: "B", to: "E", weight: 7, traffic: "low", isBlocked: false },
    { from: "C", to: "E", weight: 4, traffic: "low", isBlocked: false },
    { from: "D", to: "E", weight: 9, traffic: "medium", isBlocked: true },
    { from: "B", to: "D", weight: 3, traffic: "medium", isBlocked: false },
  ];

  const nodes = propNodes && propNodes.length > 0 ? propNodes : defaultNodes;
  const edges = propEdges && propEdges.length > 0 ? propEdges : defaultEdges;

  const runComparison = () => {
    toast.info("Running all algorithms...");

    // Run Kruskal's
    const kruskalSteps = kruskalAlgorithm(edges, nodes.map((n) => n.id));
    const kruskalFinal = kruskalSteps[kruskalSteps.length - 1];
    setKruskalResult({
      steps: kruskalSteps.length,
      edges: kruskalFinal.currentMST.length,
      weight: kruskalFinal.totalWeight,
      time: "O(E log E)",
    });

    // Run Prim's
    const primSteps = primAlgorithm(edges, nodes.map((n) => n.id), "A");
    const primFinal = primSteps[primSteps.length - 1];
    setPrimResult({
      steps: primSteps.length,
      edges: primFinal.currentMST.length,
      weight: primFinal.totalWeight,
      time: "O(E log V)",
    });

    // Run Dijkstra's (A to C)
    const dijkstraSteps = dijkstraAlgorithm(edges, nodes.map((n) => n.id), "A", "C");
    const dijkstraFinal = dijkstraSteps[dijkstraSteps.length - 1];
    setDijkstraResult({
      steps: dijkstraSteps.length,
      distance: dijkstraFinal.distances.get("C")?.toFixed(1) || "∞",
      path: dijkstraFinal.shortestPath?.join(" → ") || "None",
      time: "O((V + E) log V)",
    });

    setHasRun(true);
    toast.success("Comparison complete!");
  };

  const reset = () => {
    setHasRun(false);
    setKruskalResult(null);
    setPrimResult(null);
    setDijkstraResult(null);
    toast.info("Comparison reset");
  };

  const getNodePosition = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="font-display">Algorithm Comparison</CardTitle>
          <CardDescription>
            Side-by-side comparison of Kruskal's, Prim's, and Dijkstra's algorithms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={runComparison}
              disabled={hasRun}
              className="bg-primary hover:bg-primary/90"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Comparison
            </Button>
            <Button onClick={reset} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Graph Visualization */}
          <div className="relative bg-card border-2 border-border rounded-lg p-8">
            <svg width="100%" height="300" className="overflow-visible">
              {/* Draw edges */}
              {edges.map((edge, index) => {
                const from = getNodePosition(edge.from);
                const to = getNodePosition(edge.to);
                if (!from || !to) return null;

                return (
                  <g key={index}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={
                        edge.isBlocked
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--border))"
                      }
                      strokeWidth={edge.isBlocked ? 3 : 2}
                      strokeDasharray={edge.isBlocked ? "5,5" : "none"}
                      opacity={0.5}
                    />
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 10}
                      fill="hsl(var(--foreground))"
                      fontSize="11"
                      fontWeight="600"
                      className="select-none"
                    >
                      {edge.weight}km
                    </text>
                  </g>
                );
              })}

              {/* Draw nodes */}
              {nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="20"
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth="3"
                    className="drop-shadow-lg"
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    fill="hsl(var(--primary-foreground))"
                    fontSize="14"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none"
                  >
                    {node.id}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Results Grid */}
          {hasRun && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Kruskal's Results */}
              <Card className="border-2 border-accent/50 bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Kruskal's Algorithm</CardTitle>
                  <CardDescription>Minimum Spanning Tree (Edge-based)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Steps Taken:</span>
                      <Badge variant="secondary">{kruskalResult?.steps}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Edges in MST:</span>
                      <Badge variant="secondary">{kruskalResult?.edges}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Weight:</span>
                      <Badge className="bg-accent text-accent-foreground">
                        {kruskalResult?.weight}km
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Complexity:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {kruskalResult?.time}
                      </code>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <strong>Best for:</strong> Sparse graphs, finding global MST
                  </div>
                </CardContent>
              </Card>

              {/* Prim's Results */}
              <Card className="border-2 border-secondary/50 bg-secondary/5">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Prim's Algorithm</CardTitle>
                  <CardDescription>Minimum Spanning Tree (Node-based)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Steps Taken:</span>
                      <Badge variant="secondary">{primResult?.steps}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Edges in MST:</span>
                      <Badge variant="secondary">{primResult?.edges}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Weight:</span>
                      <Badge className="bg-secondary text-secondary-foreground">
                        {primResult?.weight}km
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Complexity:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {primResult?.time}
                      </code>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <strong>Best for:</strong> Dense graphs, growing tree from source
                  </div>
                </CardContent>
              </Card>

              {/* Dijkstra's Results */}
              <Card className="border-2 border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Dijkstra's Algorithm</CardTitle>
                  <CardDescription>Shortest Path (A → C)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Steps Taken:</span>
                      <Badge variant="secondary">{dijkstraResult?.steps}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Path:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {dijkstraResult?.path}
                      </code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Distance:</span>
                      <Badge className="bg-primary text-primary-foreground">
                        {dijkstraResult?.distance}km
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Complexity:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {dijkstraResult?.time}
                      </code>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <strong>Best for:</strong> Single-source shortest paths
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Key Differences */}
          {hasRun && (
            <Card className="bg-muted/30 border-2">
              <CardHeader>
                <CardTitle className="text-lg font-display">Key Differences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2 text-accent">Kruskal's</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Sorts all edges first</li>
                      <li>• Uses Union-Find</li>
                      <li>• Edge-centric approach</li>
                      <li>• Works on disconnected graphs</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-secondary">Prim's</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Grows tree from start node</li>
                      <li>• Uses priority queue</li>
                      <li>• Node-centric approach</li>
                      <li>• Requires connected graph</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-primary">Dijkstra's</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Finds shortest paths</li>
                      <li>• Single source to all nodes</li>
                      <li>• Greedy algorithm</li>
                      <li>• No negative weights</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlgorithmComparison;
