import { useEffect, useRef, useState } from 'react';
import './App.css';

function OrgChart() {
  const [go, setGo] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const diagramInstance = useRef<any>(null);

  // Create and initialize diagram manually instead of using ReactDiagram
  useEffect(() => {
    const loadGoJS = async () => {
      try {
        // Import GoJS directly
        const goModule = await import('gojs');
        const goJS = goModule.default || goModule;
        setGo(goJS);
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load GoJS:", error);
      }
    };

    loadGoJS();
  }, []);

  // Initialize diagram once go is loaded and the ref is available
  useEffect(() => {
    if (!go || !diagramRef.current || diagramInstance.current) return;

    const diagram = new go.Diagram(diagramRef.current, {
      'undoManager.isEnabled': true,  
      'clickCreatingTool.archetypeNodeData': { text: 'new node', color: 'lightblue' },
      model: new go.GraphLinksModel({
        linkKeyProperty: 'key',
        nodeDataArray: [
          { key: 0, text: 'Alpha', color: 'lightblue', loc: '0 0' },
          { key: 1, text: 'Beta', color: 'orange', loc: '150 0' },
          { key: 2, text: 'Gamma', color: 'lightgreen', loc: '0 150' },
          { key: 3, text: 'Delta', color: 'pink', loc: '150 150' }
        ],
        linkDataArray: [
          { key: -1, from: 0, to: 1 },
          { key: -2, from: 0, to: 2 },
          { key: -3, from: 1, to: 1 },
          { key: -4, from: 2, to: 3 },
          { key: -5, from: 3, to: 0 }
        ]
      })
    });

    // Define a simple Node template
    diagram.nodeTemplate = new go.Node('Auto')
      .bindTwoWay('location', 'loc', go.Point.parse, go.Point.stringify)
      .add(
        new go.Shape('RoundedRectangle', 
          { name: 'SHAPE', fill: 'white', strokeWidth: 0 })
          .bind('fill', 'color'),
        new go.TextBlock({ margin: 8, editable: true })  
          .bindTwoWay('text')
      );

    // Store diagram instance for cleanup
    diagramInstance.current = diagram;

    // Add model changed event listener
    diagram.addModelChangedListener((e: { isTransactionFinished: any; }) => {
      if (e.isTransactionFinished) {
        console.log('GoJS model changed!');
      }
    });

    return () => {
      // Clean up diagram when component unmounts
      if (diagramInstance.current) {
        diagramInstance.current.div = null;
        diagramInstance.current = null;
      }
    };
  }, [go, diagramRef.current]);

  if (!isLoaded) {
    return <div>Loading organization chart...</div>;
  }

  return (
    <div className="org-chart-container">
      {/* This div will become the diagram's container */}
      <div 
        ref={diagramRef} 
        className="diagram-component" 
        style={{ width: '100%', height: '500px', border: '1px solid #ccc' }}
      />
    </div>
  );
}

export default OrgChart;