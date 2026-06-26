import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Download, Undo2, Redo2, History, ZoomIn, ZoomOut, Move, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Edge } from "@/utils/kruskal";

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
  description: string;
}

interface GraphBuilderProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

const GraphBuilder = ({ nodes, edges, setNodes, setEdges }: GraphBuilderProps) => {
  const [mode, setMode] = useState<"node" | "edge">("node");
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [edgeWeight, setEdgeWeight] = useState("5");
  const [edgeTraffic, setEdgeTraffic] = useState<"low" | "medium" | "high">("low");
  const [isBlocked, setIsBlocked] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(100);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeLabel, setEditingNodeLabel] = useState("");

  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [wasDragging, setWasDragging] = useState(false);

  // Version history state
  const [history, setHistory] = useState<GraphSnapshot[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  // Edge editing state
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [editingEdgeWeight, setEditingEdgeWeight] = useState("");
  const [editingEdgeTraffic, setEditingEdgeTraffic] = useState<"low" | "medium" | "high">("low");
  const [editingEdgeBlocked, setEditingEdgeBlocked] = useState(false);

  // Save to history
  const saveToHistory = (description: string, newNodes: Node[], newEdges: Edge[]) => {
    const snapshot: GraphSnapshot = {
      nodes: JSON.parse(JSON.stringify(newNodes)),
      edges: JSON.parse(JSON.stringify(newEdges)),
      timestamp: Date.now(),
      description,
    };

    const newHistory = history.slice(0, currentHistoryIndex + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  };

  // Undo function
  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const snapshot = history[newIndex];
      setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
      setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
      setCurrentHistoryIndex(newIndex);
      toast.success("Undone");
    }
  };

  // Redo function
  const handleRedo = () => {
    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const snapshot = history[newIndex];
      setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
      setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
      setCurrentHistoryIndex(newIndex);
      toast.success("Redone");
    }
  };

  // Restore from snapshot
  const restoreSnapshot = (index: number) => {
    const snapshot = history[index];
    setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
    setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
    setCurrentHistoryIndex(index);
    toast.success("Snapshot restored");
  };

  // Calculate viewBox based on zoom and pan
  const baseWidth = 800;
  const baseHeight = 500;
  const scaledWidth = baseWidth * (100 / zoom);
  const scaledHeight = baseHeight * (100 / zoom);
  const viewBoxX = panOffset.x;
  const viewBoxY = panOffset.y;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Prevent node creation if we just finished dragging
    if (wasDragging) {
      setWasDragging(false);
      return;
    }
    if (mode !== "node" || isPanning) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coordinates to SVG viewBox coordinates
    const svgX = viewBoxX + (clickX / rect.width) * scaledWidth;
    const svgY = viewBoxY + (clickY / rect.height) * scaledHeight;

    const nodeId = nodes.length < 26 
      ? String.fromCharCode(65 + nodes.length) 
      : `N${nodes.length + 1}`;
    
    const newNode: Node = {
      id: nodeId,
      x: svgX,
      y: svgY,
      label: nodeId,
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    saveToHistory(`Added node ${nodeId}`, updatedNodes, edges);
    toast.success(`Node ${nodeId} added`);
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+click for panning
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) * (scaledWidth / rect.width);
    const dy = (e.clientY - panStart.y) * (scaledHeight / rect.height);
    
    setPanOffset(prev => ({
      x: prev.x - dx,
      y: prev.y - dy,
    }));
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    setZoom(prev => Math.max(25, Math.min(200, prev + delta)));
  };

  // Node editing handlers
  const startEditingNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditingNodeLabel(node.label);
    }
  };

  const saveNodeEdit = () => {
    if (!editingNodeId || !editingNodeLabel.trim()) return;
    
    const updatedNodes = nodes.map(n => 
      n.id === editingNodeId ? { ...n, label: editingNodeLabel.trim() } : n
    );
    setNodes(updatedNodes);
    saveToHistory(`Renamed node ${editingNodeId}`, updatedNodes, edges);
    toast.success(`Node renamed to "${editingNodeLabel.trim()}"`);
    setEditingNodeId(null);
    setEditingNodeLabel("");
  };

  const cancelNodeEdit = () => {
    setEditingNodeId(null);
    setEditingNodeLabel("");
  };

  const resetView = () => {
    setZoom(100);
    setPanOffset({ x: 0, y: 0 });
  };

  // Node dragging handlers
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    if (mode === "edge") return; // Don't drag in edge mode
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleNodeDrag = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeId) return;
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) * (scaledWidth / rect.width);
    const dy = (e.clientY - dragStart.y) * (scaledHeight / rect.height);
    
    const updatedNodes = nodes.map(n => 
      n.id === draggingNodeId 
        ? { ...n, x: n.x + dx, y: n.y + dy }
        : n
    );
    setNodes(updatedNodes);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleNodeDragEnd = () => {
    if (draggingNodeId) {
      saveToHistory(`Moved node ${draggingNodeId}`, nodes, edges);
      setDraggingNodeId(null);
      setWasDragging(true); // Flag to prevent node creation on mouseUp
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (mode === "edge") {
      if (edgeStart === null) {
        setEdgeStart(nodeId);
        toast.info(`Edge starts at ${nodeId}. Click another node to complete.`);
      } else if (edgeStart === nodeId) {
        toast.error("Cannot create self-loop");
        setEdgeStart(null);
      } else {
        // Check if edge already exists
        const edgeExists = edges.some(
          (e) =>
            (e.from === edgeStart && e.to === nodeId) ||
            (e.from === nodeId && e.to === edgeStart)
        );

        if (edgeExists) {
          toast.error("Edge already exists");
          setEdgeStart(null);
          return;
        }

        const newEdge: Edge = {
          from: edgeStart,
          to: nodeId,
          weight: parseInt(edgeWeight) || 5,
          traffic: edgeTraffic,
          isBlocked: isBlocked,
        };

        const updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
        saveToHistory(`Added edge ${edgeStart}-${nodeId}`, nodes, updatedEdges);
        toast.success(`Edge ${edgeStart}-${nodeId} created`);
        setEdgeStart(null);
      }
    } else {
      setSelectedNode(nodeId);
    }
  };

  const deleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    saveToHistory(`Deleted node ${nodeId}`, updatedNodes, updatedEdges);
    if (selectedNode === nodeId) setSelectedNode(null);
    if (edgeStart === nodeId) setEdgeStart(null);
    toast.success(`Node ${nodeId} deleted`);
  };

  const deleteEdge = (from: string, to: string) => {
    const updatedEdges = edges.filter((e) => !(e.from === from && e.to === to));
    setEdges(updatedEdges);
    saveToHistory(`Deleted edge ${from}-${to}`, nodes, updatedEdges);
    setSelectedEdgeKey(null);
    toast.success(`Edge ${from}-${to} deleted`);
  };

  // Edge selection handler
  const handleEdgeClick = (edge: Edge, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${edge.from}-${edge.to}`;
    setSelectedEdgeKey(key);
    setEditingEdgeWeight(String(edge.weight));
    setEditingEdgeTraffic(edge.traffic);
    setEditingEdgeBlocked(edge.isBlocked || false);
  };

  // Save edge edits
  const saveEdgeEdit = () => {
    if (!selectedEdgeKey) return;
    const [from, to] = selectedEdgeKey.split("-");
    
    const updatedEdges = edges.map((e) =>
      e.from === from && e.to === to
        ? {
            ...e,
            weight: parseInt(editingEdgeWeight) || e.weight,
            traffic: editingEdgeTraffic,
            isBlocked: editingEdgeBlocked,
          }
        : e
    );
    
    setEdges(updatedEdges);
    saveToHistory(`Updated edge ${from}-${to}`, nodes, updatedEdges);
    toast.success(`Edge ${from}-${to} updated`);
    setSelectedEdgeKey(null);
  };

  const cancelEdgeEdit = () => {
    setSelectedEdgeKey(null);
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    saveToHistory("Cleared graph", [], []);
    setSelectedNode(null);
    setEdgeStart(null);
    toast.info("Graph cleared");
  };

  const exportGraph = () => {
    const graphData = { nodes, edges };
    const dataStr = JSON.stringify(graphData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "graph.json";
    link.click();
    toast.success("Graph exported");
  };

  const getNodePosition = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId);
  };

  const getTrafficColor = (traffic: string) => {
    switch (traffic) {
      case "low":
        return "hsl(var(--traffic-low))";
      case "medium":
        return "hsl(var(--traffic-medium))";
      case "high":
        return "hsl(var(--traffic-high))";
      default:
        return "hsl(var(--border))";
    }
  };

  return (
    <Card className="border-2">
            <CardHeader>
              <CardTitle className="font-display">Custom Graph Builder</CardTitle>
              <CardDescription>
                Click to add nodes, then create edges between them with custom weights and traffic
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mode Selection */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    setMode("node");
                    setEdgeStart(null);
                  }}
                  variant={mode === "node" ? "default" : "outline"}
                  className={mode === "node" ? "bg-primary hover:bg-primary/90" : ""}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Nodes
                </Button>
                <Button
                  id="edge-mode-button"
                  onClick={() => setMode("edge")}
                  variant={mode === "edge" ? "default" : "outline"}
                  className={mode === "edge" ? "bg-secondary hover:bg-secondary/90" : ""}
                  disabled={nodes.length < 2}
                >
                  Connect Nodes
                </Button>
                <Button onClick={clearGraph} variant="outline">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
                <Button onClick={exportGraph} variant="outline" disabled={nodes.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button 
                    onClick={handleUndo} 
                    variant="outline" 
                    disabled={currentHistoryIndex <= 0}
                    size="icon"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={handleRedo} 
                    variant="outline" 
                    disabled={currentHistoryIndex >= history.length - 1}
                    size="icon"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

          {/* Edge Properties (shown when in edge mode) */}
          {mode === "edge" && (
            <Card className="bg-muted/50 border-secondary/50">
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2" id="edge-weight-slider">
                    <Label htmlFor="weight">Edge Weight (km)</Label>
                    <Input
                      id="weight"
                      type="number"
                      min="1"
                      max="20"
                      value={edgeWeight}
                      onChange={(e) => setEdgeWeight(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2" id="traffic-level-slider">
                    <Label htmlFor="traffic">Traffic Level</Label>
                    <Select value={edgeTraffic} onValueChange={(v: "low" | "medium" | "high") => setEdgeTraffic(v)}>
                      <SelectTrigger id="traffic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Traffic</SelectItem>
                        <SelectItem value="medium">Medium Traffic</SelectItem>
                        <SelectItem value="high">High Traffic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => setIsBlocked(!isBlocked)}
                      variant={isBlocked ? "destructive" : "outline"}
                      className="w-full"
                    >
                      {isBlocked ? "Blocked" : "Not Blocked"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm">
            <p>
              {mode === "node" && "Click anywhere on the canvas to add nodes. Drag nodes to move them."}
              {mode === "edge" && edgeStart === null && "Click a node to start creating an edge"}
              {mode === "edge" && edgeStart !== null && `Creating edge from ${edgeStart}. Click another node to complete.`}
            </p>
            <p className="text-muted-foreground mt-1">
              Tip: Drag nodes to reposition | Alt+Drag to pan | Scroll to zoom | Double-click node to rename
            </p>
          </div>

          {/* Zoom Controls */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={(v) => setZoom(v[0])}
                min={25}
                max={200}
                step={5}
                className="w-32"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium ml-2">{zoom}%</span>
            </div>
            <Button variant="outline" size="sm" onClick={resetView}>
              <Move className="w-4 h-4 mr-1" />
              Reset View
            </Button>
          </div>

          {/* Canvas */}
          <div className="relative bg-card border-2 border-border rounded-lg p-2 sm:p-4 overflow-hidden">
            <svg
              id="canvas"
              ref={svgRef}
              width="100%"
              height="500"
              viewBox={`${viewBoxX} ${viewBoxY} ${scaledWidth} ${scaledHeight}`}
              preserveAspectRatio="xMidYMid meet"
              className={`min-w-[400px] ${draggingNodeId ? "cursor-grabbing" : isPanning ? "cursor-grabbing" : mode === "node" ? "cursor-crosshair" : "cursor-pointer"}`}
              onClick={handleSvgClick}
              onMouseDown={handleMouseDown}
              onMouseMove={(e) => {
                handleMouseMove(e);
                handleNodeDrag(e);
              }}
              onMouseUp={() => {
                handleMouseUp();
                handleNodeDragEnd();
              }}
              onMouseLeave={() => {
                handleMouseUp();
                handleNodeDragEnd();
              }}
              onWheel={handleWheel}
            >
              {/* Draw edges */}
              {edges.map((edge, index) => {
                const from = getNodePosition(edge.from);
                const to = getNodePosition(edge.to);
                if (!from || !to) return null;
                const edgeKey = `${edge.from}-${edge.to}`;
                const isSelected = selectedEdgeKey === edgeKey;

                return (
                  <g key={index}>
                    {/* Clickable area for edge selection */}
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="transparent"
                      strokeWidth={20}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={(e) => handleEdgeClick(edge, e)}
                    />
                    {/* Edge background for better visibility */}
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={isSelected ? "hsl(var(--primary) / 0.5)" : "hsl(var(--foreground) / 0.2)"}
                      strokeWidth={isSelected ? 10 : edge.isBlocked ? 8 : 6}
                      strokeLinecap="round"
                    />
                    {/* Main edge line */}
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={edge.isBlocked ? "hsl(var(--destructive))" : getTrafficColor(edge.traffic)}
                      strokeWidth={edge.isBlocked ? 5 : 4}
                      strokeDasharray={edge.isBlocked ? "8,4" : "none"}
                      strokeLinecap="round"
                      className="transition-all pointer-events-none"
                    />
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 10}
                      fill="hsl(var(--foreground))"
                      fontSize="12"
                      fontWeight="600"
                      className="select-none pointer-events-none"
                    >
                      {edge.weight}km
                    </text>
                    {/* Edit edge button */}
                    <circle
                      cx={(from.x + to.x) / 2 - 15}
                      cy={(from.y + to.y) / 2 + 10}
                      r="8"
                      fill="hsl(var(--secondary))"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => handleEdgeClick(edge, e)}
                    />
                    <text
                      x={(from.x + to.x) / 2 - 15}
                      y={(from.y + to.y) / 2 + 10}
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      ✎
                    </text>
                    {/* Delete edge button */}
                    <circle
                      cx={(from.x + to.x) / 2 + 15}
                      cy={(from.y + to.y) / 2 + 10}
                      r="8"
                      fill="hsl(var(--destructive))"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEdge(edge.from, edge.to);
                      }}
                    />
                    <text
                      x={(from.x + to.x) / 2 + 15}
                      y={(from.y + to.y) / 2 + 10}
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      ×
                    </text>
                  </g>
                );
              })}

              {/* Draw edge in progress */}
              {mode === "edge" && edgeStart !== null && (
                <line
                  x1={getNodePosition(edgeStart)?.x}
                  y1={getNodePosition(edgeStart)?.y}
                  x2={getNodePosition(edgeStart)?.x}
                  y2={getNodePosition(edgeStart)?.y}
                  stroke="hsl(var(--secondary))"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                  className="animate-pulse"
                />
              )}

              {/* Draw nodes */}
              {nodes.map((node) => {
                const nodeRadius = 25 * (100 / zoom);
                const fontSize = 14 * (100 / zoom);
                const smallFontSize = 10 * (100 / zoom);
                const buttonRadius = 10 * (100 / zoom);
                const labelOffset = 35 * (100 / zoom);
                
                return (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius}
                      fill={
                        draggingNodeId === node.id
                          ? "hsl(var(--accent))"
                          : edgeStart === node.id
                          ? "hsl(var(--secondary))"
                          : selectedNode === node.id
                          ? "hsl(var(--accent))"
                          : "hsl(var(--primary))"
                      }
                      stroke="hsl(var(--background))"
                      strokeWidth={3 * (100 / zoom)}
                      className={`drop-shadow-lg hover:opacity-80 transition-all ${mode === "node" ? "cursor-grab" : "cursor-pointer"} ${draggingNodeId === node.id ? "cursor-grabbing" : ""}`}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                      onDoubleClick={(e) => startEditingNode(node.id, e)}
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      fill="hsl(var(--primary-foreground))"
                      fontSize={fontSize}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      {node.id}
                    </text>
                    {/* Node label below */}
                    <text
                      x={node.x}
                      y={node.y + labelOffset}
                      fill="hsl(var(--foreground))"
                      fontSize={smallFontSize}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      {node.label !== node.id ? node.label : ""}
                    </text>
                    {/* Delete node button */}
                    <circle
                      cx={node.x + nodeRadius * 0.8}
                      cy={node.y - nodeRadius * 0.8}
                      r={buttonRadius}
                      fill="hsl(var(--destructive))"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                    />
                    <text
                      x={node.x + nodeRadius * 0.8}
                      y={node.y - nodeRadius * 0.8}
                      fill="white"
                      fontSize={smallFontSize}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      ×
                    </text>
                    {/* Edit node button */}
                    <circle
                      cx={node.x - nodeRadius * 0.8}
                      cy={node.y - nodeRadius * 0.8}
                      r={buttonRadius}
                      fill="hsl(var(--secondary))"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => startEditingNode(node.id, e)}
                    />
                    <text
                      x={node.x - nodeRadius * 0.8}
                      y={node.y - nodeRadius * 0.8}
                      fill="white"
                      fontSize={smallFontSize * 0.8}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                    >
                      ✎
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Node Editing Modal */}
          {editingNodeId && (
            <Card className="p-4 bg-muted/50 border-primary/30">
              <div className="flex items-center gap-3">
                <Edit2 className="w-4 h-4 text-primary" />
                <Label>Rename Node {editingNodeId}:</Label>
                <Input
                  value={editingNodeLabel}
                  onChange={(e) => setEditingNodeLabel(e.target.value)}
                  placeholder="Enter node name"
                  className="max-w-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNodeEdit();
                    if (e.key === "Escape") cancelNodeEdit();
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={saveNodeEdit} variant="default">
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={cancelNodeEdit} variant="outline">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Edge Editing Panel */}
          {selectedEdgeKey && (
            <Card className="p-4 bg-muted/50 border-secondary/30">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-secondary" />
                  <Label className="font-semibold">Edit Road Segment: {selectedEdgeKey.replace('-', ' → ')}</Label>
                </div>
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editWeight">Distance (km)</Label>
                    <Input
                      id="editWeight"
                      type="number"
                      min="1"
                      max="100"
                      value={editingEdgeWeight}
                      onChange={(e) => setEditingEdgeWeight(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editTraffic">Traffic Level</Label>
                    <Select value={editingEdgeTraffic} onValueChange={(v: "low" | "medium" | "high") => setEditingEdgeTraffic(v)}>
                      <SelectTrigger id="editTraffic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 Low Traffic</SelectItem>
                        <SelectItem value="medium">🟡 Medium Traffic</SelectItem>
                        <SelectItem value="high">🔴 High Traffic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Road Status</Label>
                    <Button
                      onClick={() => setEditingEdgeBlocked(!editingEdgeBlocked)}
                      variant={editingEdgeBlocked ? "destructive" : "outline"}
                      className="w-full"
                    >
                      {editingEdgeBlocked ? "🚧 Blocked" : "✓ Open"}
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={saveEdgeEdit} variant="default" className="flex-1">
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button onClick={cancelEdgeEdit} variant="outline">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

              {/* Stats */}
              <div id="graph-stats" className="flex flex-wrap gap-4 text-sm">
                <Badge variant="outline">
                  <Plus className="w-3 h-3 mr-1" />
                  {nodes.length} Nodes
                </Badge>
                <Badge variant="outline">
                  {edges.length} Edges
                </Badge>
                <Badge variant="outline">
                  {edges.filter((e) => !e.isBlocked).length} Valid Edges
                </Badge>
                <Badge variant="outline">
                  {edges.filter((e) => e.isBlocked).length} Blocked Edges
                </Badge>
                {history.length > 0 && (
                  <Badge variant="outline">
                    <History className="w-3 h-3 mr-1" />
                    {currentHistoryIndex + 1}/{history.length} snapshots
                  </Badge>
                )}
              </div>

              {/* Version History Timeline */}
              {history.length > 0 && (
                <Card className="bg-muted/30 border-accent/30">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Version History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {history.map((snapshot, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            index === currentHistoryIndex
                              ? "bg-primary/20 border border-primary/30"
                              : "bg-card hover:bg-accent/10"
                          }`}
                          onClick={() => restoreSnapshot(index)}
                        >
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4" />
                            <div>
                              <p className="text-sm font-medium">{snapshot.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(snapshot.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {snapshot.nodes.length}N / {snapshot.edges.length}E
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
    </Card>
  );
};

export default GraphBuilder;
