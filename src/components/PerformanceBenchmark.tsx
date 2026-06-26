import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { kruskalAlgorithm } from "@/utils/kruskal";
import { primAlgorithm } from "@/utils/prim";
import { dijkstraAlgorithm } from "@/utils/dijkstra";
import { Play, BarChart3, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface BenchmarkResult {
  graphSize: number;
  edges: number;
  kruskalTime: number;
  primTime: number;
  dijkstraTime: number;
}

interface Stats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

const PerformanceBenchmark = () => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateRandomGraph = (nodeCount: number) => {
    const nodes: string[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(`N${i}`);
    }

    const edges: { from: string; to: string; weight: number; traffic: string; isBlocked: boolean }[] = [];
    const edgeCount = Math.min(nodeCount * (nodeCount - 1) / 2, nodeCount * 3);
    
    for (let i = 0; i < edgeCount; i++) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      let to = nodes[Math.floor(Math.random() * nodes.length)];
      while (to === from) {
        to = nodes[Math.floor(Math.random() * nodes.length)];
      }
      
      edges.push({
        from,
        to,
        weight: Math.floor(Math.random() * 50) + 10,
        traffic: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        isBlocked: false,
      });
    }

    return { nodes, edges };
  };

  const measureTime = (fn: () => void): number => {
    const start = performance.now();
    fn();
    const end = performance.now();
    return end - start;
  };

  const runBenchmark = async () => {
    setIsRunning(true);
    setProgress(0);
    const newResults: BenchmarkResult[] = [];
    const graphSizes = [10, 25, 50, 100, 150];
    const iterations = 5;

    for (let i = 0; i < graphSizes.length; i++) {
      const size = graphSizes[i];
      const kruskalTimes: number[] = [];
      const primTimes: number[] = [];
      const dijkstraTimes: number[] = [];
      let totalEdges = 0;

      for (let j = 0; j < iterations; j++) {
        const { nodes, edges } = generateRandomGraph(size);
        totalEdges = edges.length;

        const kTime = measureTime(() => kruskalAlgorithm(edges, nodes));
        kruskalTimes.push(kTime);

        const pTime = measureTime(() => primAlgorithm(edges, nodes));
        primTimes.push(pTime);

        const dTime = measureTime(() => dijkstraAlgorithm(edges, nodes, nodes[0]));
        dijkstraTimes.push(dTime);

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      newResults.push({
        graphSize: size,
        edges: totalEdges,
        kruskalTime: kruskalTimes.reduce((a, b) => a + b, 0) / iterations,
        primTime: primTimes.reduce((a, b) => a + b, 0) / iterations,
        dijkstraTime: dijkstraTimes.reduce((a, b) => a + b, 0) / iterations,
      });

      setProgress(((i + 1) / graphSizes.length) * 100);
    }

    setResults(newResults);
    setIsRunning(false);
  };

  const calculateStats = (data: number[]): Stats => {
    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return { mean, median, min, max, stdDev };
  };

  const getAlgorithmStats = (algorithm: 'kruskal' | 'prim' | 'dijkstra'): Stats => {
    const times = results.map(r => 
      algorithm === 'kruskal' ? r.kruskalTime : 
      algorithm === 'prim' ? r.primTime : 
      r.dijkstraTime
    );
    return calculateStats(times);
  };

  const comparisonData = results.map(r => ({
    size: `${r.graphSize} nodes`,
    Kruskal: parseFloat(r.kruskalTime.toFixed(3)),
    Prim: parseFloat(r.primTime.toFixed(3)),
    Dijkstra: parseFloat(r.dijkstraTime.toFixed(3)),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Performance Benchmark Suite
              </CardTitle>
              <CardDescription>
                Measure and compare algorithm execution times across different graph sizes
              </CardDescription>
            </div>
            <Button onClick={runBenchmark} disabled={isRunning} size="lg">
              <Play className="w-4 h-4 mr-2" />
              {isRunning ? "Running..." : "Run Benchmark"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isRunning && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Running benchmark tests...</p>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chart">Performance Chart</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Time vs Graph Size</CardTitle>
                <CardDescription>Average execution time in milliseconds</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="size" />
                    <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Kruskal" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="Prim" stroke="hsl(var(--secondary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="Dijkstra" stroke="hsl(var(--accent))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Algorithm Comparison</CardTitle>
                <CardDescription>Side-by-side performance comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="size" />
                    <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Kruskal" fill="hsl(var(--primary))" />
                    <Bar dataKey="Prim" fill="hsl(var(--secondary))" />
                    <Bar dataKey="Dijkstra" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {(['kruskal', 'prim', 'dijkstra'] as const).map((algo) => {
                const stats = getAlgorithmStats(algo);
                return (
                  <Card key={algo}>
                    <CardHeader>
                      <CardTitle className="capitalize">{algo}'s Algorithm</CardTitle>
                      <CardDescription>Statistical Analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Mean</span>
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          {stats.mean.toFixed(3)} ms
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Median</span>
                        <Badge variant="outline">{stats.median.toFixed(3)} ms</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Min</span>
                        <Badge variant="secondary">{stats.min.toFixed(3)} ms</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Max</span>
                        <Badge variant="secondary">{stats.max.toFixed(3)} ms</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Std Dev</span>
                        <Badge variant="outline">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          ±{stats.stdDev.toFixed(3)} ms
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Graph Size</th>
                        <th className="text-left p-2">Edges</th>
                        <th className="text-right p-2">Kruskal (ms)</th>
                        <th className="text-right p-2">Prim (ms)</th>
                        <th className="text-right p-2">Dijkstra (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{result.graphSize} nodes</td>
                          <td className="p-2">{result.edges}</td>
                          <td className="text-right p-2">{result.kruskalTime.toFixed(3)}</td>
                          <td className="text-right p-2">{result.primTime.toFixed(3)}</td>
                          <td className="text-right p-2">{result.dijkstraTime.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PerformanceBenchmark;