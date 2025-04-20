import React, { useState, useEffect, useMemo } from 'react';
import { TextField, Button, Box, Typography, LinearProgress, Chip } from '@mui/material';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { CosmographProvider, Cosmograph } from '@cosmograph/react';

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#FF9999', '#77DD77', '#AEC6CF'];

const App = () => {
  const [url, setUrl] = useState('');
  const [modelHeader, setModelHeader] = useState('model');
  const [fromNodeHeader, setFromNodeHeader] = useState('from_node');
  const [relationshipHeader, setRelationshipHeader] = useState('relationship');
  const [toNodeHeader, setToNodeHeader] = useState('to_node');
  const [experimentHeader, setExperimentHeader] = useState('experiment');

  const [fullGraphData, setFullGraphData] = useState({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [experimentColors, setExperimentColors] = useState({});
  const [visibleExperiments, setVisibleExperiments] = useState({});

  const processCSVData = (csvData) => {
    const overallNodeSet = new Set();
    const allExtractedEdges = [];
    const experiments = new Set();

    csvData.forEach(row => {
      const fromNode = row[fromNodeHeader];
      const toNode = row[toNodeHeader];
      const model = row[modelHeader];
      const experiment = row[experimentHeader] || 'undefined';
      const relationship = row[relationshipHeader];

      if (!fromNode || !toNode || !model || !relationship) {
        console.warn("Skipping row due to missing data:", row);
        return;
      }

      const sourceId = `${model}:${fromNode}`;
      const targetId = `${model}:${toNode}`;

      overallNodeSet.add(sourceId);
      overallNodeSet.add(targetId);

      experiments.add(experiment);

      allExtractedEdges.push({
        source: sourceId,
        target: targetId,
        relationship: relationship,
        experiment: experiment
      });
    });

    const colorMap = {};
    Array.from(experiments).forEach((exp, index) => {
      colorMap[exp] = colors[index % colors.length];
    });

    return {
      nodes: Array.from(overallNodeSet).map(nodeId => {
        const parts = nodeId.split(':');
        const model = parts[0];
        const node_name = parts.slice(1).join(':');
        return {
           id: nodeId,
           label: node_name,
           model: model
        };
      }),
      edges: allExtractedEdges,
      experimentColorMap: colorMap
    };
  };

  const handleVisualize = async () => {
    if (!url || !url.endsWith('.csv')) {
      alert('Please enter a valid CSV URL');
      return;
    }

    setIsLoading(true);
    setFullGraphData({ nodes: [], edges: [] });
    setVisibleExperiments({});
    setExperimentColors({});

    try {
      const response = await fetch(url);
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
           if (results.errors.length > 0) {
               console.error("CSV Parsing errors:", results.errors);
               alert("Ошибка при чтении CSV. Проверьте формат файла и разделитель.");
               setIsLoading(false);
               return;
            }

          const processedData = processCSVData(results.data);
          const colorMap = processedData.experimentColorMap;

          const initialVisibility = {};
          Object.keys(colorMap).forEach(exp => {
            initialVisibility[exp] = true;
          });
          setVisibleExperiments(initialVisibility);

          setExperimentColors(colorMap);

          setFullGraphData({
            nodes: processedData.nodes,
            edges: processedData.edges.map(edge => ({
              id: `e-${uuidv4()}`,
              source: edge.source,
              target: edge.target,
              label: edge.relationship,
              color: colorMap[edge.experiment],
              experiment: edge.experiment
            }))
          });

          console.log("Processed nodes:", processedData.nodes.length);
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Error loading CSV:', error);
      setIsLoading(false);
    }
  };

  const filteredGraphData = useMemo(() => {
    if (!fullGraphData.nodes.length) {
      return { nodes: [], links: [] };
    }

    const visibleEdges = fullGraphData.edges.filter(
      edge => visibleExperiments[edge.experiment] === true
    );

    const visibleNodeIds = new Set();
    visibleEdges.forEach(edge => {
      visibleNodeIds.add(edge.source);
      visibleNodeIds.add(edge.target);
    });

    const visibleNodes = fullGraphData.nodes.filter(
      node => visibleNodeIds.has(node.id)
    );

    return { nodes: visibleNodes, links: visibleEdges };

  }, [fullGraphData, visibleExperiments]);

  const toggleExperimentVisibility = (experiment) => {
    setVisibleExperiments(prev => ({
      ...prev,
      [experiment]: !prev[experiment]
    }));
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {/* Input Fields and Button... */}
         <TextField
          label="CSV URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
        />
        <TextField
          label="Model Header"
          value={modelHeader}
          onChange={(e) => setModelHeader(e.target.value)}
          variant="outlined"
          size="small"
        />
        <TextField
          label="From Node Header"
          value={fromNodeHeader}
          onChange={(e) => setFromNodeHeader(e.target.value)}
          variant="outlined"
          size="small"
        />
        <TextField
          label="Relationship Header"
          value={relationshipHeader}
          onChange={(e) => setRelationshipHeader(e.target.value)}
          variant="outlined"
          size="small"
        />
        <TextField
          label="To Node Header"
          value={toNodeHeader}
          onChange={(e) => setToNodeHeader(e.target.value)}
          variant="outlined"
          size="small"
        />
        <TextField
          label="Experiment Header"
          value={experimentHeader}
          onChange={(e) => setExperimentHeader(e.target.value)}
          variant="outlined"
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleVisualize}
          disabled={isLoading}
        >
          Visualize
        </Button>
      </Box>

      {isLoading && <LinearProgress />}

      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexGrow: 1 }}>
        {Object.keys(experimentColors).length > 0 && (
            <Box sx={{ width: 200, minWidth: 150, p: 1, border: '1px solid #ddd', borderRadius: 1, overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{pl: 1}}>Legenda</Typography>
            {Object.entries(experimentColors).map(([exp, color]) => {
              const isVisible = visibleExperiments[exp];
              return (
                <Chip
                  key={exp}
                  label={exp || 'undefined'}
                  size="small"
                  clickable
                  onClick={() => toggleExperimentVisibility(exp)}
                  sx={{
                    m: 0.5,
                    backgroundColor: color,
                    color: 'white',
                    opacity: isVisible ? 1 : 0.4,
                    border: isVisible ? 'none' : '1px solid #aaa',
                    cursor: 'pointer',
                    '&:hover': {
                        opacity: isVisible ? 0.85 : 0.6,
                    }
                  }}
                />
              );
            })}
          </Box>
        )}

        <Box sx={{
          flexGrow: 1,
          height: '100%',
          border: '1px solid #eee',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Conditional messages... */}
          {filteredGraphData.nodes.length === 0 && !isLoading && fullGraphData.nodes.length > 0 && (
            <Box sx={{ /* ... */ }}>
              <Typography>All nodes are filtered out. Please select at least one experiment.</Typography>
            </Box>
          )}

          {fullGraphData.nodes.length === 0 && !isLoading && (
            <Box sx={{ /* ... */ }}>
              <Typography>Please click "Visualize" to load data.</Typography>
            </Box>
          )}

          {filteredGraphData.nodes.length > 0 && (
            <Box sx={{
              height: '100%',
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}>
              <CosmographProvider
                nodes={filteredGraphData.nodes}
                links={filteredGraphData.links}
                key={JSON.stringify(visibleExperiments)}
              >
                <Cosmograph
                  nodeColor={(node) => colors[node.model?.length % colors.length]}
                  linkWidth={1}
                  linkColor={(link) => link.color}
                  fitViewOnInit={false}
                  backgroundColor={"#ffffff"}
                  nodeLabelColor={"#ffffff"}
                  hoveredNodeLabelColor={"#0d6efd"}
                  nodeSize={4}
                  nodeGreyoutOpacity={0.1}
                  linkGreyoutOpacity={0.1}
                  nodeLabel={(node) => `${node.model}: ${node.label}`}
                  simulationCharge={-150}
                  simulationCollisionRadius={10}
                />
              </CosmographProvider>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default App;