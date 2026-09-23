import React, { useState } from 'react';
import { motion, AnimatePresence, useAnimationFrame } from 'framer-motion';

const benefits = [
  {
    id: 1,
    title: 'Visibilidade total do escopo mensal',
    basePosition: { x: 50, y: 12 },
    floatOffset: 0,
  },
  {
    id: 2,
    title: 'Redução de retrabalho com pedidos fora do combinado',
    basePosition: { x: 22, y: 42 },
    floatOffset: 1.2,
  },
  {
    id: 3,
    title: 'Mais confiança entre equipe e cliente',
    basePosition: { x: 55, y: 48 },
    floatOffset: 2.4,
  },
  {
    id: 4,
    title: 'Planejamento com base em dados, não no improviso',
    basePosition: { x: 82, y: 38 },
    floatOffset: 3.6,
  },
  {
    id: 5,
    title: 'Previsibilidade e organização nas entregas',
    basePosition: { x: 48, y: 82 },
    floatOffset: 4.8,
  },
];

// Only connections: 1->3, 2->3, 3->4, 3->5
const connections = [
  [0, 2], // 1 -> 3
  [1, 2], // 2 -> 3
  [2, 3], // 3 -> 4
  [2, 4], // 3 -> 5
];

// Calculate floating position based on time - very slow (70% slower)
const getFloatingY = (baseY: number, offset: number, time: number): number => {
  const slowTime = time * 0.0003;
  return baseY + Math.sin(slowTime + offset) * 1.5;
};

const MolecularNetwork: React.FC<{
  selectedNode: number | null;
  onNodeClick: (id: number) => void;
}> = ({ selectedNode, onNodeClick }) => {
  const [time, setTime] = React.useState(0);

  useAnimationFrame((t) => {
    setTime(t);
  });

  // Calculate current positions for all nodes
  const currentPositions = benefits.map((b) => ({
    x: b.basePosition.x,
    y: getFloatingY(b.basePosition.y, b.floatOffset, time),
  }));

  const isNodeConnected = (nodeId: number) => {
    if (selectedNode === null) return false;
    const selectedIndex = selectedNode - 1;
    const nodeIndex = nodeId - 1;
    return connections.some(
      ([from, to]) =>
        (from === selectedIndex && to === nodeIndex) ||
        (to === selectedIndex && from === nodeIndex)
    );
  };

  return (
    <svg 
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Connection lines - follow sphere centers */}
      {connections.map(([from, to], index) => {
        const isActive = 
          selectedNode === benefits[from].id || 
          selectedNode === benefits[to].id;
        
        return (
          <line
            key={`line-${index}`}
            x1={currentPositions[from].x}
            y1={currentPositions[from].y}
            x2={currentPositions[to].x}
            y2={currentPositions[to].y}
            stroke={isActive ? "#F5A623" : "#9CA3AF"}
            strokeWidth={isActive ? "1" : "0.5"}
            strokeLinecap="round"
            strokeOpacity={isActive ? 0.8 : 0.3}
          />
        );
      })}

      {/* Sphere nodes - solid color, no effects */}
      {benefits.map((benefit, index) => {
        const isSelected = selectedNode === benefit.id;
        const baseRadius = isSelected ? 10 : 5;
        const pos = currentPositions[index];
        
        return (
          <g 
            key={benefit.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onNodeClick(benefit.id)}
          >
            {/* Pulse animation for selected node */}
            {isSelected && (
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={baseRadius}
                fill="none"
                stroke="#F5A623"
                strokeWidth="0.5"
                opacity={0.4}
                animate={{ 
                  r: [baseRadius, baseRadius + 4, baseRadius],
                  opacity: [0.4, 0, 0.4]
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
            )}
            
            {/* Main sphere - solid color */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={baseRadius}
              fill={isSelected ? "#F5A623" : "#D44F0F"}
              opacity={isSelected ? 1 : 0.5}
            />
            
            {/* Number text */}
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={isSelected ? "5" : "3.5"}
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {benefit.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const BenefitsSection: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  const handleNodeClick = (id: number) => {
    setSelectedNode(id);
  };

  const isNodeConnected = (nodeId: number) => {
    if (selectedNode === null) return false;
    const selectedIndex = selectedNode - 1;
    const nodeIndex = nodeId - 1;
    return connections.some(
      ([from, to]) =>
        (from === selectedIndex && to === nodeIndex) ||
        (to === selectedIndex && from === nodeIndex)
    );
  };

  return (
    <section className="bg-gray-50 py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4">
            5 BENEFÍCIOS PRINCIPAIS
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-soma-black">
            5 resultados que o SoMA entrega:
          </h2>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          {/* Left - Molecular Network */}
          <div className="relative w-full lg:w-1/2 aspect-square max-w-md">
            <MolecularNetwork 
              selectedNode={selectedNode} 
              onNodeClick={handleNodeClick} 
            />
          </div>

          {/* Right - Content Panel */}
          <div className="w-full lg:w-1/2">
            <AnimatePresence mode="wait">
              {selectedNode && (
                <motion.div
                  key={selectedNode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-lg">
                    <div className="flex items-start gap-5">
                      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-soma-orange-light to-soma-orange-medium flex items-center justify-center shadow-md">
                        <span className="text-2xl font-bold text-white">{selectedNode}</span>
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-semibold text-soma-black leading-tight">
                          {benefits.find(b => b.id === selectedNode)?.title}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List of all benefits */}
            <div className="mt-8 space-y-3">
              {benefits.map((benefit) => (
                <motion.div
                  key={benefit.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedNode === benefit.id
                      ? 'bg-soma-orange-light/10 border border-soma-orange-light/30'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleNodeClick(benefit.id)}
                  whileHover={{ x: 4 }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    selectedNode === benefit.id
                      ? 'bg-gradient-to-br from-soma-orange-light to-soma-orange-medium text-white shadow-md'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {benefit.id}
                  </div>
                  <span className={`text-sm md:text-base ${
                    selectedNode === benefit.id
                      ? 'text-soma-black font-medium'
                      : 'text-gray-600'
                  }`}>
                    {benefit.title}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Quote section */}
        <div className="mt-20 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center">
            <div className="md:w-3/4">
              <p className="text-xl md:text-2xl text-gray-700 italic mb-4">
                "Times que usam gestão visual de escopo têm 38% menos retrabalho e 27% mais entregas no prazo."
              </p>
              <p className="text-soma-orange-medium font-medium">
                — PMI Pulse of the Profession, 2022
              </p>
            </div>
            <div className="md:w-1/4 mt-8 md:mt-0 flex justify-center">
              <div className="relative h-28 w-28">
                <div className="absolute inset-0 bg-soma-orange-light/20 rounded-full"></div>
                <div className="absolute inset-2 bg-soma-orange-light/30 rounded-full"></div>
                <div className="absolute inset-4 bg-soma-orange-light rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">38%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
