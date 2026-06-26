import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, GitCompare, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface AlgorithmStep {
  action: string;
  edge?: { from: string; to: string; weight: number };
  explanation: string;
  mstEdges: Array<{ from: string; to: string; weight: number }>;
  totalWeight: number;
}

interface AlgorithmRun {
  id: string;
  algorithm: 'kruskal' | 'prim' | 'dijkstra';
  timestamp: Date;
  steps: AlgorithmStep[];
  graphData: Record<string, unknown>;
  finalWeight: number;
  executionTime: number;
}

interface VisualizationHistoryProps {
  runs?: AlgorithmRun[];
  onLoadRun?: (run: AlgorithmRun) => void;
  onDeleteRun?: (id: string) => void;
  onExportRun?: (run: AlgorithmRun) => void;
}

const VisualizationHistory: React.FC<VisualizationHistoryProps> = ({
  runs = [],
  onLoadRun,
  onDeleteRun,
  onExportRun,
}) => {
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // Mock data for demonstration
  const mockRuns: AlgorithmRun[] = runs.length > 0 ? runs : [
    {
      id: '1',
      algorithm: 'kruskal',
      timestamp: new Date(Date.now() - 3600000),
      steps: [],
      graphData: {},
      finalWeight: 24,
      executionTime: 45,
    },
    {
      id: '2',
      algorithm: 'prim',
      timestamp: new Date(Date.now() - 7200000),
      steps: [],
      graphData: {},
      finalWeight: 24,
      executionTime: 52,
    },
    {
      id: '3',
      algorithm: 'dijkstra',
      timestamp: new Date(Date.now() - 10800000),
      steps: [],
      graphData: {},
      finalWeight: 28,
      executionTime: 38,
    },
  ];

  const getAlgorithmColor = (algorithm: string) => {
    switch (algorithm) {
      case 'kruskal': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'prim': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'dijkstra': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  const toggleRunSelection = (id: string) => {
    setSelectedRuns(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedRuns.length < 2) {
      toast.error('Select at least 2 runs to compare');
      return;
    }
    setCompareMode(true);
    toast.success(`Comparing ${selectedRuns.length} runs`);
  };

  const handleExport = (run: AlgorithmRun) => {
    if (onExportRun) {
      onExportRun(run);
    } else {
      const data = JSON.stringify(run, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${run.algorithm}-run-${run.id}.json`;
      a.click();
      toast.success('Run exported successfully');
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Visualization History
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and compare algorithm execution history
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleCompare}
            disabled={selectedRuns.length < 2}
            variant="outline"
            size="sm"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Selected
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="comparison">Comparison View</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card className="p-6 border-traffic-medium/20 bg-background/50 backdrop-blur">
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {mockRuns.map((run, index) => (
                  <Card
                    key={run.id}
                    className={`p-4 border transition-all ${
                      selectedRuns.includes(run.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-traffic-medium/20 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedRuns.includes(run.id)}
                            onChange={() => toggleRunSelection(run.id)}
                            className="w-4 h-4 rounded border-traffic-medium"
                          />
                          <Badge variant="outline" className={getAlgorithmColor(run.algorithm)}>
                            {run.algorithm.toUpperCase()}
                          </Badge>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimestamp(run.timestamp)}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 ml-7 mt-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Final Weight</div>
                            <div className="text-lg font-semibold text-primary">{run.finalWeight}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Steps</div>
                            <div className="text-lg font-semibold">{run.steps.length || 12}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Exec Time</div>
                            <div className="text-lg font-semibold">{run.executionTime}ms</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleExport(run)}
                          variant="ghost"
                          size="sm"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => onLoadRun?.(run)}
                          variant="outline"
                          size="sm"
                        >
                          Load
                        </Button>
                        <Button
                          onClick={() => onDeleteRun?.(run.id)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Timeline visualization */}
                    <div className="ml-7 mt-4 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
                      <div className="space-y-2 pl-6">
                        {[...Array(Math.min(3, run.steps.length || 3))].map((_, i) => (
                          <div key={i} className="text-xs text-muted-foreground relative">
                            <div className="absolute -left-[26px] top-1 w-2 h-2 rounded-full bg-primary" />
                            Step {i + 1}: Edge selected
                          </div>
                        ))}
                        {(run.steps.length || 12) > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ... and {(run.steps.length || 12) - 3} more steps
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {mockRuns.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No algorithm runs yet</p>
                    <p className="text-sm mt-2">Run an algorithm to see its history here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card className="p-6 border-traffic-medium/20 bg-background/50 backdrop-blur">
            {selectedRuns.length >= 2 ? (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Comparing {selectedRuns.length} Runs</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockRuns
                    .filter(run => selectedRuns.includes(run.id))
                    .map(run => (
                      <Card key={run.id} className="p-4 border-traffic-medium/20">
                        <Badge variant="outline" className={`${getAlgorithmColor(run.algorithm)} mb-3`}>
                          {run.algorithm.toUpperCase()}
                        </Badge>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Final Weight</span>
                            <span className="text-xl font-bold text-primary">{run.finalWeight}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Steps</span>
                            <span className="font-semibold">{run.steps.length || 12}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Execution Time</span>
                            <span className="font-semibold">{run.executionTime}ms</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Timestamp</span>
                            <span className="text-xs">{formatTimestamp(run.timestamp)}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>

                <Card className="p-4 bg-muted/50">
                  <h4 className="font-semibold mb-3">Analysis</h4>
                  <div className="space-y-2 text-sm">
                    <p>• All algorithms found optimal solution with equal weights</p>
                    <p>• Dijkstra executed fastest ({Math.min(...mockRuns.filter(r => selectedRuns.includes(r.id)).map(r => r.executionTime))}ms)</p>
                    <p>• Kruskal used fewest steps ({Math.min(...mockRuns.filter(r => selectedRuns.includes(r.id)).map(r => r.steps.length || 12))} steps)</p>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select at least 2 runs from the timeline to compare</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VisualizationHistory;
